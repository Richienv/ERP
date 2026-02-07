import { NextRequest, NextResponse } from 'next/server';
import {
    getXenditClient,
    generateIdempotencyKey,
    validateAccountNumber,
    getMinAmount,
    type PayoutRequest
} from '@/lib/xendit';

export async function POST(req: NextRequest) {
    try {
        const body: PayoutRequest = await req.json();

        // Validate required fields
        const {
            referenceId,
            channelCode,
            accountNumber,
            accountHolderName,
            amount,
            description,
            emailTo,
            metadata
        } = body;

        // Validation
        if (!referenceId || !channelCode || !accountNumber || !accountHolderName || !amount) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: referenceId, channelCode, accountNumber, accountHolderName, amount' },
                { status: 400 }
            );
        }

        // Validate amount
        const minAmount = getMinAmount(channelCode);
        if (amount < minAmount) {
            return NextResponse.json(
                { success: false, error: `Minimum payout is IDR ${minAmount.toLocaleString()}` },
                { status: 400 }
            );
        }

        // Validate account number format
        if (!validateAccountNumber(channelCode, accountNumber)) {
            return NextResponse.json(
                { success: false, error: `Invalid account number format for ${channelCode}` },
                { status: 400 }
            );
        }

        // Get Xendit client
        const xendit = getXenditClient();
        const { Payout } = xendit;

        // Create payout
        const idempotencyKey = generateIdempotencyKey(referenceId);

        const payoutData = {
            referenceId,
            channelCode,
            channelProperties: {
                accountNumber,
                accountHolderName,
            },
            amount,
            currency: 'IDR' as const,
            description: description || 'ERP Vendor Payment',
            metadata: {
                source: 'erp_vendor_payment',
                timestamp: new Date().toISOString(),
                ...metadata,
            },
        };

        // Add email notification if provided
        if (emailTo && emailTo.length > 0) {
            (payoutData as any).receiptNotification = {
                emailTo,
            };
        }

        const payout = await Payout.createPayout({
            data: payoutData,
            idempotencyKey,
        });

        return NextResponse.json({
            success: true,
            data: {
                id: payout.id,
                referenceId: payout.referenceId,
                status: payout.status,
                amount: payout.amount,
                channelCode: payout.channelCode,
                created: payout.created,
            },
        });

    } catch (error: any) {
        console.error('Xendit Payout Error:', error);

        // Handle Xendit API errors
        if (error.rawResponse) {
            const errorData = JSON.parse(error.rawResponse);
            return NextResponse.json(
                {
                    success: false,
                    error: errorData.message || 'Xendit API Error',
                    code: errorData.error_code,
                    details: errorData
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET: Check payout status by ID
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const payoutId = searchParams.get('id');

        if (!payoutId) {
            return NextResponse.json(
                { success: false, error: 'Payout ID required' },
                { status: 400 }
            );
        }

        const xendit = getXenditClient();
        const { Payout } = xendit;

        const payout = await Payout.getPayoutById({ id: payoutId });

        return NextResponse.json({
            success: true,
            data: {
                id: payout.id,
                referenceId: payout.referenceId,
                status: payout.status,
                amount: payout.amount,
                channelCode: payout.channelCode,
                created: payout.created,
                updated: payout.updated,
                failureCode: payout.failureCode,
            },
        });

    } catch (error: any) {
        console.error('Xendit Get Payout Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to get payout status' },
            { status: 500 }
        );
    }
}
