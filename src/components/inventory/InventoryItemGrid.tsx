'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';

export interface InventoryGridItem {
  item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  spec?: string;
  // 입고 전용 필드
  lot_no?: string;
  expiry_date?: string;
  to_location?: string;
  // 출고 전용 필드
  delivery_address?: string;
  // 기타
  notes?: string;
  isMonthlyPriceApplied?: boolean;
}

export interface InventoryItemGridProps {
  items: InventoryGridItem[];
  onItemsChange: (items: InventoryGridItem[]) => void;
  readOnly?: boolean;
  availableItems?: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    unit?: string;
    spec?: string;
    price?: number;
    unit_price?: number;
  }>;
  transactionType?: 'receiving' | 'shipping' | 'production';
  showTotal?: boolean;
}

/**
 * 재고 거래용 품목 그리드 컴포넌트
 *
 * 기능:
 * - 품목 추가/삭제
 * - 수량 변경 시 자동 금액 계산
 * - 품목 선택 모달
 * - 총액 자동 계산
 * - 거래 유형별 추가 필드 지원 (입고: lot_no, expiry_date, to_location / 출고: delivery_address)
 */
export default function InventoryItemGrid({
  items,
  onItemsChange,
  readOnly = false,
  availableItems = [],
  transactionType = 'receiving',
  showTotal = true
}: InventoryItemGridProps) {
  const [rows, setRows] = useState<InventoryGridItem[]>(items);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // items prop이 변경되면 rows 동기화
  useEffect(() => {
    setRows(items);
  }, [items]);

  // rows 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onItemsChange(rows);
  }, [rows, onItemsChange]);

  const handleAddRow = () => {
    const newRow: InventoryGridItem = {
      item_id: 0,
      item_code: '',
      item_name: '',
      unit: '',
      quantity: 1,
      unit_price: 0,
      total_amount: 0,
      spec: ''
    };
    setRows([...rows, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  };

  const handleChangeRow = (index: number, field: keyof InventoryGridItem, value: any) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };

    // 수량 또는 단가 변경 시 자동 금액 계산
    if (field === 'quantity' || field === 'unit_price') {
      newRows[index].total_amount =
        newRows[index].quantity * newRows[index].unit_price;
    }

    setRows(newRows);
  };

  const handleSelectItem = (item: any) => {
    if (selectedRowIndex !== null) {
      const newRows = [...rows];
      const price = item.price || item.unit_price || 0;
      newRows[selectedRowIndex] = {
        ...newRows[selectedRowIndex],
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        unit_price: parseFloat(String(price)),
        unit: item.unit || '',
        spec: item.spec || '',
        total_amount: newRows[selectedRowIndex].quantity * parseFloat(String(price))
      };
      setRows(newRows);
      setShowItemPicker(false);
      setSelectedRowIndex(null);
      setSearchTerm('');
    }
  };

  const handleOpenItemPicker = (index: number) => {
    setSelectedRowIndex(index);
    setShowItemPicker(true);
  };

  const totalAmount = rows.reduce((sum, row) => sum + (row.total_amount || 0), 0);

  const filteredItems = availableItems.filter(
    (item) =>
      item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 거래 유형별 추가 컬럼 결정
  const showReceivingFields = transactionType === 'receiving';
  const showShippingFields = transactionType === 'shipping';

  return (
    <>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        {/* 그리드 헤더 */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  순번
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  품목코드
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  품목명
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  단위
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  수량
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  단가
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  금액
                </th>
                {showReceivingFields && (
                  <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      LOT번호
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      유통기한
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      입고위치
                    </th>
                  </>
                )}
                {showShippingFields && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                    배송지
                  </th>
                )}
                {!readOnly && (
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                    액션
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      (showReceivingFields ? 10 : showShippingFields ? 8 : 7) + (readOnly ? 0 : 1)
                    }
                    className="px-4 py-8 text-center text-gray-600 dark:text-gray-400"
                  >
                    품목을 추가해주세요
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    {/* 순번 */}
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{index + 1}</td>

                    {/* 품목코드 */}
                    <td className="px-4 py-3 text-sm">
                      {readOnly || row.item_id ? (
                        <span className="text-gray-900 dark:text-white font-mono">{row.item_code}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenItemPicker(index)}
                          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded border border-gray-300 transition-colors flex items-center gap-1 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-600"
                        >
                          <Search className="w-3 h-3" />
                          선택
                        </button>
                      )}
                    </td>

                    {/* 품목명 */}
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {row.item_name || '-'}
                      {row.spec && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{row.spec}</div>
                      )}
                    </td>

                    {/* 단위 */}
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{row.unit || '-'}</td>

                    {/* 수량 */}
                    <td className="px-4 py-3 text-right">
                      {readOnly ? (
                        <span className="text-sm text-gray-900 dark:text-white">
                          {row.quantity.toLocaleString('ko-KR')}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) =>
                            handleChangeRow(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                          className="w-full text-right border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      )}
                    </td>

                    {/* 단가 */}
                    <td className="px-4 py-3 text-right">
                      {readOnly ? (
                        <span className="text-sm text-gray-900 dark:text-white">
                          {row.unit_price.toLocaleString('ko-KR')}원
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={row.unit_price}
                          onChange={(e) =>
                            handleChangeRow(index, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                          className="w-full text-right border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                      )}
                    </td>

                    {/* 금액 */}
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      {row.total_amount.toLocaleString('ko-KR')}원
                    </td>

                    {/* 입고 전용 필드 */}
                    {showReceivingFields && (
                      <>
                        <td className="px-4 py-3">
                          {readOnly ? (
                            <span className="text-sm text-gray-900 dark:text-white">{row.lot_no || '-'}</span>
                          ) : (
                            <input
                              type="text"
                              value={row.lot_no || ''}
                              onChange={(e) => handleChangeRow(index, 'lot_no', e.target.value)}
                              placeholder="LOT번호"
                              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {readOnly ? (
                            <span className="text-sm text-gray-900 dark:text-white">{row.expiry_date || '-'}</span>
                          ) : (
                            <input
                              type="date"
                              value={row.expiry_date || ''}
                              onChange={(e) => handleChangeRow(index, 'expiry_date', e.target.value)}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {readOnly ? (
                            <span className="text-sm text-gray-900 dark:text-white">{row.to_location || '-'}</span>
                          ) : (
                            <input
                              type="text"
                              value={row.to_location || ''}
                              onChange={(e) => handleChangeRow(index, 'to_location', e.target.value)}
                              placeholder="입고위치"
                              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                            />
                          )}
                        </td>
                      </>
                    )}

                    {/* 출고 전용 필드 */}
                    {showShippingFields && (
                      <td className="px-4 py-3">
                        {readOnly ? (
                          <span className="text-sm text-gray-900 dark:text-white">{row.delivery_address || '-'}</span>
                        ) : (
                          <input
                            type="text"
                            value={row.delivery_address || ''}
                            onChange={(e) => handleChangeRow(index, 'delivery_address', e.target.value)}
                            placeholder="배송지 주소"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                          />
                        )}
                      </td>
                    )}

                    {/* 액션 */}
                    {!readOnly && (
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(index)}
                          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {/* 합계 행 */}
            {showTotal && (
              <tfoot className="bg-gray-50 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-600">
                <tr>
                  <td
                    colSpan={
                      (showReceivingFields ? 6 : showShippingFields ? 6 : 6) + (readOnly ? 0 : 0)
                    }
                    className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white"
                  >
                    합계
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-lg text-gray-900 dark:text-white">
                    {totalAmount.toLocaleString('ko-KR')}원
                  </td>
                  {showReceivingFields && <td colSpan={3}></td>}
                  {showShippingFields && <td></td>}
                  {!readOnly && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* 품목 추가 버튼 */}
        {!readOnly && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              품목 추가
            </button>
          </div>
        )}
      </div>

      {/* 품목 선택 모달 */}
      {showItemPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">품목 선택</h3>
              <button
                type="button"
                onClick={() => {
                  setShowItemPicker(false);
                  setSelectedRowIndex(null);
                  setSearchTerm('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 검색 입력 */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="품목코드 또는 품목명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                  autoFocus
                />
              </div>
            </div>

            {/* 품목 리스트 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  {searchTerm ? '검색 결과가 없습니다' : '등록된 품목이 없습니다'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <button
                      key={item.item_id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className="w-full text-left px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{item.item_name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            코드: {item.item_code}
                            {item.spec && ` | 규격: ${item.spec}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {(item.price || item.unit_price || 0).toLocaleString('ko-KR')}원
                          </div>
                          {item.unit && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{item.unit}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowItemPicker(false);
                  setSelectedRowIndex(null);
                  setSearchTerm('');
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

