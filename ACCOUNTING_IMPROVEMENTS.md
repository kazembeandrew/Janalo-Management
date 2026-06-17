# Accounting System Improvements - Implementation Guide

## Overview
This document outlines the comprehensive improvements made to the Janalo microfinance accounting system, implementing proper service layer architecture, real-time PAR monitoring, automated trial balance verification, and cross-tab data synchronization.

## Files Created/Modified

### 1. Service Layer (`src/services/accounting.ts`)
**Purpose**: Centralized accounting operations with typed interfaces and atomic RPC calls.

**Key Functions**:
- `processRepayment()` - Atomic repayment processing with journal entries
- `disburseLoan()` - Loan disbursement with proper accounting
- `bulkDisburseLoans()` - Batch disbursement for performance
- `verifyTrialBalance()` - Real-time books balancing check
- `calculateParMetrics()` - Portfolio at Risk calculation
- `getChartOfAccounts()` - Account hierarchy with balances
- `postManualJournalEntry()` - Manual adjustments with validation

**Usage Example**:
```typescript
import * as accounting from '@/services/accounting';

const result = await accounting.processRepayment(
  loanId,
  amount,
  paymentDate,
  'mobile',
  accountId,
  userId,
  'Monthly installment'
);

if (result.success) {
  toast.success('Repayment processed');
} else {
  toast.error(result.error);
}
```

### 2. Global State Store (`src/stores/accountingStore.ts`)
**Purpose**: Centralized state management with cross-tab synchronization.

**Features**:
- PAR metrics caching and auto-refresh
- Trial balance status tracking
- Chart of accounts storage
- BroadcastChannel for cross-tab updates
- Auto-refresh mechanism (5-minute intervals)

**State Structure**:
```typescript
{
  parMetrics: ParMetrics | null,
  parLoading: boolean,
  parError: string | null,
  lastParCalculation: Date | null,
  
  trialBalance: TrialBalanceCheck | null,
  trialBalanceLoading: boolean,
  isBooksBalanced: boolean | null,
  
  accounts: any[],
  accountsLoading: boolean
}
```

**Usage in Components**:
```typescript
import { useAccountingStore } from '@/stores/accountingStore';

const MyComponent = () => {
  const { parMetrics, fetchParMetrics } = useAccountingStore();
  
  useEffect(() => {
    fetchParMetrics();
  }, []);
  
  return <div>PAR 30+: {parMetrics?.par30}%</div>;
};
```

### 3. PAR Dashboard Component (`src/components/accounting/ParDashboard.tsx`)
**Purpose**: Visual display of portfolio quality metrics.

**Features**:
- PAR 30/60/90/180 days breakdown
- Color-coded risk indicators (green/yellow/red)
- Total provision amount display
- Coverage ratio calculation
- Portfolio quality assessment
- Manual refresh button
- Loading states and error handling

**Integration**:
```typescript
import { ParDashboard } from '@/components/accounting';

// In your dashboard page
<ParDashboard />
```

### 4. Trial Balance Widget (`src/components/accounting/TrialBalanceWidget.tsx`)
**Purpose**: Real-time accounting integrity monitoring.

**Features**:
- Instant balanced/unbalanced status
- Difference amount display when unbalanced
- One-click verification
- Color-coded status (green/red/yellow)
- Actionable error messages

**Integration**:
```typescript
import { TrialBalanceWidget } from '@/components/accounting';

// In your financial management page
<TrialBalanceWidget />
```

### 5. Database Migration (`supabase/migrations/20260315100000_accounting_enhancements.sql`)
**Purpose**: Enhanced database functions and views for accounting operations.

**Components**:
1. **`calculate_par_and_provision()` function**
   - Loops through all active/defaulted loans
   - Calculates days overdue
   - Applies Malawi banking provision rates (25%/50%/75%/100%)
   - Creates provision adjustment records
   - Generates corresponding journal entries

2. **`verify_trial_balance()` function**
   - Calculates total debits and credits
   - Returns balanced status with difference amount
   - Includes entry count and detailed JSON

3. **`loan_portfolios` view**
   - Aggregates PAR metrics across all loans
   - Calculates coverage ratio
   - Provides single-query access to portfolio health

4. **Performance indexes**
   - `idx_loans_next_payment_status` - For PAR calculation
   - `idx_loan_provisions_loan_date` - For provision history
   - `idx_journal_entries_date_range` - For trial balance

## Installation Steps

### Step 1: Install Dependencies
```bash
npm install zustand broadcast-channel
```

### Step 2: Apply Database Migration
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260315100000_accounting_enhancements.sql`
3. Paste and run
4. Verify with test queries:
```sql
SELECT calculate_par_and_provision();
SELECT * FROM loan_portfolios;
SELECT * FROM verify_trial_balance(CURRENT_DATE);
```

### Step 3: Integrate Components
Add to your main dashboard (e.g., `src/pages/Dashboard.tsx`):

```typescript
import { ParDashboard, TrialBalanceWidget } from '@/components/accounting';

export const Dashboard = () => {
  return (
    <div className="space-y-6">
      <ParDashboard />
      <TrialBalanceWidget />
      {/* Other dashboard widgets */}
    </div>
  );
};
```

### Step 4: Update Existing Pages
Replace direct Supabase calls in pages like `LoanDetails.tsx`:

**Before**:
```typescript
const { data, error } = await supabase.rpc('process_repayment', {
  p_loan_id: loan.id,
  p_amount: amount,
  // ...
});
```

**After**:
```typescript
import * as accounting from '@/services/accounting';

const result = await accounting.processRepayment(
  loan.id,
  amount,
  paymentDate,
  paymentMethod,
  accountId,
  profile.id,
  notes
);
```

## Architecture Benefits

### 1. Separation of Concerns
- Services handle data operations
- Components handle UI rendering
- Store handles state management
- Clear boundaries between layers

### 2. Type Safety
- All functions have typed inputs/outputs
- No more `any` types in accounting operations
- Compile-time error detection

### 3. Cross-Tab Synchronization
- BroadcastChannel ensures all tabs see same data
- Critical for multi-user environments
- Prevents stale data issues

### 4. Performance
- Indexed queries for fast PAR calculation
- Cached state reduces API calls
- Bulk operations for batch processing

### 5. Reliability
- Atomic transactions prevent partial updates
- Automatic retry logic
- Comprehensive error handling

## Testing Checklist

### Unit Tests (to be implemented)
```typescript
// src/services/__tests__/accounting.test.ts
describe('Accounting Service', () => {
  test('processRepayment rejects negative amounts', async () => {
    const result = await accounting.processRepayment(/* ... */);
    expect(result.success).toBe(false);
  });
  
  test('verifyTrialBalance returns balanced for empty ledger', async () => {
    const result = await accounting.verifyTrialBalance('2024-01-01');
    expect(result.isBalanced).toBe(true);
  });
});
```

### Integration Tests
1. Process repayment → Check journal entries created
2. Disburse loan → Verify principal outstanding updated
3. Calculate PAR → Confirm provisions created
4. Multi-tab test → Open two tabs, process repayment in one, verify other updates

### Manual Testing
- [ ] Process repayment for on-time loan
- [ ] Process repayment for overdue loan
- [ ] Disburse single loan
- [ ] Bulk disburse 10+ loans
- [ ] Verify trial balance shows balanced
- [ ] Create manual journal entry with imbalance (should fail)
- [ ] Check PAR dashboard shows correct percentages
- [ ] Open two browser tabs, verify cross-tab sync works

## Monitoring & Alerts

### Recommended Alerts
1. **Trial Balance Imbalance**
   - Trigger: `isBooksBalanced === false`
   - Action: Immediate notification to finance manager
   
2. **High PAR Ratio**
   - Trigger: `par30 > 10%`
   - Action: Weekly report to CEO/board

3. **Low Coverage Ratio**
   - Trigger: `coverageRatio < 1.0`
   - Action: Monthly review with auditors

### Dashboard Metrics to Track
- Daily PAR trend (30-day moving average)
- Provision expense month-over-month
- Trial balance verification frequency
- Repayment processing success rate

## Regulatory Compliance

### Malawi Banking Regulations
This implementation follows Reserve Bank of Malawi guidelines:
- PAR classification: 30/60/90/180 days
- Provision rates: 25%/50%/75%/100%
- Daily trial balance verification
- Complete audit trail via journal entries

### IFRS 9 Compliance
- Expected credit loss modeling via PAR-based provisioning
- Forward-looking information incorporation (via field officer visits)
- Staging mechanism (current/watchlist/substandard/doubtful/loss)

## Next Steps

### Phase 1 (Immediate)
- [ ] Apply database migration
- [ ] Install dependencies
- [ ] Test in staging environment

### Phase 2 (Week 1-2)
- [ ] Replace all direct Supabase calls in loan pages
- [ ] Add PAR dashboard to main dashboard
- [ ] Train staff on new trial balance widget

### Phase 3 (Week 3-4)
- [ ] Implement automated daily PAR calculation job
- [ ] Add email alerts for trial balance failures
- [ ] Create monthly provisioning report

### Phase 4 (Month 2)
- [ ] Build write-off recovery interface
- [ ] Add liquidity monitoring widget
- [ ] Implement stress testing scenarios

## Troubleshooting

### Common Issues

**Issue**: PAR metrics show null
- **Cause**: `calculate_par_and_provision()` not run
- **Fix**: Manually trigger via SQL or refresh button

**Issue**: Trial balance always unbalanced
- **Cause**: Historical data without proper journal entries
- **Fix**: Run data reconciliation script to create opening balances

**Issue**: Cross-tab sync not working
- **Cause**: BroadcastChannel not supported in browser
- **Fix**: Check browser compatibility, fallback to polling

**Issue**: Slow PAR calculation
- **Cause**: Missing database indexes
- **Fix**: Verify indexes were created, run ANALYZE on tables

## Support

For issues or questions:
1. Check this documentation first
2. Review error logs in browser console
3. Verify database functions exist in Supabase
4. Contact development team with specific error messages

---

**Last Updated**: March 15, 2024
**Version**: 1.0.0
**Author**: Development Team
