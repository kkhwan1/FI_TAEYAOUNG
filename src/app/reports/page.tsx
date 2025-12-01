'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
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

export default function FinancialReportsPage() {
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
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">재무제표</h1>
        <p className="text-gray-600 dark:text-gray-400">
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="balance-sheet">재무상태표</TabsTrigger>
          <TabsTrigger value="cash-flow">현금흐름표</TabsTrigger>
        </TabsList>

        {/* Balance Sheet Tab */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>재무상태표</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                <div className="space-y-4">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">구분</th>
                        <th className="border p-2 text-left">계정과목</th>
                        <th className="border p-2 text-right">당기</th>
                        <th className="border p-2 text-right">전기</th>
                        <th className="border p-2 text-right">증감</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 자산 */}
                      <tr className="font-bold bg-gray-50 dark:bg-gray-800">
                        <td className="border p-2" colSpan={5}>자산</td>
                      </tr>
                      {balanceSheetData.자산?.map((item: any, index: number) => (
                        <tr key={`asset-${index}`}>
                          <td className="border p-2 pl-6">{item.category}</td>
                          <td className="border p-2">{item.account_name}</td>
                          <td className="border p-2 text-right">
                            {item.current_period?.toLocaleString()}
                          </td>
                          <td className="border p-2 text-right">
                            {item.prior_period?.toLocaleString()}
                          </td>
                          <td className="border p-2 text-right">
                            {item.change_amount?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="border p-2" colSpan={2}>자산 합계</td>
                        <td className="border p-2 text-right">
                          {balanceSheetData.summary?.total_assets?.toLocaleString()}
                        </td>
                        <td className="border p-2" colSpan={2}></td>
                      </tr>

                      {/* 부채 */}
                      <tr className="font-bold bg-gray-100 dark:bg-gray-750">
                        <td className="border p-2" colSpan={5}>부채</td>
                      </tr>
                      {balanceSheetData.부채?.map((item: any, index: number) => (
                        <tr key={`liability-${index}`}>
                          <td className="border p-2 pl-6">{item.category}</td>
                          <td className="border p-2">{item.account_name}</td>
                          <td className="border p-2 text-right">
                            {item.current_period?.toLocaleString()}
                          </td>
                          <td className="border p-2 text-right">
                            {item.prior_period?.toLocaleString()}
                          </td>
                          <td className="border p-2 text-right">
                            {item.change_amount?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="border p-2" colSpan={2}>부채 합계</td>
                        <td className="border p-2 text-right">
                          {balanceSheetData.summary?.total_liabilities?.toLocaleString()}
                        </td>
                        <td className="border p-2" colSpan={2}></td>
                      </tr>

                      {/* 자본 */}
                      <tr className="font-bold bg-gray-50 dark:bg-gray-800">
                        <td className="border p-2" colSpan={5}>자본</td>
                      </tr>
                      {balanceSheetData.자본?.map((item: any, index: number) => (
                        <tr key={`equity-${index}`}>
                          <td className="border p-2 pl-6">{item.category}</td>
                          <td className="border p-2">{item.account_name}</td>
                          <td className="border p-2 text-right">
                            {item.current_period?.toLocaleString()}
                          </td>
                          <td className="border p-2 text-right">
                            {item.prior_period?.toLocaleString()}
                          </td>
                          <td className="border p-2 text-right">
                            {item.change_amount?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="border p-2" colSpan={2}>자본 합계</td>
                        <td className="border p-2 text-right">
                          {balanceSheetData.summary?.total_equity?.toLocaleString()}
                        </td>
                        <td className="border p-2" colSpan={2}></td>
                      </tr>

                      {/* 총계 */}
                      <tr className="font-bold bg-gray-200">
                        <td className="border p-2" colSpan={2}>부채와 자본 합계</td>
                        <td className="border p-2 text-right">
                          {(balanceSheetData.summary?.total_liabilities +
                            balanceSheetData.summary?.total_equity)?.toLocaleString()}
                        </td>
                        <td className="border p-2" colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Balance Check */}
                  <div className={`p-4 rounded ${
                    balanceSheetData.summary?.balance_check
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                      : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                  }`}>
                    {balanceSheetData.summary?.balance_check
                      ? ' 대차대조표 균형: 자산 = 부채 + 자본'
                      : ' 대차대조표 불균형: 데이터 확인 필요'}
                  </div>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                <div className="space-y-4">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">구분</th>
                        <th className="border p-2 text-left">항목</th>
                        <th className="border p-2 text-right">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 영업활동 */}
                      <tr className="font-bold bg-gray-50 dark:bg-gray-800">
                        <td className="border p-2" colSpan={3}>영업활동</td>
                      </tr>
                      {cashFlowData.영업활동?.항목?.map((item: any, index: number) => (
                        <tr key={`operating-${index}`}>
                          <td className="border p-2 pl-6">영업활동</td>
                          <td className="border p-2">{item.활동명}</td>
                          <td className="border p-2 text-right">
                            {item.금액?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="border p-2" colSpan={2}>영업활동 소계</td>
                        <td className="border p-2 text-right">
                          {cashFlowData.영업활동?.소계?.toLocaleString()}
                        </td>
                      </tr>

                      {/* 투자활동 */}
                      <tr className="font-bold bg-gray-100 dark:bg-gray-750">
                        <td className="border p-2" colSpan={3}>투자활동</td>
                      </tr>
                      {cashFlowData.투자활동?.항목?.map((item: any, index: number) => (
                        <tr key={`investing-${index}`}>
                          <td className="border p-2 pl-6">투자활동</td>
                          <td className="border p-2">{item.활동명}</td>
                          <td className="border p-2 text-right">
                            {item.금액?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="border p-2" colSpan={2}>투자활동 소계</td>
                        <td className="border p-2 text-right">
                          {cashFlowData.투자활동?.소계?.toLocaleString()}
                        </td>
                      </tr>

                      {/* 재무활동 */}
                      <tr className="font-bold bg-gray-50 dark:bg-gray-800">
                        <td className="border p-2" colSpan={3}>재무활동</td>
                      </tr>
                      {cashFlowData.재무활동?.항목?.map((item: any, index: number) => (
                        <tr key={`financing-${index}`}>
                          <td className="border p-2 pl-6">재무활동</td>
                          <td className="border p-2">{item.활동명}</td>
                          <td className="border p-2 text-right">
                            {item.금액?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="border p-2" colSpan={2}>재무활동 소계</td>
                        <td className="border p-2 text-right">
                          {cashFlowData.재무활동?.소계?.toLocaleString()}
                        </td>
                      </tr>

                      {/* 총계 */}
                      <tr className="font-bold bg-gray-200">
                        <td className="border p-2" colSpan={2}>현금 증감</td>
                        <td className="border p-2 text-right">
                          {cashFlowData.요약?.현금증감?.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                  데이터를 불러오는 중입니다...
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}