'use client';

import { useState, useEffect, useMemo } from 'react';
import { Save, Loader2, Calendar, Building2, Plus, X, CheckCircle, Search, CheckSquare, Square } from 'lucide-react';
import {
  CompanyForComponent as Company,
  ItemForComponent as Item,
  ReceivingFormData,
  ReceivingItem,
  ReceivingFormProps,
  SearchOption
} from '@/types/inventory';
import ItemSelect from '@/components/ItemSelect';
import CompanySelect from '@/components/CompanySelect';
import { useToast } from '@/contexts/ToastContext';

export default function ReceivingForm({ onSubmit, onCancel, initialData, isEdit }: ReceivingFormProps) {
  const { error: showError } = useToast();
  const [formData, setFormData] = useState<ReceivingFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    items: [],
    company_id: undefined,
    reference_no: '',
    notes: '',
    created_by: 1 // Default user ID
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [supplierItems, setSupplierItems] = useState<Item[]>([]);
  const [selectedSupplierItemIds, setSelectedSupplierItemIds] = useState<Set<number>>(new Set());
  const [loadingSupplierItems, setLoadingSupplierItems] = useState(false);
  const [supplierItemsSearch, setSupplierItemsSearch] = useState('');

  // Load initial data when editing
  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        transaction_date: initialData.transaction_date || new Date().toISOString().split('T')[0],
        items: initialData.items || [],
        company_id: initialData.company_id,
        reference_no: initialData.reference_no || '',
        notes: initialData.notes || '',
        created_by: initialData.created_by || 1
      });
      
      if (initialData.company_id) {
        // Load company info if needed
        // This will be handled by CompanySelect component
      }
    }
  }, [isEdit, initialData]);


  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? (value ? parseFloat(value) : 0) : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // 예정일이 변경되고 품목이 추가되어 있으면 해당 월의 단가를 자동으로 업데이트
    if (name === 'transaction_date' && formData.items.length > 0) {
      const targetDate = value || formData.transaction_date || '';
      if (targetDate) {
        // 모든 품목의 단가를 업데이트
        const updatedItems = await Promise.all(
          formData.items.map(async (receiveItem) => {
            const monthlyPrice = await fetchMonthlyPrice(receiveItem.item_id, targetDate);
            if (monthlyPrice > 0) {
              return {
                ...receiveItem,
                unit_price: monthlyPrice,
                isMonthlyPriceApplied: true
              };
            }
            return {
              ...receiveItem,
              isMonthlyPriceApplied: false
            };
          })
        );
        setFormData(prev => ({
          ...prev,
          items: updatedItems
        }));
      }
    }

    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // 예정일 기준 월별 단가 조회 함수
  const fetchMonthlyPrice = async (itemId: number, dateString: string): Promise<number> => {
    try {
      // 날짜에서 YYYY-MM 형식 추출
      const month = dateString ? dateString.substring(0, 7) : new Date().toISOString().substring(0, 7);
      
      // Import safeFetchJson utility
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/price-history?month=${month}`, {}, {
        timeout: 10000, // 10초 타임아웃
        maxRetries: 2,  // 최대 2회 재시도
        retryDelay: 1000 // 1초 간격
      });

      if (result.success && result.data) {
        const priceItem = result.data.find((p: any) => p.item_id === itemId);
        if (priceItem && priceItem.unit_price) {
          return priceItem.unit_price;
        }
      }
    } catch (error) {
      console.warn('월별 단가 조회 실패:', error);
    }
    return 0;
  };

  const handleAddItem = async (item: Item | null) => {
    if (!item) return;

    // Check if product is already added
    const existingItem = formData.items.find(receiveItem => receiveItem.item_id === (item.item_id || item.id));
    if (existingItem) {
      showError('이미 추가된 제품입니다.');
      return;
    }

    const itemId = item.item_id || item.id;
    
    // 예정일이 있으면 해당 월의 단가를 조회, 없으면 현재 품목 단가 사용
    const targetDate = formData.transaction_date || '';
    let unitPrice = item.unit_price || item.price || 0;
    let isMonthly = false;
    
    if (targetDate && itemId) {
      const monthlyPrice = await fetchMonthlyPrice(itemId, targetDate);
      if (monthlyPrice > 0) {
        unitPrice = monthlyPrice;
        isMonthly = true;
      }
    }

    const newItem: ReceivingItem = {
      item_id: itemId,
      item_code: item.item_code || '',
      item_name: item.item_name || item.name || '',
      unit: item.unit || '',
      quantity: 1,
      unit_price: unitPrice,
      isMonthlyPriceApplied: isMonthly
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    // 공급업체별 품목 목록에서 추가된 품목 제거
    setSupplierItems(prev => prev.filter(i => (i.item_id || i.id) !== itemId));
    setSelectedSupplierItemIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });

    // Clear item selection error
    if (errors.items) {
      setErrors(prev => ({ ...prev, items: '' }));
    }
  };

  const handleCompanyChange = async (companyId: number | null, company?: any) => {
    setFormData(prev => ({ ...prev, company_id: companyId || undefined }));
    setSelectedCompany(company || null);
    setSelectedSupplierItemIds(new Set()); // 선택 초기화

    // Clear company error
    if (errors.company_id) {
      setErrors(prev => ({ ...prev, company_id: '' }));
    }

    // 공급업체 선택 시 관련 품목 목록 조회
    if (companyId) {
      await fetchItemsBySupplier(companyId);
    } else {
      setSupplierItems([]);
    }
  };

  const fetchItemsBySupplier = async (supplierId: number) => {
    setLoadingSupplierItems(true);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/items/by-supplier?supplier_id=${supplierId}&limit=1000`, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success && result.data && result.data.items) {
        // 이미 추가된 품목은 제외
        const existingItemIds = new Set(formData.items.map(item => item.item_id));
        const filteredItems = result.data.items.filter((item: Item) => 
          !existingItemIds.has(item.item_id || item.id)
        );
        setSupplierItems(filteredItems);
      } else {
        setSupplierItems([]);
      }
    } catch (error) {
      console.error('Failed to fetch supplier items:', error);
      setSupplierItems([]);
    } finally {
      setLoadingSupplierItems(false);
    }
  };

  const handleSupplierItemToggle = (itemId: number) => {
    setSelectedSupplierItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAllSupplierItems = () => {
    if (selectedSupplierItemIds.size === filteredSupplierItems.length) {
      // 모두 선택되어 있으면 모두 해제
      setSelectedSupplierItemIds(new Set());
    } else {
      // 모두 선택
      setSelectedSupplierItemIds(new Set(filteredSupplierItems.map(item => item.item_id || item.id)));
    }
  };

  const handleBulkAddSupplierItems = async () => {
    if (selectedSupplierItemIds.size === 0) {
      showError('추가할 품목을 선택해주세요.');
      return;
    }

    const itemsToAdd = filteredSupplierItems.filter(item => 
      selectedSupplierItemIds.has(item.item_id || item.id)
    );

    // 이미 추가된 품목 체크
    const existingItemIds = new Set(formData.items.map(item => item.item_id));
    const newItems = itemsToAdd.filter(item => !existingItemIds.has(item.item_id || item.id));

    if (newItems.length === 0) {
      showError('이미 추가된 품목들입니다.');
      setSelectedSupplierItemIds(new Set());
      return;
    }

    // 각 품목을 추가
    for (const item of newItems) {
      await handleAddItem(item);
    }

    // 선택 초기화 및 목록 갱신
    setSelectedSupplierItemIds(new Set());
    if (formData.company_id) {
      await fetchItemsBySupplier(formData.company_id);
    }
  };

  // 필터링된 공급업체 품목 목록
  const filteredSupplierItems = useMemo(() => {
    if (!supplierItemsSearch.trim()) {
      return supplierItems;
    }
    const searchLower = supplierItemsSearch.toLowerCase().trim();
    return supplierItems.filter(item => {
      const codeMatch = item.item_code?.toLowerCase().includes(searchLower) || false;
      const nameMatch = item.item_name?.toLowerCase().includes(searchLower) || false;
      return codeMatch || nameMatch;
    });
  }, [supplierItems, supplierItemsSearch]);

  // Generate receiving reference number (RCV-YYYYMMDDHHMM)
  const generateReceivingOrder = (): string => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    return `RCV-${timestamp}`;
  };

  const handleGenerateReference = () => {
    setFormData(prev => ({
      ...prev,
      reference_no: generateReceivingOrder()
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '입고 예정일은 필수입니다';
    }

    if (formData.items.length === 0) {
      newErrors.items = '입고할 품목을 하나 이상 추가해주세요';
    }

    // Check if any item has zero or negative quantity
    const invalidQuantityItems = formData.items.filter(item => item.quantity <= 0);
    if (invalidQuantityItems.length > 0) {
      newErrors.quantity = '모든 품목의 수량이 0보다 커야 합니다';
    }

    // Check if any item has negative unit price
    const invalidPriceItems = formData.items.filter(item => item.unit_price < 0);
    if (invalidPriceItems.length > 0) {
      newErrors.unit_price = '모든 품목의 단가는 0 이상이어야 합니다';
    }

    // Check expiry dates
    const invalidExpiryItems = formData.items.filter(item => 
      item.expiry_date && item.expiry_date < formData.transaction_date
    );
    if (invalidExpiryItems.length > 0) {
      newErrors.expiry_date = '만료일은 거래일자보다 뒤여야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Prepare submission data - each item will be sent separately or as batch
      const submissionData = {
        ...formData,
        created_by: 1 // Default user ID
      };

      // Remove empty optional fields
      Object.keys(submissionData).forEach(key => {
        if (key !== 'items' && (submissionData[key as keyof typeof submissionData] === '' ||
            submissionData[key as keyof typeof submissionData] === undefined)) {
          delete submissionData[key as keyof typeof submissionData];
        }
      });

      await onSubmit(submissionData);
    } finally {
      setLoading(false);
    }
  };

  const handleItemQuantityChange = (itemId: number, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.item_id === itemId
          ? { ...item, quantity: quantity }
          : item
      )
    }));
  };

  const handleItemUnitPriceChange = (itemId: number, unitPrice: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.item_id === itemId
          ? {
              ...item,
              unit_price: unitPrice,
              isMonthlyPriceApplied: false // 수동 변경 시 플래그 해제
            }
          : item
      )
    }));
  };

  const removeItem = async (itemId: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.item_id !== itemId)
    }));

    // 품목 제거 시 공급업체별 품목 목록 갱신 (제거된 품목을 다시 목록에 표시)
    if (formData.company_id) {
      await fetchItemsBySupplier(formData.company_id);
    }
  };

  const calculateTotalAmount = () => {
    return formData.items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 입고 예정일 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            입고 예정일 <span className="text-gray-500">*</span>
          </label>
          <input
            type="date"
            name="transaction_date"
            value={formData.transaction_date}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.transaction_date ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
          />
          {errors.transaction_date && (
            <p className="mt-1 text-sm text-gray-500">{errors.transaction_date}</p>
          )}
        </div>

        {/* 공급업체 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            공급업체
          </label>
          <CompanySelect
            value={formData.company_id}
            onChange={handleCompanyChange}
            companyType="SUPPLIER"
            placeholder="공급업체를 선택하세요"
            error={errors.company_id}
          />
        </div>

        {/* 품목 검색 및 추가 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            품목 <span className="text-gray-500">*</span>
          </label>
          <ItemSelect
            key={`item-select-${formData.items.length}`}
            value={undefined}
            onChange={handleAddItem}
            label=""
            placeholder="품번 또는 품명으로 검색하여 추가..."
            required={false}
            showPrice={true}
            itemType="ALL"
            className=""
            supplierId={formData.company_id}
          />
          {errors.items && (
            <p className="mt-1 text-sm text-red-500">{errors.items}</p>
          )}
        </div>

        {/* 공급업체별 품목 목록 */}
        {formData.company_id && (
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                공급업체별 품목 목록
              </label>
              {filteredSupplierItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllSupplierItems}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {selectedSupplierItemIds.size === filteredSupplierItems.length ? (
                      <>
                        <CheckSquare className="w-3 h-3 inline mr-1" />
                        전체 해제
                      </>
                    ) : (
                      <>
                        <Square className="w-3 h-3 inline mr-1" />
                        전체 선택
                      </>
                    )}
                  </button>
                  {selectedSupplierItemIds.size > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkAddSupplierItems}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Plus className="w-3 h-3 inline mr-1" />
                      선택된 품목 추가 ({selectedSupplierItemIds.size}개)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 검색 필터 */}
            {supplierItems.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={supplierItemsSearch}
                  onChange={(e) => setSupplierItemsSearch(e.target.value)}
                  placeholder="품번 또는 품명으로 검색..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* 로딩 상태 */}
            {loadingSupplierItems && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">품목 목록을 불러오는 중...</span>
              </div>
            )}

            {/* 품목 목록 */}
            {!loadingSupplierItems && filteredSupplierItems.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={selectedSupplierItemIds.size === filteredSupplierItems.length && filteredSupplierItems.length > 0}
                          onChange={handleSelectAllSupplierItems}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
                        품번
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px]">
                        품명
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">
                        단위
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-32">
                        단가 (₩)
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24">
                        카테고리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredSupplierItems.map((item) => {
                      const itemId = item.item_id || item.id;
                      const isSelected = selectedSupplierItemIds.has(itemId);
                      const isAlreadyAdded = formData.items.some(i => i.item_id === itemId);
                      
                      return (
                        <tr
                          key={itemId}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                            isAlreadyAdded ? 'opacity-50 bg-gray-100 dark:bg-gray-800' : ''
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSupplierItemToggle(itemId)}
                              disabled={isAlreadyAdded}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                            {item.item_code}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                            {item.item_name}
                            {isAlreadyAdded && (
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(이미 추가됨)</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {item.unit || '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-gray-900 dark:text-white">
                            {(item.price || item.unit_price) ? `₩${(item.price || item.unit_price || 0).toLocaleString()}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            {item.category || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 품목이 없을 때 */}
            {!loadingSupplierItems && supplierItems.length === 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  선택한 공급업체와 관련된 품목이 없습니다.
                </p>
              </div>
            )}

            {/* 검색 결과가 없을 때 */}
            {!loadingSupplierItems && supplierItems.length > 0 && filteredSupplierItems.length === 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  검색 결과가 없습니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 입고번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            입고번호
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="reference_no"
              value={formData.reference_no}
              onChange={handleChange}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: RCV-202501301430"
            />
            <button
              type="button"
              onClick={handleGenerateReference}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              title="자동 생성"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>



        {/* 메모 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            메모
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="추가 메모나 특이사항을 입력하세요"
          />
        </div>
      </div>

      {/* Added Items List */}
      {formData.items.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">추가된 품목 목록</h4>
          {errors.items && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.items}</p>
            </div>
          )}
          {errors.quantity && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.quantity}</p>
            </div>
          )}
          {errors.unit_price && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.unit_price}</p>
            </div>
          )}
          {errors.expiry_date && (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.expiry_date}</p>
            </div>
          )}

          <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-12">
                    번호
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                    품번
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px]">
                    품명
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16">
                    단위
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24">
                    수량
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-32">
                    단가 (₩)
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-28">
                    금액 (₩)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
                    LOT 번호
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-32">
                    만료일
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[100px]">
                    입고 위치
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                {formData.items.map((item, index) => (
                  <tr key={item.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.item_code}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                      {item.item_name}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.unit}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemQuantityChange(item.item_id, parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleItemUnitPriceChange(item.item_id, parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {item.isMonthlyPriceApplied && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded whitespace-nowrap">
                            월별
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                      {(item.quantity * item.unit_price).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.lot_no || ''}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            items: prev.items.map(i =>
                              i.item_id === item.item_id ? { ...i, lot_no: e.target.value } : i
                            )
                          }));
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="LOT-20240101"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={item.expiry_date || ''}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            items: prev.items.map(i =>
                              i.item_id === item.item_id ? { ...i, expiry_date: e.target.value } : i
                            )
                          }));
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.to_location || ''}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            items: prev.items.map(i =>
                              i.item_id === item.item_id ? { ...i, to_location: e.target.value } : i
                            )
                          }));
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="A-01-01"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.item_id)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="품목 제거"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      {formData.items.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">입고 요약</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">품목 수:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.items.length}개
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">총 수량:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
              </span>
            </div>
            <div className="md:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">총 금액:</span>
              <span className="ml-2 font-bold text-lg text-gray-600 dark:text-gray-400">
                ₩{calculateTotalAmount().toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              입고 등록
            </>
          )}
        </button>
      </div>
    </form>
  );
}