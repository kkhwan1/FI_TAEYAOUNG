'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle,
  Settings,
  Trash2,
  Filter,
  X,
  AlertCircle,
  Wrench
} from 'lucide-react';

interface Notification {
  id: number;
  type: 'alert' | 'change' | 'system';
  title: string;
  message: string;
  timestamp: string;
  is_read: boolean;
}

interface NotificationPanelProps {
  className?: string;
  onSettingsClick?: () => void;
}

export default function NotificationPanel({ className = '', onSettingsClick }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'alert' | 'change' | 'system'>('all');
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 10;

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterRead !== 'all') params.append('read', filterRead === 'read' ? 'true' : 'false');
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/notifications?${params.toString()}`, {}, {
        timeout: 10000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setNotifications(result.data || []);
        setTotalPages(result.pagination?.totalPages || 1);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        setError(extractErrorMessage(result.error) || '알림을 불러올 수 없습니다');
      }
    } catch (err: any) {
      setError(err.message || '알림 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Real-time updates - polling every 30 seconds
    const interval = setInterval(fetchNotifications, 30 * 1000);
    return () => clearInterval(interval);
  }, [filterType, filterRead, currentPage]);

  const handleMarkAsRead = async (id: number) => {
    try {
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch(`/api/notifications/${id}/read`, {
        method: 'PUT'
      }, {
        timeout: 10000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === id ? { ...notif, is_read: true } : notif
          )
        );
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 알림을 삭제하시겠습니까?')) return;

    try {
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch(`/api/notifications/${id}`, {
        method: 'DELETE'
      }, {
        timeout: 10000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
      case 'change':
        return ;
      case 'system':
        return <Wrench className="h-5 w-5 text-gray-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'alert': return '경고';
      case 'change': return '변경';
      case 'system': return '시스템';
      default: return type;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">알림</h3>
            {unreadCount > 0 && (
              <span className="bg-gray-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="필터"
            >
              <Filter className="h-4 w-4" />
            </button>
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="설정"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                유형
              </label>
              <div className="flex gap-2">
                {(['all', 'alert', 'change', 'system'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setFilterType(type);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      filterType === type
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type === 'all' ? '전체' : getTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                읽음 상태
              </label>
              <div className="flex gap-2">
                {(['all', 'unread', 'read'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilterRead(status);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      filterRead === status
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {status === 'all' ? '전체' : status === 'read' ? '읽음' : '안 읽음'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '600px' }}>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <AlertCircle className="h-8 w-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">알림이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  !notification.is_read ? 'bg-gray-50 dark:bg-gray-900/10' : ''
                }`}
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {notification.title}
                      </h4>
                      {!notification.is_read && (
                        <span className="flex-shrink-0 w-2 h-2 bg-gray-600 rounded-full mt-1"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(notification.timestamp).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <div className="flex items-center gap-1">
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            title="읽음으로 표시"
                          >
                            <CheckCircle className="h-4 w-4 text-gray-600" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              이전
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
