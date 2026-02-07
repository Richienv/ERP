I'll search for comprehensive Xendit integration details specifically for Node.js/Next.js applications, focusing on disbursements (payouts).
Let me get more specific details on Xendit's latest API structure and requirements for disbursements.
Let me search for more specific information about the Node.js SDK and the difference between Disbursement and Payout APIs.
Perfect! Now I have all the details. Here's your **complete Xendit integration guide** for Next.js ERP specifically for bank transfers (disbursements/payouts):

---

## 🚀 **Xendit for Next.js ERP: Complete Implementation Guide**

### **Important: Choose the Right API**
Xendit has **two** APIs for sending money:
1. **Disbursement API** (Legacy) - Uses `bank_code`: `BCA`, `MANDIRI`
2. **Payout API v2** (Recommended) - Uses `channel_code`: `ID_BCA`, `ID_MANDIRI`, supports banks + e-wallets uniformly

**For new ERP apps, use Payout API v2** — it's the modern, unified API.

---

## 📋 **Step 1: Prerequisites & Setup**

### **What You Need:**
1. **Xendit Account** (register at xendit.co)
2. **Secret API Key** (Dashboard → Settings → Developers → API Keys)
3. **Webhook Callback Token** (for verifying webhooks)
4. **Callback URL** (for receiving payment status updates)

### **Environment Variables** (`.env.local`):
```env
# Xendit Configuration
XENDIT_SECRET_KEY=xnd_development_... # or xnd_production_...
XENDIT_WEBHOOK_TOKEN=your_callback_token_here
XENDIT_CALLBACK_URL=https://yourdomain.com/api/xendit/webhook

# Optional: For idempotency (prevents duplicate transfers)
XENDIT_IDEMPOTENCY_KEY_PREFIX=erp_payout_
```

### **Install SDK:**
```bash
npm install xendit-node uuid
npm install -D @types/uuid
```

---

## 🔧 **Step 2: Xendit Client Setup**

Create `lib/xendit.ts`:
```typescript
import { Xendit } from 'xendit-node';
import { v4 as uuidv4 } from 'uuid';

// Initialize Xendit client
const xenditClient = new Xendit({
  secretKey: process.env.XENDIT_SECRET_KEY!,
});

// Export specific services
export const { Payout } = xenditClient;

// Helper to generate idempotency key (prevents duplicate payouts)
export const generateIdempotencyKey = (reference: string) => {
  return `${process.env.XENDIT_IDEMPOTENCY_KEY_PREFIX || 'erp_'}${reference}_${uuidv4()}`;
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
  // E-wallets also use channel_code:
  OVO: 'ID_OVO',
  GOPAY: 'ID_GOPAY',
  DANA: 'ID_DANA',
  LINKAJA: 'ID_LINKAJA',
  SHOPEEPAY: 'ID_SHOPEEPAY',
} as const;

export type BankChannel = typeof BANK_CHANNELS[keyof typeof BANK_CHANNELS];
```

---

## 💸 **Step 3: Create Payout API Route**

Create `app/api/xendit/payout/route.ts` (App Router):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Payout, generateIdempotencyKey, BANK_CHANNELS } from '@/lib/xendit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { 
      reference_id,      // Your internal transaction ID
      channel_code,      // Bank channel (e.g., ID_BCA)
      account_number,    // Destination account number
      account_holder_name, // Must match bank records exactly
      amount,            // Amount in IDR
      description,       // Optional: appears in bank statement
      email_to,          // Optional: notify recipient via email
    } = body;

    // Validation
    if (!reference_id || !channel_code || !account_number || !account_holder_name || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      );
    }

    // Validate amount (min/max based on channel)
    if (amount < 10000) {
      return NextResponse.json(
        { error: 'Minimum payout is IDR 10,000' }, 
        { status: 400 }
      );
    }

    // Create payout using Payout API v2
    const payout = await Payout.createPayout({
      referenceId: reference_id,
      channelCode: channel_code,
      channelProperties: {
        accountNumber: account_number,
        accountHolderName: account_holder_name,
      },
      amount: amount,
      currency: 'IDR',
      description: description || 'ERP Payout',
      receiptNotification: email_to ? {
        emailTo: Array.isArray(email_to) ? email_to : [email_to],
      } : undefined,
      metadata: {
        source: 'nextjs_erp',
        timestamp: new Date().toISOString(),
      },
    }, {
      // Idempotency key prevents duplicate payouts if you retry
      headers: {
        'Idempotency-key': generateIdempotencyKey(reference_id),
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: payout.id,
        reference_id: payout.referenceId,
        status: payout.status, // ACCEPTED, PENDING, COMPLETED, FAILED
        amount: payout.amount,
        channel_code: payout.channelCode,
        created_at: payout.created,
      },
    });

  } catch (error: any) {
    console.error('Xendit Payout Error:', error);
    
    // Handle specific Xendit errors
    if (error.response?.data) {
      return NextResponse.json(
        { 
          error: 'Xendit API Error', 
          details: error.response.data,
          code: error.response.data.error_code 
        }, 
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message }, 
      { status: 500 }
    );
  }
}
```

---

## 📊 **Step 4: Batch Payout (Payroll/Supplier Payments)**

For ERP use cases paying multiple vendors at once, create `app/api/xendit/batch-payout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Payout, generateIdempotencyKey } from '@/lib/xendit';

interface PayoutItem {
  reference_id: string;
  channel_code: string;
  account_number: string;
  account_holder_name: string;
  amount: number;
  description?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { payouts }: { payouts: PayoutItem[] } = await req.json();

    if (!payouts || !Array.isArray(payouts) || payouts.length === 0) {
      return NextResponse.json(
        { error: 'Payouts array required' }, 
        { status: 400 }
      );
    }

    // Xendit doesn't have a true "batch" payout API v2 endpoint yet
    // So we process concurrently with Promise.allSettled
    const results = await Promise.allSettled(
      payouts.map(async (item) => {
        try {
          const payout = await Payout.createPayout({
            referenceId: item.reference_id,
            channelCode: item.channel_code,
            channelProperties: {
              accountNumber: item.account_number,
              accountHolderName: item.account_holder_name,
            },
            amount: item.amount,
            currency: 'IDR',
            description: item.description || 'Batch Payout',
          }, {
            headers: {
              'Idempotency-key': generateIdempotencyKey(item.reference_id),
            }
          });
          
          return {
            success: true,
            reference_id: item.reference_id,
            payout_id: payout.id,
            status: payout.status,
          };
        } catch (error: any) {
          return {
            success: false,
            reference_id: item.reference_id,
            error: error.response?.data?.message || error.message,
          };
        }
      })
    );

    // Process results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);

    return NextResponse.json({
      success: true,
      summary: {
        total: payouts.length,
        successful: successful.length,
        failed: failed.length,
      },
      results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason),
    });

  } catch (error: any) {
    console.error('Batch Payout Error:', error);
    return NextResponse.json(
      { error: 'Batch processing failed', message: error.message }, 
      { status: 500 }
    );
  }
}
```

---

## 🔔 **Step 5: Webhook Handler (Critical for ERP)**

Create `app/api/xendit/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db'; // Your database client

export async function POST(req: NextRequest) {
  try {
    // 1. Verify webhook authenticity
    const callbackToken = req.headers.get('x-callback-token');
    const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;

    if (!callbackToken || callbackToken !== expectedToken) {
      console.error('Invalid webhook token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse webhook payload
    const payload = await req.json();
    
    // Payout API v2 webhook payload structure:
    // {
    //   "id": "payout-123",
    //   "reference_id": "INV-001",
    //   "status": "COMPLETED", // ACCEPTED, PENDING, COMPLETED, FAILED
    //   "amount": 100000,
    //   "channel_code": "ID_BCA",
    //   "failure_code": null, // or "INSUFFICIENT_BALANCE", etc.
    //   "created": "2024-01-15T10:00:00Z",
    //   "updated": "2024-01-15T10:05:00Z",
    //   "metadata": { ... }
    // }

    const { 
      id, 
      reference_id, 
      status, 
      failure_code,
      amount,
      channel_code 
    } = payload;

    console.log(`Payout ${reference_id} updated to status: ${status}`);

    // 3. Update your database based on status
    switch (status) {
      case 'COMPLETED':
        await db.payouts.update({
          where: { reference_id },
          data: {
            status: 'completed',
            xendit_payout_id: id,
            completed_at: new Date(),
            bank_channel: channel_code,
          },
        });
        
        // Trigger post-payment logic (e.g., mark invoice as paid)
        await processCompletedPayout(reference_id, amount);
        break;

      case 'FAILED':
        await db.payouts.update({
          where: { reference_id },
          data: {
            status: 'failed',
            failure_code,
            failure_reason: getFailureReason(failure_code),
            xendit_payout_id: id,
          },
        });
        
        // Alert finance team
        await notifyPayoutFailure(reference_id, failure_code);
        break;

      case 'ACCEPTED':
      case 'PENDING':
        await db.payouts.update({
          where: { reference_id },
          data: {
            status: 'processing',
            xendit_payout_id: id,
          },
        });
        break;
    }

    // 4. Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    // Still return 200 to prevent Xendit from retrying indefinitely
    // But log the error for investigation
    return NextResponse.json({ received: true, error: 'Processing error logged' });
  }
}

// Helper functions
function getFailureReason(code: string): string {
  const reasons: Record<string, string> = {
    'INSUFFICIENT_BALANCE': 'Insufficient Xendit balance',
    'INVALID_ACCOUNT_NUMBER': 'Invalid bank account number',
    'ACCOUNT_NOT_FOUND': 'Bank account not found',
    'ACCOUNT_NAME_MISMATCH': 'Account name does not match bank records',
    'BANK_ERROR': 'Bank network error',
    'TEMPORARY_BANK_ERROR': 'Temporary bank issue - can retry',
  };
  return reasons[code] || `Unknown error: ${code}`;
}

async function processCompletedPayout(referenceId: string, amount: number) {
  // Your business logic here
  console.log(`Processing completed payout ${referenceId} for IDR ${amount}`);
}

async function notifyPayoutFailure(referenceId: string, failureCode: string) {
  // Send email/Slack notification
  console.error(`Payout ${referenceId} failed: ${failureCode}`);
}
```

**Webhook Setup in Xendit Dashboard:**
1. Go to **Settings → Webhooks**
2. Add URL: `https://yourdomain.com/api/xendit/webhook`
3. Select events: `payout.succeeded`, `payout.failed`, `payout.created`
4. Copy **Callback Token** to your `.env`

---

## 🧪 **Step 6: Testing in Sandbox**

### **Test API Route** (to verify integration):
Create `app/api/xendit/test/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { Payout, BANK_CHANNELS } from '@/lib/xendit';

export async function GET() {
  try {
    // Test payout to BCA (sandbox)
    const testPayout = await Payout.createPayout({
      referenceId: `TEST-${Date.now()}`,
      channelCode: BANK_CHANNELS.BCA,
      channelProperties: {
        accountNumber: '1234567890', // Test account
        accountHolderName: 'Test User',
      },
      amount: 50000,
      currency: 'IDR',
      description: 'Test payout from ERP',
    });

    return NextResponse.json({
      success: true,
      message: 'Test payout created',
      data: testPayout,
      // Sandbox account starts with IDR 1,000,000,000 balance
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.response?.data || error.message,
    }, { status: 500 });
  }
}
```

### **Test Scenarios:**

**Success Scenario:**
```bash
curl -X POST http://localhost:3000/api/xendit/payout \
  -H "Content-Type: application/json" \
  -d '{
    "reference_id": "INV-001",
    "channel_code": "ID_BCA",
    "account_number": "1234567890",
    "account_holder_name": "Budi Santoso",
    "amount": 100000,
    "description": "Vendor payment"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "payout_123456789",
    "reference_id": "INV-001",
    "status": "ACCEPTED",
    "amount": 100000,
    "channel_code": "ID_BCA"
  }
}
```

---

## 🔒 **Step 7: Security & Best Practices**

### **1. Idempotency (Prevent Double Payouts)**
Always use the `Idempotency-key` header. If you retry a failed request with the same key, Xendit won't process it twice.

### **2. Input Validation**
```typescript
// Validate bank account number format (varies by bank)
const bankValidators: Record<string, RegExp> = {
  'ID_BCA': /^\d{10}$/,
  'ID_MANDIRI': /^\d{13}$/,
  'ID_BNI': /^\d{10}$/,
  'ID_BRI': /^\d{15}$/,
};

// Validate account name matches (important for fraud prevention)
// Xendit validates this automatically for major banks
```

### **3. Error Handling**
Common error codes to handle:
- `INSUFFICIENT_BALANCE`: Top up your Xendit account
- `ACCOUNT_NAME_MISMATCH`: Vendor provided wrong account name
- `INVALID_ACCOUNT_NUMBER`: Wrong format/account doesn't exist
- `BANK_MAINTENANCE`: Bank is offline, retry later

### **4. Retry Logic**
```typescript
// Only retry on specific error codes
const retryableErrors = ['TEMPORARY_BANK_ERROR', 'TIMEOUT', 'BANK_MAINTENANCE'];

if (retryableErrors.includes(error.response?.data?.error_code)) {
  // Retry with exponential backoff
  await retryWithBackoff(() => createPayout(data));
}
```

---

## 💰 **Step 8: Fee Calculation Helper**

Create `lib/xendit-fees.ts`:

```typescript
// Xendit Disbursement fees (IDR 2,500 + 11% VAT = IDR 2,775)
const DISBURSEMENT_FEE = 2775;

export const calculatePayoutFees = (
  amount: number, 
  channelCode: string
): { fee: number; total: number; recipientGets: number } => {
  
  // Check if it's an e-wallet (usually free or different pricing)
  const isEwallet = ['ID_OVO', 'ID_GOPAY', 'ID_DANA', 'ID_LINKAJA', 'ID_SHOPEEPAY'].includes(channelCode);
  
  const fee = isEwallet ? 0 : DISBURSEMENT_FEE;
  
  return {
    fee,
    total: amount + fee, // What you pay
    recipientGets: amount, // What vendor receives
  };
};

// Validate minimum amounts
export const getMinAmount = (channelCode: string): number => {
  if (channelCode.startsWith('ID_')) return 10000; // IDR 10k for Indonesia
  return 10000;
};
```

---

## 📚 **Complete Bank Code Reference (Payout API v2)**

| Bank | Channel Code | Account Number Format |
|------|--------------|----------------------|
| BCA | `ID_BCA` | 10 digits |
| Mandiri | `ID_MANDIRI` | 13 digits |
| BNI | `ID_BNI` | 10 digits |
| BRI | `ID_BRI` | 15 digits |
| Permata | `ID_PERMATA` | 10 digits |
| CIMB Niaga | `ID_CIMB` | 13 digits |
| BSI | `ID_BSI` | 10 digits |
| BTN | `ID_BTN` | 11 digits |
| Danamon | `ID_DANAMON` | 10 digits |
| Maybank | `ID_MAYBANK` | 10-11 digits |
| **E-Wallets** | | |
| OVO | `ID_OVO` | 08xxxxxxxxxx (phone) |
| GoPay | `ID_GOPAY` | 08xxxxxxxxxx (phone) |
| DANA | `ID_DANA` | 08xxxxxxxxxx (phone) |
| LinkAja | `ID_LINKAJA` | 08xxxxxxxxxx (phone) |
| ShopeePay | `ID_SHOPEEPAY` | 08xxxxxxxxxx (phone) |

---

## 🎯 **ERP Integration Checklist**

- [ ] **Account Setup**: Xendit business account activated (not just registered)
- [ ] **KYC Complete**: Business documents submitted and approved
- [ ] **Top Up**: Fund your Xendit balance (Live mode requires real money)
- [ ] **API Keys**: Separate keys for Test and Live modes
- [ ] **Webhooks**: Callback URL configured in Dashboard
- [ ] **Idempotency**: Implemented in all payout calls
- [ ] **Error Handling**: Retry logic for transient failures
- [ ] **Logging**: All transactions logged with reference_id
- [ ] **Reconciliation**: Daily matching of Xendit reports vs your database
- [ ] **Alerts**: Notifications for failed payouts

---

## 🆘 **Support & Resources**

- **Xendit Node SDK**: https://github.com/xendit/xendit-node
- **API Reference**: https://developers.xendit.co/api-reference/#payouts
- **Test Mode**: Pre-loaded with IDR 1,000,000,000 (fake money)
- **Support**: help@xendit.co (Indonesia)

Need help with specific ERP features like scheduled payouts, approval workflows, or multi-tenancy? Let me know!