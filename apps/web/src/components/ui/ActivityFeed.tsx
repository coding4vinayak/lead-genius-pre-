import { useLeadActivity } from '../../hooks';
import {
  MessageSquare, UserPlus, UserMinus, GitBranch, Send, Inbox, Sparkles, Tag, Plus,
} from 'lucide-react';

interface ActivityFeedProps {
  leadId: string;
}

const activityIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  note_added: MessageSquare,
  assigned: UserPlus,
  unassigned: UserMinus,
  stage_changed: GitBranch,
  message_sent: Send,
  message_received: Inbox,
  enriched: Sparkles,
  tag_added: Tag,
  tag_removed: Tag,
  created: Plus,
};

export default function ActivityFeed({ leadId }: ActivityFeedProps) {
  const { data, isLoading } = useLeadActivity(leadId);

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading activity...</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Activity</h3>
      <div className="space-y-3">
        {data?.data?.map((activity: { id: string; activityType: string; description: string; createdAt: string }) => {
          const Icon = activityIcons[activity.activityType] || MessageSquare;
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-gray-100 p-1.5">
                <Icon size={14} className="text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-800">{activity.description}</p>
                <span className="text-xs text-gray-500">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
        {(!data?.data || data.data.length === 0) && (
          <p className="text-sm text-gray-500">No activity yet</p>
        )}
      </div>
    </div>
  );
}
