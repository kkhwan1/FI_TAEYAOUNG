'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download
} from 'lucide-react';
import { toast } from '@/lib/toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import BalanceSheetTable from '@/components/reports/BalanceSheetTable';
import CashFlowTable from '@/components/reports/CashFlowTable';
import FinancialCharts from '@/components/reports/FinancialCharts';

export default function FinancialStatementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date().getFullYear() + '-01-01'
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [balanceSheetData, setBalanceSheetData] = useState<any>(null);
  const [cashFlowData, setCashFlowData] = useState<any>(null);

  // Load financial data
  const loadFinancialData = async () => {
    setLoading(true);
    try {
      // Import safeFetchAllJson utility
      const { safeFetchAllJson } = await import('@/lib/fetch-utils');

      // Load balance sheet and cash flow in parallel with timeout and retry
      const [balanceSheetResult, cashFlowResult] = await safeFetchAllJson([
        { url: `/api/reports/balance-sheet?start_date=${startDate}&end_date=${endDate}` },
        { url: `/api/reports/cash-flow?start_date=${startDate}&end_date=${endDate}` }
      ], {
        timeout: 30000, // 30초 타임아웃 (대량 데이터)
        maxRetries: 2,  // 최대 2회 재시도
        retryDelay: 1000 // 1초 간격
      });

      if (balanceSheetResult.success) {
        setBalanceSheetData(balanceSheetResult.data);
      } else {
        toast.error('재무상태표 로드 실패');
      }

      if (cashFlowResult.success) {
        setCashFlowData(cashFlowResult.data);
      } else {
        toast.error('현금흐름표 로드 실패');
      }
    } catch (error) {
      console.error('Financial data load error:', error);
      toast.error('재무제표 데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [startDate, endDate]);

  // Export to Excel
  const exportToExcel = async (reportType: 'balance-sheet' | 'cash-flow') => {
    try {
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch(
        `/api/export/${reportType}?start_date=${startDate}&end_date=${endDate}`,
        {},
        {
          timeout: 60000,
          maxRetries: 2,
          retryDelay: 1000
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${
        reportType === 'balance-sheet' ? '재무상태표' : '현금흐름표'
      }_${startDate}_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Excel 파일이 다운로드되었습니다.');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Excel 내보내기에 실패했습니다.');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">재무제표</h1>
        <p className="text-gray-600">
          재무상태표와 현금흐름표를 조회하고 분석합니다.
        </p>
      </div>

      {/* Date Filter Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>조회 기간 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="startDate">시작일</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="endDate">종료일</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              onClick={loadFinancialData}
              disabled={loading}
              className="px-6"
            >
              {loading ? <LoadingSpinner size="sm" /> : '조회'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Financial Statements Tabs */}
      <Tabs defaultValue="balance-sheet" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="balance-sheet">재무상태표</TabsTrigger>
          <TabsTrigger value="cash-flow">현금흐름표</TabsTrigger>
          <TabsTrigger value="charts">차트 분석</TabsTrigger>
        </TabsList>

        {/* Balance Sheet Tab */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>재무상태표</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Balance Sheet - {startDate} ~ {endDate}
                </p>
              </div>
              <Button
                onClick={() => exportToExcel('balance-sheet')}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel 내보내기
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : balanceSheetData ? (
                <BalanceSheetTable data={balanceSheetData} />
              ) : (
                <p className="text-center py-8 text-gray-500">
                  데이터를 불러오는 중입니다...
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cash-flow">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>현금흐름표</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Cash Flow Statement - {startDate} ~ {endDate}
                </p>
              </div>
              <Button
                onClick={() => exportToExcel('cash-flow')}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel 내보내기
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : cashFlowData ? (
                <CashFlowTable data={cashFlowData} />
              ) : (
                <p className="text-center py-8 text-gray-500">
                  데이터를 불러오는 중입니다...
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts">
          <Card>
            <CardHeader>
              <CardTitle>재무 분석 차트</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Financial Analysis Charts
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : balanceSheetData && cashFlowData ? (
                <FinancialCharts
                  balanceSheetData={balanceSheetData}
                  cashFlowData={cashFlowData}
                />
              ) : (
                <p className="text-center py-8 text-gray-500">
                  차트를 표시하려면 먼저 데이터를 조회하세요.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Cards */}
      {balanceSheetData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">총 자산</p>
                  <p className="text-xl font-bold">
                    ₩{balanceSheetData.summary.total_assets.toLocaleString()}
                  </p>
                </div>
                
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">총 부채</p>
                  <p className="text-xl font-bold">
                    ₩{balanceSheetData.summary.total_liabilities.toLocaleString()}
                  </p>
                </div>
                
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">총 자본</p>
                  <p className="text-xl font-bold">
                    ₩{balanceSheetData.summary.total_equity.toLocaleString()}
                  </p>
                </div>
                
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">부채비율</p>
                  <p className="text-xl font-bold">
                    {balanceSheetData.summary.total_equity > 0
                      ? (
                          (balanceSheetData.summary.total_liabilities /
                            balanceSheetData.summary.total_equity) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
                
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}