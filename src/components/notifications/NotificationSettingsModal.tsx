'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  price_change_threshold: number;
  categories: string[];
}

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSettingsModal({ isOpen, onClose }: NotificationSettingsModalProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_enabled: true,
    push_enabled: false,
    price_change_threshold: 5,
    categories: ['원자재', '외주', '소모품', '기타']
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const availableCategories = ['원자재', '외주', '소모품', '기타'];

  useEffect(() => {
    if (isOpen) {
      fetchPreferences();
      setSuccess(false);
    }
  }, [isOpen]);

  const fetchPreferences = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications/preferences');
      const result = await response.json();

      if (result.success && result.data) {
        setPreferences(result.data);
      } else {
        setError('설정을 불러올 수 없습니다');
      }
    } catch (err: any) {
      setError(err.message || '설정 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        setError(extractErrorMessage(result.error) || '설정 저장 실패');
      }
    } catch (err: any) {
      setError(err.message || '설정 저장 중 오류 발생');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setPreferences(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            알림 설정
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{error}</span>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Save className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      설정이 저장되었습니다
                    </span>
                  </div>
                </div>
              )}

              {/* Email Notifications Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    이메일 알림
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    이메일로 알림을 받습니다
                  </p>
                </div>
                <button
                  onClick={() => setPreferences(prev => ({ ...prev, email_enabled: !prev.email_enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.email_enabled
                      ? 'bg-gray-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.email_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Push Notifications Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    푸시 알림
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    브라우저 푸시 알림을 받습니다
                  </p>
                </div>
                <button
                  onClick={() => setPreferences(prev => ({ ...prev, push_enabled: !prev.push_enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.push_enabled
                      ? 'bg-gray-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.push_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Price Change Threshold */}
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white block mb-2">
                  가격 변동 알림 기준 (%)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  설정한 비율 이상 가격이 변동되면 알림을 보냅니다
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={preferences.price_change_threshold}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      price_change_threshold: parseFloat(e.target.value)
                    }))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="w-20 text-right">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="0.5"
                      value={preferences.price_change_threshold}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        price_change_threshold: parseFloat(e.target.value) || 5
                      }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                </div>
              </div>

              {/* Category Filters */}
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white block mb-2">
                  알림 받을 카테고리
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  선택한 카테고리의 변동 사항만 알림을 받습니다
                </p>
                <div className="space-y-2">
                  {availableCategories.map(category => (
                    <label
                      key={category}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={preferences.categories.includes(category)}
                        onChange={() => handleCategoryToggle(category)}
                        className="w-4 h-4 text-gray-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {category}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
