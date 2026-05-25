import { useState } from 'react';
import { useLeadNotes, useCreateNote } from '../../hooks';

interface LeadNotesProps {
  leadId: string;
}

export default function LeadNotes({ leadId }: LeadNotesProps) {
  const [body, setBody] = useState('');
  const { data, isLoading } = useLeadNotes(leadId);
  const createNote = useCreateNote();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    createNote.mutate({ leadId, body }, {
      onSuccess: () => setBody(''),
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Notes</h3>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note... (use @name to mention)"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={createNote.isPending || !body.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {isLoading && <p className="text-sm text-gray-500">Loading notes...</p>}
      <div className="space-y-3">
        {data?.data?.map((note: { id: string; body: string; author?: { name?: string; email: string }; createdAt: string; mentions: string[] }) => (
          <div key={note.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                {note.author?.name || note.author?.email || 'Unknown'}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(note.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-700">{note.body}</p>
            {note.mentions.length > 0 && (
              <div className="mt-1 flex gap-1">
                {note.mentions.map((m: string) => (
                  <span key={m} className="text-xs text-blue-600">@{m}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
