'use server'

import { withPrismaAuth } from '@/lib/db'
import {
    BANK_CHANNELS,
    getXenditClient,
    generateIdempotencyKey,
    calculatePayoutFees,
    type BankChannelCode
} from '@/lib/xendit'

interface XenditPayoutRequest {
    billId: string
    amount: number
    bankCode: string // e.g., 'BCA', 'MANDIRI'
    accountNumber: string
    accountHolderName: string
    description?: string
}

/**
 * Process a vendor payment via Xendit
 */
export async function processXenditPayout(data: XenditPayoutRequest) {
    try {
        return await withPrismaAuth(async (prisma) => {
            // 1. Get the bill
            const bill = await prisma.invoice.findUnique({
                where: { id: data.billId },
                include: { supplier: true }
            })

            if (!bill) {
                throw new Error('Bill not found')
            }

            if (bill.status === 'PAID') {
                throw new Error('Bill is already paid')
            }

            // 2. Validate amount
            if (data.amount <= 0 || data.amount > Number(bill.balanceDue)) {
                throw new Error('Invalid payment amount')
            }

            // 3. Get channel code
            const channelCode = BANK_CHANNELS[data.bankCode as keyof typeof BANK_CHANNELS] as BankChannelCode
            if (!channelCode) {
                throw new Error(`Invalid bank code: ${data.bankCode}`)
            }

            // 4. Calculate fees
            const fees = calculatePayoutFees(data.amount, channelCode)

            // 5. Generate deterministic reference ID (no Date.now() — must be stable for idempotent retries)
            const referenceId = `erp-payout-${data.billId}`

            // 6. Update supplier bank details if different
            if (bill.supplierId) {
                await prisma.supplier.update({
                    where: { id: bill.supplierId },
                    data: {
                        bankName: data.bankCode,
                        bankAccountNumber: data.accountNumber,
                        bankAccountName: data.accountHolderName
                    }
                })
            }

            // 7. Update bill status to ISSUED (processing)
            if (bill.status === 'DRAFT' || bill.status === 'DISPUTED') {
                await prisma.invoice.update({
                    where: { id: data.billId },
                    data: { status: 'ISSUED' }
                })
            }

            // 8. Try to call Xendit API FIRST (before creating any payment record)
            let xenditResult: any = null

            try {
                const xendit = getXenditClient()
                const { Payout } = xendit

                const payoutData = {
                    referenceId,
                    channelCode,
                    channelProperties: {
                        accountNumber: data.accountNumber,
                        accountHolderName: data.accountHolderName,
                    },
                    amount: data.amount,
                    currency: 'IDR' as const,
                    description: data.description || `Payment for ${bill.number}`,
                    metadata: {
                        bill_id: data.billId,
                        bill_number: bill.number,
                        supplier_id: bill.supplierId,
                        source: 'erp_ap'
                    }
                }

                xenditResult = await Payout.createPayout({
                    data: payoutData,
                    idempotencyKey: generateIdempotencyKey(referenceId)
                })
            } catch (err: any) {
                console.error('Xendit Payout API Error:', err)
                // Xendit failed — do NOT create payment record
                // Revert bill status if we changed it
                if (bill.status === 'DRAFT' || bill.status === 'DISPUTED') {
                    await prisma.invoice.update({
                        where: { id: data.billId },
                        data: { status: bill.status } // revert to original
                    })
                }
                return {
                    success: false,
                    error: `Xendit API gagal: ${err.message || 'Unknown error'}. Tidak ada pembayaran yang dibuat.`
                }
            }

            // 9. Xendit accepted — NOW create Payment record
            const payment = await prisma.payment.create({
                data: {
                    number: referenceId,
                    amount: data.amount,
                    method: 'TRANSFER',
                    date: new Date(),
                    invoiceId: data.billId,
                    supplierId: bill.supplierId,
                    reference: referenceId,
                    notes: `Xendit ID: ${xenditResult.id}\nStatus: ${xenditResult.status}\nBank: ${data.bankCode} - ${data.accountNumber}`
                }
            })

            // 10. Return success
            return {
                success: true,
                paymentId: payment.id,
                referenceId,
                xenditStatus: xenditResult?.status || 'PENDING',
                xenditId: xenditResult?.id,
                fees,
                message: 'Payment initiated successfully'
            }
        })
    } catch (error: any) {
        console.error('Process Xendit Payout Error:', error)
        return {
            success: false,
            error: error.message || 'Failed to process payment'
        }
    }
}

/**
 * Get available banks for vendor payments
 */
export async function getAvailableBanks() {
    const banks = Object.entries(BANK_CHANNELS).map(([key, code]) => ({
        key,
        code,
        name: getBankDisplayName(key),
        isEwallet: code.includes('OVO') || code.includes('GOPAY') || code.includes('DANA') || code.includes('LINKAJA') || code.includes('SHOPEEPAY'),
    }))

    return {
        banks: banks.filter(b => !b.isEwallet),
        ewallets: banks.filter(b => b.isEwallet),
    }
}

function getBankDisplayName(key: string): string {
    const names: Record<string, string> = {
        BCA: 'Bank Central Asia (BCA)',
        MANDIRI: 'Bank Mandiri',
        BNI: 'Bank Negara Indonesia (BNI)',
        BRI: 'Bank Rakyat Indonesia (BRI)',
        PERMATA: 'Bank Permata',
        CIMB: 'CIMB Niaga',
        BSI: 'Bank Syariah Indonesia (BSI)',
        BTN: 'Bank Tabungan Negara (BTN)',
        DANAMON: 'Bank Danamon',
        MAYBANK: 'Maybank Indonesia',
        OVO: 'OVO',
        GOPAY: 'GoPay',
        DANA: 'DANA',
        LINKAJA: 'LinkAja',
        SHOPEEPAY: 'ShopeePay',
    }
    return names[key] || key
}
