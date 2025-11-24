'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

/**
 * Portal Transactions Page
 *
 * View transactions filtered by RLS
 * Path: /portal/transactions
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function PortalTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState<string>('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/portal/transactions');
      const data = await response.json();

      if (data.success) {
        setTransactions(data.data.transactions);
        setRole(data.data.role);
        setCompanyName(data.data.companyName);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        setError(extractErrorMessage(data.error) || '거래 내역을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('거래 내역을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ko-KR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      PARTIAL: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    const labels = {
      PENDING: '미결제',
      PARTIAL: '부분결제',
      COMPLETED: '완료',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
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
              <h1 className="text-2xl font-bold text-gray-900">거래 내역</h1>
            </div>
            <p className="text-sm text-gray-600">{companyName}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">등록된 거래 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    거래번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {role === 'CUSTOMER' ? '거래일자' : '주문일자'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    품목
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총액
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((tx) => (
                  <tr key={tx.transaction_id || tx.purchase_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tx.transaction_no || tx.purchase_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(tx.transaction_date || tx.order_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {tx.items?.item_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {tx.quantity.toLocaleString()} {tx.items?.unit || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                      {formatCurrency(tx.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(tx.payment_status)}
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
