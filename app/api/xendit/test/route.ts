import { NextResponse } from 'next/server';
import { getXenditClient, BANK_CHANNELS } from '@/lib/xendit';

// GET: Test Xendit connection and create a test payout (sandbox only)
export async function GET() {
    try {
        // Check if Xendit is configured
        const secretKey = process.env.XENDIT_SECRET_KEY;

        if (!secretKey) {
            return NextResponse.json({
                success: false,
                error: 'XENDIT_SECRET_KEY is not configured',
                setup: {
                    step: 1,
                    instruction: 'Add XENDIT_SECRET_KEY to your .env file',
                    example: 'XENDIT_SECRET_KEY=xnd_development_XXXXXXXX'
                }
            }, { status: 400 });
        }

        const isProduction = secretKey.startsWith('xnd_production_');
        const isSandbox = secretKey.startsWith('xnd_development_');

        if (!isProduction && !isSandbox) {
            return NextResponse.json({
                success: false,
                error: 'Invalid Xendit API key format',
                expected: 'Key should start with xnd_development_ or xnd_production_'
            }, { status: 400 });
        }

        // Try to initialize the client
        const xendit = getXenditClient();

        return NextResponse.json({
            success: true,
            message: 'Xendit is configured correctly',
            environment: isProduction ? 'PRODUCTION' : 'SANDBOX',
            warning: isProduction ? '⚠️ You are using PRODUCTION keys - real money will be transferred!' : null,
            availableBanks: Object.keys(BANK_CHANNELS),
            webhookConfigured: !!process.env.XENDIT_WEBHOOK_TOKEN,
            nextSteps: [
                '1. Visit /finance/bills to see the payment interface',
                '2. Create a vendor bill and try the payment flow',
                '3. Configure webhook URL in Xendit Dashboard: ' + (process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com') + '/api/xendit/webhook'
            ]
        });

    } catch (error: any) {
        console.error('Xendit Test Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to initialize Xendit',
            details: error.rawResponse ? JSON.parse(error.rawResponse) : null
        }, { status: 500 });
    }
}
