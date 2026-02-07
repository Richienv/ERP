import { NextResponse } from 'next/server';
import { getAvailableBanks } from '@/lib/xendit';

// GET: Return list of available banks for dropdown
export async function GET() {
    try {
        const banks = getAvailableBanks();

        // Separate banks and e-wallets
        const bankList = banks.filter(b => !b.isEwallet);
        const ewalletList = banks.filter(b => b.isEwallet);

        return NextResponse.json({
            success: true,
            data: {
                banks: bankList,
                ewallets: ewalletList,
                all: banks,
            },
        });

    } catch (error: any) {
        console.error('Get Banks Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to get banks' },
            { status: 500 }
        );
    }
}
