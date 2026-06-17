import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, TrendingUp, ShieldAlert } from 'lucide-react';
import { useAccountingStore } from '@/stores/accountingStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export const ParDashboard: React.FC = () => {
  const { 
    parMetrics, 
    parLoading, 
    parError, 
    lastParCalculation,
    fetchParMetrics 
  } = useAccountingStore();

  useEffect(() => {
    fetchParMetrics();
  }, [fetchParMetrics]);

  if (parLoading && !parMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio at Risk (PAR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (parError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            PAR Calculation Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{parError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchParMetrics()}
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getParStatus = (value: number) => {
    if (value === 0) return { color: 'bg-green-500', text: 'text-green-700', icon: CheckCircle2 };
    if (value < 5) return { color: 'bg-yellow-500', text: 'text-yellow-700', icon: TrendingUp };
    return { color: 'bg-red-500', text: 'text-red-700', icon: ShieldAlert };
  };

  const ParMetricCard = ({ 
    label, 
    value, 
    days 
  }: { 
    label: string; 
    value: number; 
    days: string 
  }) => {
    const status = getParStatus(value);
    const Icon = status.icon;

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">{label}</span>
          <Badge variant={value > 5 ? 'destructive' : value > 0 ? 'default' : 'secondary'}>
            {days}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${status.text}`} />
          <Progress value={Math.min(value, 100)} className="flex-1 h-2" />
          <span className={`text-lg font-bold ${status.text}`}>
            {value.toFixed(2)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Portfolio at Risk (PAR)</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {lastParCalculation 
                ? `Last updated: ${lastParCalculation.toLocaleString()}`
                : 'Not yet calculated'}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchParMetrics()}
            disabled={parLoading}
          >
            {parLoading ? 'Calculating...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ParMetricCard 
            label="PAR 30+" 
            value={parMetrics?.par30 || 0} 
            days="30 days"
          />
          <ParMetricCard 
            label="PAR 60+" 
            value={parMetrics?.par60 || 0} 
            days="60 days"
          />
          <ParMetricCard 
            label="PAR 90+" 
            value={parMetrics?.par90 || 0} 
            days="90 days"
          />
          <ParMetricCard 
            label="PAR 180+" 
            value={parMetrics?.par180 || 0} 
            days="180 days"
          />
        </div>

        {parMetrics && (
          <div className="border-t pt-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Provision</p>
                <p className="text-2xl font-bold text-gray-900">
                  MWK {parMetrics.totalProvision.toLocaleString(undefined, { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Coverage Ratio</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(parMetrics.coverageRatio * 100).toFixed(2)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {parMetrics.coverageRatio >= 1 
                    ? '✓ Adequate coverage' 
                    : '⚠ Insufficient coverage'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Portfolio Quality</p>
                <p className={`text-2xl font-bold ${
                  (parMetrics.par30 || 0) < 5 
                    ? 'text-green-600' 
                    : (parMetrics.par30 || 0) < 10 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                }`}>
                  {(parMetrics.par30 || 0) < 5 
                    ? 'Healthy' 
                    : (parMetrics.par30 || 0) < 10 
                      ? 'Moderate Risk' 
                      : 'High Risk'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
