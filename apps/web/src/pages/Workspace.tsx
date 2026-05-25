import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, Shield, Mail } from 'lucide-react';
import api from '../lib/api';
import { Card, Button, Badge, PageHeader, StatCard, ErrorBanner, EmptyState, Skeleton, SkeletonCard } from '../components/ui';

export default function Workspace() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => api.get('/workspace').then((r) => r.data.data),
  });

  const members = useQuery({
    queryKey: ['workspace-members'],
    queryFn: () => api.get('/workspace/members').then((r) => r.data.data),
  });

  if (error) return <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />;

  const memberList = (members.data as Array<Record<string, unknown>>) || [];

  return (
    <div>
      <PageHeader
        title="Workspace"
        description="Manage team members, invites, and roles"
        action={<Button><UserPlus size={16} className="mr-1" />Invite Member</Button>}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<Users size={20} />} label="Team Members" value={memberList.length} />
          <StatCard icon={<Shield size={20} />} label="Admins" value={memberList.filter((m) => m.role === 'admin').length} />
          <StatCard icon={<Mail size={20} />} label="Pending Invites" value={data?.pendingInvites || 0} />
        </div>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Team Members</h3>
        {members.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : memberList.length === 0 ? (
          <EmptyState title="No team members" description="Invite your team to collaborate" />
        ) : (
          <div className="space-y-3">
            {memberList.map((member, idx) => (
              <div key={idx} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center text-sm font-medium text-[var(--color-primary)]">
                    {String(member.name || member.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{String(member.name || member.email)}</p>
                    <p className="text-xs text-gray-500">{String(member.email || '')}</p>
                  </div>
                </div>
                <Badge variant={member.role === 'admin' ? 'info' : 'default'}>{String(member.role || 'member')}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
