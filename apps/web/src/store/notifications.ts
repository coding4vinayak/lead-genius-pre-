import { create } from 'zustand';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  setNotifications: (notifications: Notification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setUnreadCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1,
    })),
  setNotifications: (notifications) => set({ notifications }),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
