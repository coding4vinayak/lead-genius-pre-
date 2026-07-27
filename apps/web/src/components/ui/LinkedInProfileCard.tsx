import { useSendConnectionRequest, useSendLinkedInMessage } from '../../hooks';
import { useState } from 'react';

interface LinkedInProfileCardProps {
  leadId: string;
  profile: {
    id: string;
    profileUrl: string;
    headline?: string;
    connectionStatus: string;
    connectionRequestedAt?: string;
    connectedAt?: string;
    lastMessagedAt?: string;
  } | null;
}

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

export default function LinkedInProfileCard({ leadId, profile }: LinkedInProfileCardProps) {
  const sendConnection = useSendConnectionRequest();
  const sendMessage = useSendLinkedInMessage();
  const [messageBody, setMessageBody] = useState('');

  const handleConnect = () => {
    sendConnection.mutate({ leadId });
  };

  const handleSendMessage = () => {
    if (!messageBody.trim()) return;
    sendMessage.mutate({ leadId, body: messageBody });
    setMessageBody('');
  };

  if (!profile) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">LinkedIn</h3>
        <p className="text-sm text-gray-500 mb-3">No LinkedIn profile linked</p>
        <button
          onClick={handleConnect}
          disabled={sendConnection.isPending}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {sendConnection.isPending ? 'Sending...' : 'Send Connection Request'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">LinkedIn</h3>
        <StatusBadge status={profile.connectionStatus} />
      </div>

      {profile.headline && (
        <p className="text-sm text-gray-600">{profile.headline}</p>
      )}

      <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block truncate">
        {profile.profileUrl}
      </a>

      {profile.connectionStatus === 'not_connected' && (
        <button
          onClick={handleConnect}
          disabled={sendConnection.isPending}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {sendConnection.isPending ? 'Sending...' : 'Connect'}
        </button>
      )}

      {profile.connectionStatus === 'connected' && (
        <div className="space-y-2">
          <textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Type a message..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={sendMessage.isPending || !messageBody.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {sendMessage.isPending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      )}

      <div className="text-xs text-gray-400 space-y-0.5">
        {profile.connectionRequestedAt && (
          <p>Requested: {new Date(profile.connectionRequestedAt).toLocaleDateString()}</p>
        )}
        {profile.connectedAt && (
          <p>Connected: {new Date(profile.connectedAt).toLocaleDateString()}</p>
        )}
        {profile.lastMessagedAt && (
          <p>Last activity: {new Date(profile.lastMessagedAt).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  );
}
