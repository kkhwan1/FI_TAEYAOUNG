'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Save,
  Loader2,
  Calendar,
  Building2,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  CompanyForComponent,
  Product,
  ShippingItem,
  ShippingFormData,
  ShippingFormProps,
  ItemForComponent as Item
} from '@/types/inventory';
import { Database } from '@/types/supabase';
import CompanySelect from '@/components/CompanySelect';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useToastNotification } from '@/hooks/useToast';
import { ShippingHistory } from '@/components/inventory';

// Company type from unified Supabase layer
type Company = Database['public']['Tables']['companies']['Row'];

// Define a type alias for customer to maintain compatibility
type Customer = CompanyForComponent;

export default function ShippingForm({ onSubmit, onCancel, initialData, isEdit }: ShippingFormProps) {
  const [formData, setFormData] = useState<ShippingFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    customer_id: undefined,
    items: [],
    reference_no: '',
    created_by: 1 // Default user ID
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockCheckComplete, setStockCheckComplete] = useState(false);
  const [stockChecking, setStockChecking] = useState(false);
  // P3: 금일 이력 그리드 새로고침 트리거
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const [addingProduct, setAddingProduct] = useState(false);
  const [customerItems, setCustomerItems] = useState<Item[]>([]);
  const [selectedCustomerItemIds, setSelectedCustomerItemIds] = useState<Set<number>>(new Set());
  const [loadingCustomerItems, setLoadingCustomerItems] = useState(false);
  const [customerItemsSearch, setCustomerItemsSearch] = useState('');
  // 고객별 품목 목록에서 수량 입력 저장 (itemId -> quantity)
  const [customerItemQuantities, setCustomerItemQuantities] = useState<Map<number, number>>(new Map());
  const toast = useToastNotification();

  // Load initial data when editing
  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        transaction_date: initialData.transaction_date || new Date().toISOString().split('T')[0],
        customer_id: initialData.customer_id,
        items: initialData.items || [],
        reference_no: initialData.reference_no || '',
        created_by: initialData.created_by || 1
      });
    }
  }, [isEdit, initialData]);

  // 재고 확인을 위한 debounce 타이머
  const stockCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 최신 items를 참조하기 위한 ref
  const itemsRef = useRef(formData.items);
  useEffect(() => {
    itemsRef.current = formData.items;
  }, [formData.items]);

  // 재고 확인 함수를 메모이제이션하여 불필요한 재생성 방지
  const checkStockAvailability = useCallback(async () => {
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) {
      setStockCheckComplete(false);
      return;
    }

    setStockChecking(true);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const response = await safeFetchJson('/api/inventory/shipping/stock-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          items: currentItems.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity
          }))
        }),
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (response.success && response.data && response.data.stock_check_results) {
        const stockCheckResults = response.data.stock_check_results;
        
        // 최신 items 다시 가져오기 (동시 업데이트 방지)
        const latestItems = itemsRef.current;
        const updatedItems = latestItems.map(item => {
          const stockInfo = stockCheckResults.find((s: any) => s.item_id === item.item_id);
          if (stockInfo?.error) {
            // 에러가 있는 항목은 사용자에게 알림
            toast.warning('재고 확인 실패', `${item.item_name || item.item_code}: ${stockInfo.error}`);
          }
          return {
            ...item,
            current_stock: stockInfo?.current_stock ?? item.current_stock,
            sufficient_stock: stockInfo ? stockInfo.sufficient : item.sufficient_stock ?? false
          };
        });

        setFormData(prev => ({ ...prev, items: updatedItems }));
        setStockCheckComplete(true);
      } else {
        const errorMsg = response.error || '재고 확인에 실패했습니다.';
        toast.error('재고 확인 오류', errorMsg);
        setStockCheckComplete(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '재고 확인 중 오류가 발생했습니다.';
      toast.error('재고 확인 오류', errorMessage);
      setStockCheckComplete(false);
    } finally {
      setStockChecking(false);
    }
  }, [toast]);

  // Debounce된 재고 확인 함수
  const debouncedCheckStock = useDebounce(checkStockAvailability, 500);

  // items의 길이와 각 item의 핵심 정보를 추적하여 재고 확인
  const itemsKey = formData.items.map(item => `${item.item_id}:${item.quantity}`).join(',');
  
  // items가 변경될 때 debounced 재고 확인 실행
  useEffect(() => {
    if (formData.items.length > 0) {
      // Debounce된 재고 확인 실행
      debouncedCheckStock();
    } else {
      setStockCheckComplete(false);
      setStockChecking(false);
    }
  }, [itemsKey, debouncedCheckStock]);

  const fetchInitialData = async () => {
    try {
      // Import safeFetchAllJson utility
      const { safeFetchAllJson } = await import('@/lib/fetch-utils');

      // Fetch customers, products, and stock in parallel with timeout and retry
      const [customersData, productsData, stockData] = await safeFetchAllJson([
        { url: '/api/companies?type=CUSTOMER' },
        { url: '/api/items?type=PRODUCT' },
        { url: '/api/stock' }
      ], {
        timeout: 15000, // 15초 타임아웃
        maxRetries: 2,  // 최대 2회 재시도
        retryDelay: 1000 // 1초 간격
      });

      // Process customers data
      if (customersData.success) {
        setCustomers(customersData.data);
      } else {
        toast.warning('고객사 목록 불러오기 실패', customersData.error || '고객사 목록을 불러올 수 없습니다.');
      }

      // Process products and stock data
      if (productsData.success && stockData.success) {
        const stockMap = new Map(stockData.data.map((item: Record<string, any>) => [item.item_id, item.current_stock]));

        const productsWithStock = Array.isArray(productsData.data)
          ? productsData.data
              .filter((item: Product) => item.category === '제품')
              .map((item: Product) => ({
                ...item,
                current_stock: stockMap.get(item.id) || 0
              }))
          : [];

        setProducts(productsWithStock);
      } else {
        const errorMsg = !productsData.success ? productsData.error : 
                         !stockData.success ? stockData.error : '제품 목록을 불러올 수 없습니다.';
        toast.warning('제품 목록 불러오기 실패', errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '초기 데이터를 불러오는 중 오류가 발생했습니다.';
      toast.error('데이터 로딩 오류', errorMessage);
    }
  };


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
          formData.items.map(async (shipItem) => {
            const monthlyPrice = await fetchMonthlyPrice(shipItem.item_id, targetDate);
            if (monthlyPrice > 0) {
              return {
                ...shipItem,
                unit_price: monthlyPrice,
                total_amount: shipItem.quantity * monthlyPrice,
                isMonthlyPriceApplied: true
              };
            }
            return {
              ...shipItem,
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

  // 예정일 기준 월별 단가 조회 함수 (에러 발생 시 폴백 처리)
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
      // 월별 단가 조회 실패는 심각한 오류가 아니므로 조용히 처리 (폴백)
      // 기본 단가를 사용하도록 0 반환
    }
    return 0; // 0 반환 시 기본 단가 사용
  };

  const handleAddProduct = async (item: Item | null) => {
    if (!item) {
      toast.warning('제품 선택 오류', '유효하지 않은 제품입니다.');
      return;
    }

    // item_id 유효성 검사
    const itemId = item.item_id || item.id;
    if (!itemId) {
      toast.error('제품 추가 오류', '제품 ID가 없습니다.');
      return;
    }

    // Check if product is already added
    const existingItem = formData.items.find(shipItem => shipItem.item_id === itemId);
    if (existingItem) {
      toast.warning('제품 중복', '이미 추가된 제품입니다.');
      return;
    }

    setAddingProduct(true);
    try {
      // 예정일이 있으면 해당 월의 단가를 조회, 없으면 현재 품목 단가 사용
      const targetDate = formData.transaction_date || '';
      let unitPrice = item.unit_price || item.price || 0;
      let isMonthly = false;
      
      if (targetDate && itemId) {
        try {
          const monthlyPrice = await fetchMonthlyPrice(itemId, targetDate);
          if (monthlyPrice > 0) {
            unitPrice = monthlyPrice;
            isMonthly = true;
          }
        } catch (error) {
          // 월별 단가 조회 실패는 조용히 처리하고 기본 단가 사용
          console.warn('월별 단가 조회 실패, 기본 단가 사용:', error);
        }
      }

      // 사용자가 입력한 수량 사용, 없으면 기본값 1
      const inputQuantity = customerItemQuantities.get(itemId) || 1;

      const newItem: ShippingItem = {
        item_id: itemId,
        item_code: item.item_code || '',
        item_name: item.item_name || item.name || '',
        unit: item.unit || 'EA',
        unit_price: unitPrice,
        current_stock: item.current_stock || 0,
        quantity: inputQuantity,
        total_amount: unitPrice * inputQuantity,
        sufficient_stock: (item.current_stock || 0) >= inputQuantity,
        isMonthlyPriceApplied: isMonthly
      };

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));

      // 고객별 품목 목록에서 추가된 품목 제거
      setCustomerItems(prev => prev.filter(i => (i.item_id || i.id) !== itemId));
      setSelectedCustomerItemIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });

      setStockCheckComplete(false);
      
      // 제품 추가 성공 알림은 제품 목록에 표시되므로 생략
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '제품을 추가하는 중 오류가 발생했습니다.';
      toast.error('제품 추가 오류', errorMessage);
    } finally {
      setAddingProduct(false);
    }
  };

  const handleCustomerChange = async (customerId: number | null, customer?: Company) => {
    // 고객사 정보 자동 입력
    setFormData(prev => ({
      ...prev,
      customer_id: customerId || undefined
    }));

    setSelectedCustomerItemIds(new Set()); // 선택 초기화

    // Clear customer error
    if (errors.customer_id) {
      setErrors(prev => ({ ...prev, customer_id: '' }));
    }

    // 고객 선택 시 관련 품목 목록 조회
    if (customerId) {
      await fetchItemsByCustomer(customerId);
    } else {
      setCustomerItems([]);
    }
  };

  const fetchItemsByCustomer = async (customerId: number) => {
    if (!customerId) {
      console.warn('고객사 ID가 선택되지 않았습니다');
      setCustomerItems([]);
      return;
    }

    setLoadingCustomerItems(true);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(`/api/items/by-customer?customer_id=${customerId}&limit=1000`, {}, {
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
        setCustomerItems(filteredItems);
      } else {
        setCustomerItems([]);
      }
    } catch (error) {
      console.error('Failed to fetch customer items:', error);
      setCustomerItems([]);
    } finally {
      setLoadingCustomerItems(false);
    }
  };

  const handleCustomerItemToggle = (itemId: number) => {
    setSelectedCustomerItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAllCustomerItems = () => {
    if (selectedCustomerItemIds.size === filteredCustomerItems.length) {
      // 모두 선택되어 있으면 모두 해제
      setSelectedCustomerItemIds(new Set());
    } else {
      // 모두 선택
      setSelectedCustomerItemIds(new Set(filteredCustomerItems.map(item => item.item_id || item.id)));
    }
  };

  const handleBulkAddCustomerItems = async () => {
    if (selectedCustomerItemIds.size === 0) {
      toast.warning('품목 선택 필요', '추가할 품목을 선택해주세요.');
      return;
    }

    const itemsToAdd = filteredCustomerItems.filter(item => 
      selectedCustomerItemIds.has(item.item_id || item.id)
    );

    // 이미 추가된 품목 체크
    const existingItemIds = new Set(formData.items.map(item => item.item_id));
    const newItems = itemsToAdd.filter(item => !existingItemIds.has(item.item_id || item.id));

    if (newItems.length === 0) {
      toast.warning('품목 중복', '이미 추가된 품목들입니다.');
      setSelectedCustomerItemIds(new Set());
      return;
    }

    // 각 품목을 추가
    for (const item of newItems) {
      await handleAddProduct(item);
    }

    // 선택 초기화 및 목록 갱신
    setSelectedCustomerItemIds(new Set());
    if (formData.customer_id) {
      await fetchItemsByCustomer(formData.customer_id);
    }
  };

  // 필터링된 고객 품목 목록
  const filteredCustomerItems = useMemo(() => {
    if (!customerItemsSearch.trim()) {
      return customerItems;
    }
    const searchLower = customerItemsSearch.toLowerCase().trim();
    return customerItems.filter(item => {
      const codeMatch = item.item_code?.toLowerCase().includes(searchLower) || false;
      const nameMatch = item.item_name?.toLowerCase().includes(searchLower) || false;
      return codeMatch || nameMatch;
    });
  }, [customerItems, customerItemsSearch]);

  const handleItemQuantityChange = (itemId: number, quantity: number) => {
    if (quantity < 0) {
      toast.warning('수량 오류', '수량은 0 이상이어야 합니다.');
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.item_id === itemId
          ? {
              ...item,
              quantity: quantity,
              total_amount: quantity * item.unit_price,
              sufficient_stock: item.current_stock >= quantity
            }
          : item
      )
    }));
    // 수량 변경 시 재고 확인은 debounce된 함수가 자동으로 처리
    setStockCheckComplete(false);
  };

  const handleItemUnitPriceChange = (itemId: number, unitPrice: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.item_id === itemId
          ? {
              ...item,
              unit_price: unitPrice,
              total_amount: item.quantity * unitPrice,
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

    // 품목 제거 시 고객별 품목 목록 갱신 (제거된 품목을 다시 목록에 표시)
    if (formData.customer_id) {
      await fetchItemsByCustomer(formData.customer_id);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '출고일자는 필수입니다';
    }

    if (formData.items.length === 0) {
      newErrors.items = '출고할 제품을 하나 이상 추가해주세요';
    }

    // Check if any item has insufficient stock
    const insufficientItems = formData.items.filter(item => !item.sufficient_stock || item.current_stock < item.quantity);
    if (insufficientItems.length > 0) {
      newErrors.stock = '재고가 부족한 제품이 있습니다. 수량을 확인해주세요.';
    }

    // Check if any item has zero or negative quantity
    const invalidQuantityItems = formData.items.filter(item => item.quantity <= 0);
    if (invalidQuantityItems.length > 0) {
      newErrors.quantity = '모든 제품의 수량이 0보다 커야 합니다';
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      // 유효성 검사 실패 시 에러 메시지 표시
      if (errors.items) {
        toast.warning('입력 오류', errors.items);
      } else if (errors.stock) {
        toast.warning('재고 확인', errors.stock);
      } else if (errors.quantity) {
        toast.warning('수량 오류', errors.quantity);
      }
      return;
    }

    // 최종 재고 확인이 완료되지 않았다면 한 번 더 확인
    if (!stockCheckComplete && formData.items.length > 0) {
      toast.warning('재고 확인 필요', '제출 전에 재고 확인을 완료해주세요.');
      return;
    }

    setLoading(true);
    try {
      const submissionData = {
        ...formData,
        created_by: 1 // Default user ID, should be from auth context
      };

      // Remove empty optional fields (only customer_id can be optional)
      if (submissionData.customer_id === undefined) {
        delete submissionData.customer_id;
        }

      await onSubmit(submissionData);
      // P3: 등록 성공 시 이력 그리드 새로고침
      setHistoryRefreshTrigger(prev => prev + 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '출고 등록 중 오류가 발생했습니다.';
      toast.error('출고 등록 실패', errorMessage);
    } finally {
      setLoading(false);
    }
  };


  const generateShippingOrder = (): string => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    return `SHP-${timestamp}`;
  };

  const handleGenerateReference = () => {
    setFormData(prev => ({
      ...prev,
      reference_no: generateShippingOrder()
    }));
  };

  const calculateTotalAmount = () => {
    return formData.items.reduce((total, item) => total + item.total_amount, 0);
  };

  const hasInsufficientStock = () => {
    return formData.items.some(item => !item.sufficient_stock);
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 월별 단가 안내 배너 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-sm text-blue-800 dark:text-blue-200">
          <span className="font-medium">월별 단가 자동 적용:</span> 출고 예정일을 기준으로 해당 월의 단가가 자동으로 적용됩니다.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 출고일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            출고 예정일 <span className="text-gray-500">*</span>
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

        {/* 고객사 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            고객사
          </label>
          <CompanySelect
            value={formData.customer_id}
            onChange={handleCustomerChange}
            companyType="CUSTOMER"
            placeholder="고객사를 선택하세요"
            required={false}
            error={errors.customer_id}
            deliveryOnly={false}
            hideDeliveryPrefix={true}
          />
        </div>

      </div>

      {/* 고객별 품목 목록 */}
      {formData.customer_id && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              고객별 품목 목록
            </label>
            {filteredCustomerItems.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllCustomerItems}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {selectedCustomerItemIds.size === filteredCustomerItems.length ? (
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
                {selectedCustomerItemIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkAddCustomerItems}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    선택된 품목 추가 ({selectedCustomerItemIds.size}개)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 검색 필터 */}
          {customerItems.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={customerItemsSearch}
                onChange={(e) => setCustomerItemsSearch(e.target.value)}
                placeholder="품번 또는 품명으로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 로딩 상태 */}
          {loadingCustomerItems && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">품목 목록을 불러오는 중...</span>
            </div>
          )}

          {/* 품목 목록 */}
          {!loadingCustomerItems && filteredCustomerItems.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedCustomerItemIds.size === filteredCustomerItems.length && filteredCustomerItems.length > 0}
                        onChange={handleSelectAllCustomerItems}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px]">
                      품번
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px]">
                      품명
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24">
                      수량
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
                  {filteredCustomerItems.map((item) => {
                    const itemId = item.item_id || item.id;
                    const isSelected = selectedCustomerItemIds.has(itemId);
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
                            onChange={() => handleCustomerItemToggle(itemId)}
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
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min="0"
                            value={customerItemQuantities.get(itemId) || ''}
                            onChange={(e) => {
                              const newQuantities = new Map(customerItemQuantities);
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              newQuantities.set(itemId, value);
                              setCustomerItemQuantities(newQuantities);
                            }}
                            className="w-full px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="수량"
                            disabled={isAlreadyAdded}
                          />
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
          {!loadingCustomerItems && customerItems.length === 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                선택한 고객과 관련된 품목이 없습니다.
              </p>
            </div>
          )}

          {/* 검색 결과가 없을 때 */}
          {!loadingCustomerItems && customerItems.length > 0 && filteredCustomerItems.length === 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                검색 결과가 없습니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 출고번호 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          출고번호
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            name="reference_no"
            value={formData.reference_no || ''}
            onChange={handleChange}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: SHP-202501301430"
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

      {/* Selected Items */}
      {formData.items.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
              출고 제품 목록
            </h4>
            <div className="flex items-center gap-2">
              {stockChecking && (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>재고 확인 중...</span>
                </div>
              )}
              {!stockCheckComplete && !stockChecking && (
                <button
                  type="button"
                  onClick={checkStockAvailability}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  재고 확인
                </button>
              )}
              {stockCheckComplete && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  <span>재고 확인 완료</span>
                </div>
              )}
            </div>
          </div>

          {hasInsufficientStock() && stockCheckComplete && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  일부 제품의 재고가 부족합니다
                </span>
              </div>
            </div>
          )}

          {errors.stock && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">{errors.stock}</p>
            </div>
          )}

          {errors.quantity && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">{errors.quantity}</p>
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24">
                    현재고
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-28">
                    금액 (₩)
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">
                    재고상태
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                {formData.items.map((item, index) => (
                  <tr
                    key={item.item_id}
                    className={`transition-colors ${
                      stockCheckComplete && !item.sufficient_stock
                        ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.item_code}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                      {item.item_name}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.unit || ''}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            items: prev.items.map(i => 
                              i.item_id === item.item_id ? { ...i, unit: e.target.value } : i
                            )
                          }));
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="단위"
                      />
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
                          <span
                            className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded whitespace-nowrap flex items-center gap-0.5"
                            title="출고 예정일 기준 월별 단가가 자동으로 적용되었습니다"
                          >
                            <Calendar className="w-3 h-3" />
                            월별단가
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.current_stock.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                      {item.total_amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {stockCheckComplete && (
                        <div className="flex flex-col items-center gap-1">
                          {item.sufficient_stock ? (
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <span className="text-xs text-red-600 dark:text-red-400 whitespace-nowrap">
                                부족: {(item.quantity - item.current_stock).toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      )}
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

          {/* Total Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                총 출고 금액:
              </span>
              <span className="text-lg font-bold text-gray-600 dark:text-gray-400">
                ₩{calculateTotalAmount().toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 출고 요약 */}
      {formData.items.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            출고 요약
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">품목 수:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                {formData.items.length}개
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">총 수량:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                {formData.items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">총 금액:</span>
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
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
          disabled={loading || formData.items.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              출고 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              출고 등록
            </>
          )}
        </button>
      </div>
    </form>

    {/* P3: 금일 출고 이력 그리드 (폼 외부) */}
    <div className="mt-6">
      <ShippingHistory
        refreshTrigger={historyRefreshTrigger}
        workDate={formData.transaction_date}
      />
    </div>
    </>
  );
}