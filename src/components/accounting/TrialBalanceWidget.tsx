import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useAccountingStore } from '@/stores/accountingStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export const TrialBalanceWidget: React.FC = () => {
  const { 
    trialBalance, 
    trialBalanceLoading, 
    isBooksBalanced,
    verifyTrialBalance 
  } = useAccountingStore();

  useEffect(() => {
    verifyTrialBalance();
  }, [verifyTrialBalance]);

  if (trialBalanceLoading && !trialBalance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance Check</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={
      isBooksBalanced === true 
        ? 'border-green-200 bg-green-50' 
        : isBooksBalanced === false 
          ? 'border-red-200 bg-red-50' 
          : ''
    }>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            {isBooksBalanced === true ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : isBooksBalanced === false ? (
              <XCircle className="h-6 w-6 text-red-600" />
            ) : (
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            )}
            Trial Balance Status
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => verifyTrialBalance()}
            disabled={trialBalanceLoading}
          >
            {trialBalanceLoading ? 'Checking...' : 'Verify Now'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isBooksBalanced === true ? (
          <div className="space-y-2">
            <p className="text-green-800 font-medium">✓ Books are balanced</p>
            <p className="text-sm text-green-600">
              Debits equal credits as of today
            </p>
          </div>
        ) : isBooksBalanced === false ? (
          <div className="space-y-2">
            <p className="text-red-800 font-medium">✗ Books are NOT balanced</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="destructive">
                Difference: MWK {Math.abs(trialBalance?.difference || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </Badge>
            </div>
            <p className="text-sm text-red-600 mt-2">
              Immediate investigation required. Check recent journal entries and repayments.
            </p>
          </div>
        ) : (
          <p className="text-yellow-800">Status unknown. Click "Verify Now" to check.</p>
        )}
      </CardContent>
    </Card>
  );
};
