import { useState } from 'react';
import { useAssignmentRules } from '../hooks';
import api from '../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface AssignmentRule {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export default function AssignmentRules() {
  const { data, isLoading } = useAssignmentRules();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('round_robin');
  const [priority, setPriority] = useState(0);

  const createRule = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/assignment-rules', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rules'] });
      setShowForm(false);
      setName('');
    },
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => api.delete(`/assignment-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignment-rules'] }),
  });

  const toggleRule = useMutation({
    mutationFn: (rule: AssignmentRule) =>
      api.put(`/assignment-rules/${rule.id}`, { ...rule, isActive: !rule.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignment-rules'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createRule.mutate({ name, type, config: {}, isActive: true, priority });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assignment Rules</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'New Rule'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-gray-200 p-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rule name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="round_robin">Round Robin</option>
            <option value="territory">Territory</option>
            <option value="load_balanced">Load Balanced</option>
          </select>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
            placeholder="Priority (lower = first)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={createRule.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create Rule
          </button>
        </form>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      <div className="space-y-3">
        {data?.data?.map((rule: AssignmentRule) => (
          <div key={rule.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <h3 className="text-sm font-medium">{rule.name}</h3>
              <p className="text-xs text-gray-500">
                Type: {rule.type} | Priority: {rule.priority} | {rule.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleRule.mutate(rule)}
                className={`rounded px-3 py-1 text-xs font-medium ${rule.isActive ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}
              >
                {rule.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => deleteRule.mutate(rule.id)}
                className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {(!data?.data || data.data.length === 0) && !isLoading && (
          <p className="text-sm text-gray-500">No assignment rules configured</p>
        )}
      </div>
    </div>
  );
}
