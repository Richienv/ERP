import Xendit from 'xendit-node';
import { createHash } from 'crypto';

// Initialize Xendit client (lazy initialization)
let xenditClient: Xendit | null = null;

export const getXenditClient = () => {
    if (!xenditClient) {
        const secretKey = process.env.XENDIT_SECRET_KEY;
        if (!secretKey) {
            throw new Error('XENDIT_SECRET_KEY is not configured');
        }
        xenditClient = new Xendit({ secretKey });
    }
    return xenditClient;
};

// Helper to generate idempotency key (prevents duplicate payouts)
// Uses deterministic SHA-256 hash so the same reference always produces the same key
export const generateIdempotencyKey = (reference: string) => {
    const hash = createHash('sha256').update(reference).digest('hex');
    return `erp_payout_${hash}`;
};

// Bank Channel Codes for Indonesia (Payout API v2)
export const BANK_CHANNELS = {
    BCA: 'ID_BCA',
    MANDIRI: 'ID_MANDIRI',
    BNI: 'ID_BNI',
    BRI: 'ID_BRI',
    PERMATA: 'ID_PERMATA',
    CIMB: 'ID_CIMB',
    BSI: 'ID_BSI',
    BTN: 'ID_BTN',
    DANAMON: 'ID_DANAMON',
    MAYBANK: 'ID_MAYBANK',
    // E-wallets
    OVO: 'ID_OVO',
    GOPAY: 'ID_GOPAY',
    DANA: 'ID_DANA',
    LINKAJA: 'ID_LINKAJA',
    SHOPEEPAY: 'ID_SHOPEEPAY',
} as const;

export type BankChannelKey = keyof typeof BANK_CHANNELS;
export type BankChannelCode = typeof BANK_CHANNELS[BankChannelKey];

// Human-readable bank names
export const BANK_NAMES: Record<BankChannelKey, string> = {
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
};

// Account number validation patterns
export const ACCOUNT_PATTERNS: Record<string, { pattern: RegExp; description: string }> = {
    'ID_BCA': { pattern: /^\d{10}$/, description: '10 digits' },
    'ID_MANDIRI': { pattern: /^\d{13}$/, description: '13 digits' },
    'ID_BNI': { pattern: /^\d{10}$/, description: '10 digits' },
    'ID_BRI': { pattern: /^\d{15}$/, description: '15 digits' },
    'ID_PERMATA': { pattern: /^\d{10}$/, description: '10 digits' },
    'ID_CIMB': { pattern: /^\d{13}$/, description: '13 digits' },
    'ID_BSI': { pattern: /^\d{10}$/, description: '10 digits' },
    'ID_BTN': { pattern: /^\d{11}$/, description: '11 digits' },
    'ID_DANAMON': { pattern: /^\d{10}$/, description: '10 digits' },
    'ID_MAYBANK': { pattern: /^\d{10,11}$/, description: '10-11 digits' },
    // E-wallets use phone numbers
    'ID_OVO': { pattern: /^08\d{8,11}$/, description: 'Phone number (08xx)' },
    'ID_GOPAY': { pattern: /^08\d{8,11}$/, description: 'Phone number (08xx)' },
    'ID_DANA': { pattern: /^08\d{8,11}$/, description: 'Phone number (08xx)' },
    'ID_LINKAJA': { pattern: /^08\d{8,11}$/, description: 'Phone number (08xx)' },
    'ID_SHOPEEPAY': { pattern: /^08\d{8,11}$/, description: 'Phone number (08xx)' },
};

// Fee calculation (IDR 2,500 + 11% VAT = IDR 2,775)
const DISBURSEMENT_FEE = 2775;

export const calculatePayoutFees = (amount: number, channelCode: string) => {
    const isEwallet = ['ID_OVO', 'ID_GOPAY', 'ID_DANA', 'ID_LINKAJA', 'ID_SHOPEEPAY'].includes(channelCode);
    const fee = isEwallet ? 0 : DISBURSEMENT_FEE;

    return {
        fee,
        total: amount + fee,
        recipientGets: amount,
    };
};

// Minimum payout amount
export const getMinAmount = (channelCode: string): number => {
    return 10000; // IDR 10,000 minimum
};

// Payout status types
export type PayoutStatus = 'ACCEPTED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'VOIDED';

// Interface for payout request
export interface PayoutRequest {
    referenceId: string;
    channelCode: BankChannelCode;
    accountNumber: string;
    accountHolderName: string;
    amount: number;
    description?: string;
    emailTo?: string[];
    metadata?: Record<string, any>;
}

// Interface for payout response
export interface PayoutResponse {
    id: string;
    referenceId: string;
    status: PayoutStatus;
    amount: number;
    channelCode: string;
    created: string;
    updated?: string;
    failureCode?: string;
}

// Validate account number format
export const validateAccountNumber = (channelCode: string, accountNumber: string): boolean => {
    const validator = ACCOUNT_PATTERNS[channelCode];
    if (!validator) return true; // Unknown channel, skip validation
    return validator.pattern.test(accountNumber);
};

// Get channel code from bank name/code
export const getChannelCode = (bankKey: string): BankChannelCode | null => {
    const upperKey = bankKey.toUpperCase() as BankChannelKey;
    return BANK_CHANNELS[upperKey] || null;
};

// Get list of available banks for dropdown
export const getAvailableBanks = () => {
    const ewalletKeys = ['OVO', 'GOPAY', 'DANA', 'LINKAJA', 'SHOPEEPAY'];
    return Object.entries(BANK_CHANNELS).map(([key, code]) => ({
        key: key as BankChannelKey,
        code,
        name: BANK_NAMES[key as BankChannelKey],
        isEwallet: ewalletKeys.includes(key),
    }));
};
