import React from 'react';
import { Brain, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { DashboardWidget } from './DashboardWidget';
import { useCache } from '@/utils/cache';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';

interface AIInsight {
  id: string;
  type: 'trend' | 'warning' | 'opportunity' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  createdAt: string;
}

interface AIInsightsResponse {
  insights: AIInsight[];
  summary: string;
  confidence: number;
}

const fetchAIInsights = async (): Promise<AIInsightsResponse> => {
  // This would call your AI service
  const { data, error } = await supabase.functions.invoke('ai-insights', {
    body: { type: 'dashboard_summary' }
  });
  
  if (error) throw error;
  return data;
};

export const AIInsightsWidget: React.FC = () => {
  const { data: insightsData, loading, error, refetch } = useCache(
    'ai-insights-dashboard',
    fetchAIInsights,
    10 * 60 * 1000, // 10 minutes cache
    // @ts-ignore - using specific cache instance
    import('@/utils/cache').then(m => m.aiInsightsCache)
  );

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-4 w-4 text-blue-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'opportunity':
        return <Lightbulb className="h-4 w-4 text-green-600" />;
      case 'recommendation':
        return <Brain className="h-4 w-4 text-purple-600" />;
      default:
        return <Brain className="h-4 w-4 text-gray-600" />;
    }
  };

  const getImpactColor = (impact: AIInsight['impact']) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <DashboardWidget
      id="ai-insights"
      title="AI Insights"
      loading={loading}
      error={error?.message}
      onRefresh={refetch}
    >
      {insightsData && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
            <div className="flex items-center space-x-2 mb-2">
              <Brain className="h-5 w-5 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-900">Summary</span>
              <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
                {Math.round(insightsData.confidence * 100)}% confidence
              </span>
            </div>
            <p className="text-sm text-indigo-700">{insightsData.summary}</p>
          </div>

          {/* Insights List */}
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {insightsData.insights.map((insight) => (
              <div
                key={insight.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {insight.title}
                      </h4>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full border',
                        getImpactColor(insight.impact)
                      )}>
                        {insight.impact}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{insight.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {new Date(insight.createdAt).toLocaleDateString()}
                      </span>
                      {insight.actionable && (
                        <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                          Take Action →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
            <div className="text-center p-2">
              <div className="text-lg font-bold text-gray-900">
                {insightsData.insights.filter(i => i.impact === 'high').length}
              </div>
              <div className="text-xs text-gray-500">High Priority</div>
            </div>
            <div className="text-center p-2">
              <div className="text-lg font-bold text-gray-900">
                {insightsData.insights.filter(i => i.actionable).length}
              </div>
              <div className="text-xs text-gray-500">Actionable</div>
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  );
};
