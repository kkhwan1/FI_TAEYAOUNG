'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface LOTLineage {
  parent: {
    lot_number: string;
    operation_type: string;
    status: string;
    completed_at: string;
    input_item?: { item_name: string };
    output_item?: { item_name: string };
  } | null;
  current: {
    lot_number: string;
    operation_type: string;
    status: string;
    started_at: string;
    completed_at: string;
    input_item?: { item_name: string };
    output_item?: { item_name: string };
  };
  child: {
    lot_number: string;
    operation_type: string;
    status: string;
    started_at: string;
    input_item?: { item_name: string };
    output_item?: { item_name: string };
  } | null;
}

interface StockMovement {
  movement_type: string;
  quantity_change: number;
  created_at: string;
}

interface Operation {
  operation_id: number;
  lot_number: string;
  operation_type: string;
  status: string;
  input_item?: { item_name: string };
  output_item?: { item_name: string };
  started_at: string;
  completed_at: string;
  input_quantity?: number;
  output_quantity?: number;
}

interface LOTData {
  operation: Operation;
  lineage: LOTLineage;
  stock_movements: StockMovement[];
}

const STATUS_COLORS = {
  'PLANNED': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  'IN_PROGRESS': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'CANCELLED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const OPERATION_TYPE_LABELS: Record<string, string> = {
  'PRODUCTION': '생산',
  'ASSEMBLY': '조립',
  'INSPECTION': '검사',
  'PACKAGING': '포장',
  'REWORK': '재작업',
};

const STATUS_LABELS: Record<string, string> = {
  'PLANNED': '계획',
  'IN_PROGRESS': '진행중',
  'COMPLETED': '완료',
  'CANCELLED': '취소',
};

export default function LOTTracker() {
  const [lotNumber, setLotNumber] = useState('');
  const [data, setData] = useState<LOTData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!lotNumber.trim()) {
      toast.error('LOT 번호를 입력하세요');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/process/lot/${encodeURIComponent(lotNumber.trim())}`);

      // UTF-8 한글 처리 패턴
      const text = await response.text();
      const result = JSON.parse(text);

      if (result.success) {
        setData(result.data);
        toast.success('LOT 정보를 불러왔습니다');
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        toast.error(extractErrorMessage(result.error) || 'LOT를 찾을 수 없습니다');
        setData(null);
      }
    } catch (error) {
      console.error('LOT 조회 오류:', error);
      toast.error('검색 중 오류가 발생했습니다');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const renderLOTCard = (lot: any, label: string, position: 'parent' | 'current' | 'child') => {
    if (!lot) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400 dark:text-gray-600 text-center">
            {position === 'parent' && '최상위 LOT'}
            {position === 'child' && '마지막 LOT'}
          </div>
        </div>
      );
    }

    const statusColor = STATUS_COLORS[lot.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.PLANNED;
    const operationType = OPERATION_TYPE_LABELS[lot.operation_type] || lot.operation_type;
    const statusLabel = STATUS_LABELS[lot.status] || lot.status;

    return (
      <div className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border-2 ${
        position === 'current' ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'
      }`}>
        {/* Label */}
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase">
          {label}
        </div>

        {/* LOT Number */}
        <div className="font-bold text-xl dark:text-white mb-3">
          {lot.lot_number}
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Operation Type */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">공정 유형</div>
          <div className="font-semibold dark:text-white">{operationType}</div>
        </div>

        {/* Items */}
        {lot.input_item && (
          <div className="mb-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">투입 품목</div>
            <div className="text-sm dark:text-gray-300">{lot.input_item.item_name}</div>
          </div>
        )}
        {lot.output_item && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">산출 품목</div>
            <div className="text-sm dark:text-gray-300">{lot.output_item.item_name}</div>
          </div>
        )}

        {/* Timestamps */}
        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 border-t dark:border-gray-700 pt-3 mt-3">
          {lot.started_at && (
            <div className="flex justify-between">
              <span>시작:</span>
              <span>{new Date(lot.started_at).toLocaleString('ko-KR')}</span>
            </div>
          )}
          {lot.completed_at && (
            <div className="flex justify-between">
              <span>완료:</span>
              <span>{new Date(lot.completed_at).toLocaleString('ko-KR')}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConnector = (hasConnection: boolean) => {
    if (!hasConnection) return null;

    return (
      <div className="flex justify-center py-2">
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-8 bg-gradient-to-b from-blue-500 to-blue-400 dark:from-blue-400 dark:to-blue-300"></div>
          <div className="w-3 h-3 rounded-full bg-blue-500 dark:bg-blue-400"></div>
          <div className="w-0.5 h-8 bg-gradient-to-b from-blue-400 to-blue-500 dark:from-blue-300 dark:to-blue-400"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2 dark:text-white">LOT 추적</h2>
        <p className="text-gray-600 dark:text-gray-400">
          LOT 번호로 공정 이력과 재고 이동을 추적합니다
        </p>
      </div>

      {/* Search Section */}
      <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="flex gap-3">
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="LOT 번호를 입력하세요 (예: LOT-2025-001)"
            className="flex-1 px-4 py-3 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                검색 중...
              </span>
            ) : '검색'}
          </button>
        </div>
      </div>

      {/* LOT Lineage Timeline */}
      {data && (
        <div className="space-y-8">
          {/* Timeline Visualization */}
          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-6 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              공정 계보
            </h3>

            <div className="space-y-0">
              {/* Parent LOT */}
              <div>
                {renderLOTCard(data.lineage.parent, '부모 LOT', 'parent')}
                {renderConnector(!!data.lineage.parent)}
              </div>

              {/* Current LOT */}
              <div>
                {renderLOTCard(data.lineage.current, '현재 LOT', 'current')}
                {renderConnector(!!data.lineage.child)}
              </div>

              {/* Child LOT */}
              <div>
                {renderLOTCard(data.lineage.child, '자식 LOT', 'child')}
              </div>
            </div>
          </div>

          {/* Operation Details */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              공정 상세 정보
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">공정 ID</div>
                  <div className="font-semibold dark:text-white">{data.operation.operation_id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">LOT 번호</div>
                  <div className="font-semibold dark:text-white">{data.operation.lot_number}</div>
                </div>
                {data.operation.input_quantity && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">투입 수량</div>
                    <div className="font-semibold dark:text-white">{data.operation.input_quantity.toLocaleString('ko-KR')}</div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">공정 유형</div>
                  <div className="font-semibold dark:text-white">
                    {OPERATION_TYPE_LABELS[data.operation.operation_type] || data.operation.operation_type}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">상태</div>
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      STATUS_COLORS[data.operation.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.PLANNED
                    }`}>
                      {STATUS_LABELS[data.operation.status] || data.operation.status}
                    </span>
                  </div>
                </div>
                {data.operation.output_quantity && (
                  <div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">산출 수량</div>
                    <div className="font-semibold dark:text-white">{data.operation.output_quantity.toLocaleString('ko-KR')}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stock Movements */}
          {data.stock_movements && data.stock_movements.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b dark:border-gray-700">
                <h3 className="text-xl font-semibold dark:text-white flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  재고 이동 내역
                  <span className="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                    {data.stock_movements.length}건
                  </span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        유형
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        수량 변화
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        일시
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.stock_movements.map((movement, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap dark:text-gray-300">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                            {movement.movement_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-semibold ${
                            movement.quantity_change > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {movement.quantity_change > 0 ? '+' : ''}{movement.quantity_change.toLocaleString('ko-KR')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {new Date(movement.created_at).toLocaleString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
          <svg className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            LOT 번호를 입력하여 공정 이력을 조회하세요
          </p>
        </div>
      )}
    </div>
  );
}
