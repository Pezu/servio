// Application Constants

export const APP_CONFIG = {
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
    MAX_VISIBLE_PAGES: 5,
  },
  WEBSOCKET: {
    HEARTBEAT_INCOMING: 10000,
    HEARTBEAT_OUTGOING: 10000,
    RECONNECT_DELAY: 2000,
  },
  TIMERS: {
    VALIDATION_POLL_INTERVAL: 2000,
    TOAST_DURATION: 5000,
    TOAST_DURATION_SHORT: 2000,
    DEBOUNCE_TIME: 300,
  },
};

export const STATUS_COLORS = {
  ACTIVE: { bg: 'rgba(12, 175, 96, 0.1)', color: '#0caf60' },
  INACTIVE: { bg: 'rgba(253, 106, 106, 0.1)', color: '#fd6a6a' },
  PENDING: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
  DRAFT: { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' },
  IN_PROGRESS: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' },
  READY: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' },
  DELIVERED: { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' },
  CANCELLED: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' },
  DONE: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' },
  ORDERED: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
};

export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  IN_PROGRESS: 'IN_PROGRESS',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export const ITEM_STATUS = {
  ORDERED: 'ORDERED',
  PREPARING: 'PREPARING',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
