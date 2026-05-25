import { useState } from 'react';
import { useLinkedInConnections } from '../hooks';

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Not Connected', value: 'not_connected' },
  { label: 'Pending', value: 'pending' },
  { label: 'Connected', value: 'connected' },
  { label: 'Declined', value: 'declined' },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_connected: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
    connected: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    not_connected: 'Not Connected',
    pending: 'Pending',
    connected: 'Connected',
    declined: 'Declined',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  );
}

export default function LinkedIn() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useLinkedInConnections({ status: statusFilter || undefined, page, pageSize: 50 });

  const connections = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, pageSize: 50, totalPages: 1 };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LinkedIn</h1>
        <p className="mt-1 text-sm text-gray-500">Manage LinkedIn connections and outreach</p>
      </div>

      <div className="flex items-center gap-3">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-shimmer" />
          ))}
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No LinkedIn connections found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Profile URL</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Requested</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {connections.map((conn: Record<string, unknown>) => (
                <tr key={conn.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {(conn.lead as Record<string, unknown>)?.name as string || (conn.lead as Record<string, unknown>)?.email as string || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <a href={conn.profileUrl as string} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px] inline-block">
                      {conn.profileUrl as string}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={conn.connectionStatus as string} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {conn.connectionRequestedAt ? new Date(conn.connectionRequestedAt as string).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {conn.lastMessagedAt ? new Date(conn.lastMessagedAt as string).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{meta.total} connections</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
