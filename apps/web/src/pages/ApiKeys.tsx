import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, Copy, Check, BarChart3 } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Badge, PageHeader, EmptyState, ErrorBanner, Skeleton } from '../components/ui';

interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  requestCount: number;
  createdAt: string;
}

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; permissions: string[] }) =>
      api.post('/api-keys', body).then((r) => r.data.data),
    onSuccess: (result) => {
      setCreatedKey(result.key);
      setShowCreate(false);
      setNewKeyName('');
      setNewKeyPermissions([]);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const permissions = [
    'read:leads', 'write:leads', 'read:campaigns', 'write:campaigns',
    'read:templates', 'write:templates', 'read:messages', 'read:analytics',
  ];

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const togglePermission = (perm: string) => {
    setNewKeyPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const keys = (data as ApiKeyItem[]) || [];

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Manage API keys for programmatic access to the LeadGenius API"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} className="mr-1" />Create API Key
          </Button>
        }
      />

      {createdKey && (
        <Card className="p-4 mb-6 border-green-200 bg-green-50">
          <p className="text-sm font-medium text-green-800 mb-2">
            API key created successfully. Copy it now - it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded border text-sm font-mono text-gray-900 break-all">
              {createdKey}
            </code>
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          <button
            className="text-xs text-green-700 mt-2 underline"
            onClick={() => setCreatedKey(null)}
          >
            Dismiss
          </button>
        </Card>
      )}

      {showCreate && (
        <Card className="p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Create New API Key</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Key name (e.g., Production Integration)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {permissions.map((perm) => (
                  <button
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className={`px-2 py-1 text-xs rounded border ${
                      newKeyPermissions.includes(perm)
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMutation.mutate({ name: newKeyName, permissions: newKeyPermissions })}
                disabled={!newKeyName || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Key'}
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Your API Keys</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            title="No API keys"
            description="Create an API key to access the LeadGenius API programmatically"
          />
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center">
                    <Key size={16} className="text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{key.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{key.key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right mr-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <BarChart3 size={12} />
                      <span>{key.requestCount} requests</span>
                    </div>
                    {key.lastUsedAt && (
                      <p className="text-xs text-gray-400">
                        Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Badge variant={key.isActive ? 'success' : 'warning'}>
                    {key.isActive ? 'Active' : 'Revoked'}
                  </Badge>
                  {key.isActive && (
                    <button
                      onClick={() => revokeMutation.mutate(key.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      title="Revoke key"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">API Documentation</h3>
        <p className="text-sm text-gray-600 mb-3">
          View the full API documentation with request/response examples.
        </p>
        <a
          href="/api/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          Open API Documentation
        </a>
      </Card>
    </div>
  );
}
