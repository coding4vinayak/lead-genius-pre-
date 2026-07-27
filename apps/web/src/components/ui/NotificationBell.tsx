import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import api from '../../lib/api';
import { useNotificationStore } from '../../store/notifications';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { notifications, unreadCount, setNotifications, setUnreadCount, markRead, markAllRead } = useNotificationStore();

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get('/notifications?page=1&pageSize=20').then((r) => r.data),
    enabled: isOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (unreadData?.data?.count !== undefined) {
      setUnreadCount(unreadData.data.count);
    }
  }, [unreadData, setUnreadCount]);

  useEffect(() => {
    if (notificationsData?.data) {
      setNotifications(notificationsData.data);
    }
  }, [notificationsData, setNotifications]);

  const handleMarkRead = (id: string) => {
    markRead(id);
    markReadMutation.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllRead();
    markAllReadMutation.mutate();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No notifications yet</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => !notification.isRead && handleMarkRead(notification.id)}
                >
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{notification.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
