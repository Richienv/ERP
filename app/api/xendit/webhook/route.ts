import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Webhook handler for Xendit payout status updates
export async function POST(req: NextRequest) {
    try {
        // 1. Verify webhook authenticity
        const callbackToken = req.headers.get('x-callback-token');
        const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;

        if (expectedToken && callbackToken !== expectedToken) {
            console.error('Invalid Xendit webhook token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse webhook payload
        const payload = await req.json();

        console.log('Xendit Webhook Received:', JSON.stringify(payload, null, 2));

        // Payout API v2 webhook structure
        const {
            id,           // Xendit payout ID
            reference_id, // Our internal reference (bill number)
            status,       // ACCEPTED, PENDING, SUCCEEDED, FAILED, VOIDED
            amount,
            channel_code,
            failure_code,
            created,
            updated,
        } = payload;

        // 3. Log the webhook event
        console.log(`Payout ${reference_id} status: ${status}`);

        // 4. Update payment/invoice status based on webhook
        // Find the payment record by reference
        try {
            // Try to find a payment with this reference
            const payment = await prisma.payment.findFirst({
                where: { reference: reference_id },
                include: { invoice: true }
            });

            if (payment) {
                // Update based on status
                switch (status) {
                    case 'SUCCEEDED':
                        // Payment completed - update invoice to PAID
                        if (payment.invoiceId) {
                            await prisma.invoice.update({
                                where: { id: payment.invoiceId },
                                data: {
                                    status: 'PAID',
                                    balanceDue: 0
                                }
                            });
                        }

                        // Update payment notes
                        await prisma.payment.update({
                            where: { id: payment.id },
                            data: {
                                notes: `${payment.notes || ''}\n[Xendit] Payment completed at ${updated || new Date().toISOString()}`
                            }
                        });

                        console.log(`✅ Payment ${reference_id} completed successfully`);
                        break;

                    case 'FAILED':
                        // Payment failed - revert invoice status
                        if (payment.invoiceId) {
                            await prisma.invoice.update({
                                where: { id: payment.invoiceId },
                                data: { status: 'ISSUED' } // Back to issued
                            });
                        }

                        // Log failure
                        await prisma.payment.update({
                            where: { id: payment.id },
                            data: {
                                notes: `${payment.notes || ''}\n[Xendit] Payment FAILED: ${failure_code || 'Unknown error'}`
                            }
                        });

                        console.error(`❌ Payment ${reference_id} failed: ${failure_code}`);
                        break;

                    case 'VOIDED':
                        // Payment voided
                        if (payment.invoiceId) {
                            await prisma.invoice.update({
                                where: { id: payment.invoiceId },
                                data: { status: 'ISSUED' }
                            });
                        }

                        await prisma.payment.update({
                            where: { id: payment.id },
                            data: {
                                notes: `${payment.notes || ''}\n[Xendit] Payment voided`
                            }
                        });

                        console.log(`⚠️ Payment ${reference_id} voided`);
                        break;

                    case 'ACCEPTED':
                    case 'PENDING':
                        // Payment in progress - just log
                        console.log(`⏳ Payment ${reference_id} is ${status}`);
                        break;
                }
            } else {
                console.warn(`Payment not found for reference: ${reference_id}`);
            }
        } catch (dbError) {
            console.error('Database update error:', dbError);
            // Don't fail the webhook - just log
        }

        // 5. Always return 200 to acknowledge receipt
        return NextResponse.json({
            received: true,
            reference_id,
            status
        });

    } catch (error: any) {
        console.error('Webhook Processing Error:', error);
        // Return 200 anyway to prevent Xendit from retrying
        return NextResponse.json({
            received: true,
            error: 'Processing error logged'
        });
    }
}
