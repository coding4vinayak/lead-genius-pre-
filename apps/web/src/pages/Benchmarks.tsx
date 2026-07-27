import { useQuery } from '@tanstack/react-query';
import { Target, TrendingUp, Award, Lightbulb } from 'lucide-react';
import api from '../lib/api';
import { Card, PageHeader, StatCard, Badge, ErrorBanner, Skeleton, SkeletonCard, ProgressBar } from '../components/ui';

export default function Benchmarks() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['benchmarks'],
    queryFn: () => api.get('/analytics/benchmarks').then((r) => r.data.data),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const metrics = (data as Record<string, unknown>) || {};
  const comparisons = ((metrics.comparisons as Array<Record<string, unknown>>) || []);
  const suggestions = ((metrics.suggestions as Array<string>) || []);

  return (
    <div>
      <PageHeader title="Benchmarks" description="Compare your performance metrics against industry standards" />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Target size={20} />} label="Open Rate" value={`${metrics.openRate || 0}%`} />
          <StatCard icon={<TrendingUp size={20} />} label="Click Rate" value={`${metrics.clickRate || 0}%`} />
          <StatCard icon={<Award size={20} />} label="Reply Rate" value={`${metrics.replyRate || 0}%`} />
          <StatCard icon={<Lightbulb size={20} />} label="Score" value={`${metrics.score || 0}/100`} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Your Metrics vs. Industry</h3>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : comparisons.length === 0 ? (
            <p className="text-sm text-gray-500">No benchmark data available yet. Keep sending to build your metrics.</p>
          ) : (
            <div className="space-y-4">
              {comparisons.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{String(item.metric)}</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-[var(--color-primary)] font-medium">You: {String(item.yours)}%</span>
                      <span className="text-gray-400">Industry: {String(item.industry)}%</span>
                    </div>
                  </div>
                  <div className="relative">
                    <ProgressBar value={Number(item.yours) || 0} />
                    <div
                      className="absolute top-0 h-2 w-0.5 bg-gray-400"
                      style={{ left: `${Number(item.industry) || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Suggestions</h3>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-gray-500">No suggestions at this time. Your metrics look great!</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                  <Lightbulb size={16} className="text-yellow-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-700">{suggestion}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
