'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

/**
 * Portal Items Page
 *
 * View items list
 * Path: /portal/items
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PortalItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async (searchQuery = '') => {
    try {
      const url = searchQuery
        ? `/api/portal/items?search=${encodeURIComponent(searchQuery)}`
        : '/api/portal/items';

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setItems(data.data.items);
        setCompanyName(data.data.companyName);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        setError(extractErrorMessage(data.error) || '품목 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('품목 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems(search);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-700 dark:border-gray-300 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/portal/dashboard" className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white mr-4">
                ← 대시보드
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">품목 정보</h1>
            </div>
            <p className="text-sm text-gray-600">{companyName}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="품목명, 품목코드, 규격으로 검색..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
              검색
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">등록된 품목이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    품목코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    품목명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    규격
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    단위
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    재고
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    단가
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.item_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.item_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.item_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.spec || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.current_stock?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                      {item.unit_price ? formatCurrency(item.unit_price) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
