import { useEnrichLead, useEnrichmentHistory } from '../../hooks';

interface EnrichmentPanelProps {
  leadId: string;
}

export default function EnrichmentPanel({ leadId }: EnrichmentPanelProps) {
  const enrichMutation = useEnrichLead();
  const { data: historyData, isLoading } = useEnrichmentHistory(leadId);

  const history = historyData?.data || [];

  const handleEnrich = () => {
    enrichMutation.mutate({ id: leadId });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Enrichment Data</h3>
        <button
          onClick={handleEnrich}
          disabled={enrichMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {enrichMutation.isPending ? 'Enriching...' : 'Enrich'}
        </button>
      </div>

      {enrichMutation.isError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
          Failed to enrich lead. Please try again.
        </div>
      )}

      {enrichMutation.isSuccess && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded">
          Lead enriched successfully.
        </div>
      )}

      {isLoading && <p className="text-gray-500">Loading enrichment history...</p>}

      {!isLoading && history.length === 0 && (
        <p className="text-gray-500">No enrichment data available. Click "Enrich" to get started.</p>
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          {history.map((entry: { id: string; provider: string; status: string; responseData: Record<string, unknown> | null; createdAt: string }) => (
            <div key={entry.id} className="border rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium capitalize">{entry.provider.replace('-', ' ')}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  entry.status === 'completed' ? 'bg-green-100 text-green-700' :
                  entry.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {entry.status}
                </span>
              </div>
              {entry.responseData && (
                <div className="text-sm text-gray-600">
                  {Object.entries(entry.responseData).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium">{key}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {new Date(entry.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
