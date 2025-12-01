'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Loader2,
  Calendar,
  CheckCircle,
  Factory,
  Wrench,
  List,
  Package,
  CheckSquare,
  Square,
  Plus
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CompanySelect from '@/components/CompanySelect';
import {
  Product,
  BOMItem,
  ProductionFormData,
  ProductionFormProps,
  ItemForComponent as Item,
  ProductionResponse,
  AutoDeduction,
  ProductionItem
} from '@/types/inventory';
import ItemSelect from '@/components/ItemSelect';
import { useBomCheck } from '@/lib/hooks/useBomCheck';
import { useDebounce } from '@/lib/hooks/useDebounce';
import BOMPreviewPanel from '@/components/inventory/BOMPreviewPanel';
import { BOMCheckResponse } from '@/types/inventory';
import { useToast } from '@/contexts/ToastContext';

export default function ProductionForm({ onSubmit, onCancel }: ProductionFormProps) {
  const { success: showSuccess, error: showError } = useToast();
  // Batch mode state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchItems, setBatchItems] = useState<ProductionItem[]>([]);
  const [batchBomChecks, setBatchBomChecks] = useState<Map<number, BOMCheckResponse>>(new Map());

  const [formData, setFormData] = useState<ProductionFormData>({
    transaction_date: new Date().toISOString().split('T')[0],
    product_item_id: 0,
    quantity: 0,
    reference_no: '',
    use_bom: true,
    scrap_quantity: 0,
    created_by: 1 // Default user ID
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [productionResult, setProductionResult] = useState<ProductionResponse | null>(null);
  const [savedBomCheckData, setSavedBomCheckData] = useState<any>(null);
  
  // 공정 구분 상태 (프레스, 용접, 도장)
  const [processTypes, setProcessTypes] = useState<('프레스' | '용접' | '도장')[]>(['프레스', '용접']); // 기본값: 프레스, 용접
  // 프레스 용량 다중 선택 (블랭킹: 400, 600톤 / 프레스: 1000, 1600톤)
  const [selectedCapacities, setSelectedCapacities] = useState<Set<number>>(new Set());
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  
  // 고객별 품목 목록 관련 상태
  const [customerItems, setCustomerItems] = useState<Item[]>([]);
  const [selectedCustomerItemIds, setSelectedCustomerItemIds] = useState<Set<number>>(new Set());
  const [loadingCustomerItems, setLoadingCustomerItems] = useState(false);
  const [customerItemsSearch, setCustomerItemsSearch] = useState('');
  // 고객별 품목 목록에서 수정된 단위 저장 (itemId -> unit) - 더 이상 사용하지 않음
  const [customerItemUnits, setCustomerItemUnits] = useState<Map<number, string>>(new Map());
  // 고객별 품목 목록에서 수량 입력 저장 (itemId -> quantity)
  const [customerItemQuantities, setCustomerItemQuantities] = useState<Map<number, number>>(new Map());

  // New hooks for BOM checking with debounce
  const { data: bomCheckData, loading: bomLoading, error: bomError, checkBom } = useBomCheck();
  const debouncedCheckBom = useDebounce(checkBom, 500);

  // Real-time BOM check when product or quantity changes (single mode)
  useEffect(() => {
    if (!isBatchMode && selectedProduct && formData.quantity > 0 && formData.use_bom) {
      const productId = selectedProduct.item_id || selectedProduct.id;
      if (productId > 0) {
        debouncedCheckBom(productId, formData.quantity);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, formData.quantity, formData.use_bom, isBatchMode]);

  // Batch mode BOM check - check BOM for each batch item when item or quantity changes
  useEffect(() => {
    if (!isBatchMode || !formData.use_bom || batchItems.length === 0) {
      setBatchBomChecks(new Map());
      return;
    }

    let isMounted = true;

    const checkBatchBoms = async () => {
      const newChecks = new Map<number, BOMCheckResponse>();
      
      for (const item of batchItems) {
        if (item.item_id > 0 && item.quantity > 0) {
          try {
            const response = await fetch(
              `/api/inventory/production/bom-check?product_item_id=${item.item_id}&quantity=${item.quantity}`
            );
            if (!isMounted) return;
            
            const result = await response.json();
            if (response.ok && result.success) {
              newChecks.set(item.item_id, result.data);
            }
          } catch (err) {
            if (isMounted) {
              console.error(`BOM check failed for item ${item.item_id}:`, err);
            }
          }
        }
      }
      
      if (isMounted) {
        setBatchBomChecks(newChecks);
      }
    };

    // Debounce batch BOM checks
    const timeoutId = setTimeout(checkBatchBoms, 500);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [batchItems, formData.use_bom, isBatchMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (value ? parseFloat(value) : 0) : value
    }));

    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleProductSelect = (item: Item | null) => {
    if (item) {
      const product = item as Product;
      const productId = product.item_id || product.id;
      
      setSelectedProduct({ ...product, item_id: productId, id: productId } as Product);
      setFormData(prev => ({
        ...prev,
        product_item_id: productId
      }));

      // Clear product selection error
      if (errors.product_item_id) {
        setErrors(prev => ({ ...prev, product_item_id: '' }));
      }
    } else {
      setSelectedProduct(null);
      setFormData(prev => ({ ...prev, product_item_id: 0 }));
    }
  };

  // 고객별 품목 조회 함수 (공정구분 및 프레스 용량 필터링 포함)
  const fetchItemsByCustomer = async (
    customerId: number,
    processTypes?: ('프레스' | '용접' | '도장')[],
    capacities?: Set<number>
  ) => {
    setLoadingCustomerItems(true);
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      let url = `/api/items/by-customer?customer_id=${customerId}&limit=1000`;

      // 프레스 용량에서 press_process_type 파라미터 생성 (BLANKING/STAMPING)
      if (capacities && capacities.size > 0) {
        const pressProcessTypes: string[] = [];
        const capacityArr = Array.from(capacities);

        // 400, 600 → BLANKING
        if (capacityArr.some(c => c === 400 || c === 600)) {
          pressProcessTypes.push('BLANKING');
        }
        // 1000, 1600 → STAMPING
        if (capacityArr.some(c => c === 1000 || c === 1600)) {
          pressProcessTypes.push('STAMPING');
        }

        if (pressProcessTypes.length > 0) {
          url += `&process_types=${pressProcessTypes.join(',')}`;
        }
      }
      // 공정구분 파라미터는 이미 용량으로 필터링된 경우 추가하지 않음
      else if (processTypes && processTypes.length > 0) {
        // 프레스가 선택되면 용량 기반 필터링을 사용하므로 여기서는 용접/도장만 처리
        // 단, 프레스만 선택되고 용량 미선택 시에는 모든 프레스 품목 표시
        url += `&process_types=${processTypes.join(',')}`;
      }
      
      const result = await safeFetchJson(url, {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success && result.data && result.data.items) {
        // 이미 배치 모드에 추가된 품목은 제외
        const existingItemIds = new Set(batchItems.map(item => item.item_id));
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

  // 고객사 변경 핸들러
  const handleCustomerChange = async (value: number | null) => {
    const numValue = value ? Number(value) : null;
    setCustomerId(numValue);
    setSelectedCustomerItemIds(new Set()); // 선택 초기화

    // 고객 선택 시 관련 품목 목록 조회 (공정구분 및 프레스 용량 필터링 포함)
    if (numValue) {
      await fetchItemsByCustomer(numValue, processTypes, selectedCapacities);
    } else {
      setCustomerItems([]);
    }
  };

  // 공정구분 또는 프레스 용량 변경 시 품목 목록 갱신
  useEffect(() => {
    if (customerId) {
      fetchItemsByCustomer(customerId, processTypes, selectedCapacities);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processTypes, selectedCapacities]);

  // 품목 선택/해제 핸들러
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

  // 전체 선택/해제 핸들러
  const handleSelectAllCustomerItems = () => {
    if (selectedCustomerItemIds.size === filteredCustomerItems.length) {
      // 모두 선택되어 있으면 모두 해제
      setSelectedCustomerItemIds(new Set());
    } else {
      // 모두 선택
      setSelectedCustomerItemIds(new Set(filteredCustomerItems.map(item => item.item_id || item.id)));
    }
  };

  // 선택된 품목들을 배치 모드에 추가
  const handleBulkAddCustomerItems = async () => {
    if (selectedCustomerItemIds.size === 0) {
      showError('추가할 품목을 선택해주세요.');
      return;
    }

    const itemsToAdd = filteredCustomerItems.filter(item => 
      selectedCustomerItemIds.has(item.item_id || item.id)
    );

    // 이미 추가된 품목 체크
    const existingItemIds = new Set(batchItems.map(item => item.item_id));
    const newItems = itemsToAdd.filter(item => !existingItemIds.has(item.item_id || item.id));

    if (newItems.length === 0) {
      showError('이미 추가된 품목들입니다.');
      setSelectedCustomerItemIds(new Set());
      return;
    }

    // 배치 모드로 전환
    if (!isBatchMode) {
      setIsBatchMode(true);
      // 단일 모드 데이터 초기화
      setSelectedProduct(null);
      setFormData(prev => ({ ...prev, product_item_id: 0, quantity: 0 }));
    }

    // 선택된 품목들을 배치 모드에 추가
    const newBatchItems: ProductionItem[] = newItems.map(item => {
      const itemId = item.item_id || item.id;
      // 수정된 단위가 있으면 사용, 없으면 원본 단위 사용
      const unit = customerItemUnits.get(itemId) || item.unit || 'EA';
      // 사용자가 입력한 수량 사용, 없으면 기본값 1
      const inputQuantity = customerItemQuantities.get(itemId) || 1;
      return {
        product_item_id: itemId,
        item_id: itemId,
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        quantity: inputQuantity,
        unit_price: item.unit_price || item.price || 0,
        unit: unit,
        reference_no: '',
        notes: ''
      };
    });

    setBatchItems(prev => [...prev, ...newBatchItems]);

    // 선택 초기화 및 목록 갱신
    setSelectedCustomerItemIds(new Set());
    if (customerId) {
      await fetchItemsByCustomer(customerId, processTypes, selectedCapacities);
    }

    showSuccess(`${newItems.length}개 품목이 배치 모드에 추가되었습니다.`);
  };

  // 필터링된 고객 품목 목록 (검색 기능 제거로 전체 품목 반환)
  const filteredCustomerItems = useMemo(() => {
    return customerItems;
  }, [customerItems]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transaction_date) {
      newErrors.transaction_date = '생산일자는 필수입니다';
    }

    if (isBatchMode) {
      // Batch mode validation
      if (batchItems.length === 0) {
        newErrors.batchItems = '최소 1개 이상의 제품을 추가해주세요';
      } else {
        batchItems.forEach((item, index) => {
          if (!item.item_id || item.item_id === 0) {
            newErrors[`batchItem_${index}_product`] = `제품 ${index + 1}: 제품을 선택해주세요`;
          }
          if (!item.quantity || item.quantity <= 0) {
            newErrors[`batchItem_${index}_quantity`] = `제품 ${index + 1}: 생산수량은 0보다 커야 합니다`;
          }
        });
      }
    } else {
      // Single mode validation
      if (!formData.product_item_id || formData.product_item_id === 0) {
        newErrors.product_item_id = '생산할 제품을 선택해주세요';
      }

      if (!formData.quantity || formData.quantity <= 0) {
        newErrors.quantity = '생산수량은 0보다 커야 합니다';
      }

      if (formData.scrap_quantity && formData.scrap_quantity < 0) {
        newErrors.scrap_quantity = '스크랩 수량은 0 이상이어야 합니다';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // For batch mode or no BOM data, submit directly with loading
    if (isBatchMode || !bomCheckData) {
      setLoading(true);
      try {
        await handleConfirmProduction();
      } finally {
        setLoading(false);
      }
      return;
    }

    // For modal confirmation, don't set loading yet - modal handles it
    setShowConfirmModal(true);
  };

  const handleConfirmProduction = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      if (isBatchMode && batchItems.length > 0) {
        // Batch mode submission
        const validBatchItems = batchItems.filter(item => item.item_id > 0 && item.quantity > 0);
        
        if (validBatchItems.length === 0) {
          showError('유효한 제품이 없습니다. 제품을 선택하고 수량을 입력해주세요.');
          return;
        }

        const batchData: any = {
          transaction_date: formData.transaction_date,
          items: validBatchItems.map(item => ({
            product_item_id: item.item_id,
            item_id: item.item_id,
            quantity: Math.floor(Number(item.quantity)),
            unit_price: item.unit_price || 0,
            unit: item.unit || '',
            reference_no: item.reference_no || ''
          })),
          reference_no: formData.reference_no,
          use_bom: formData.use_bom,
          created_by: formData.created_by || 1,
          process_types: processTypes.length > 0 ? processTypes : undefined,
          selected_capacities: selectedCapacities.size > 0 ? Array.from(selectedCapacities) : undefined,
          company_id: customerId || undefined
        };

        // Remove empty optional fields
        Object.keys(batchData).forEach(key => {
          if (batchData[key] === '' || batchData[key] === undefined) {
            delete batchData[key];
          }
        });

        const result = await onSubmit(batchData);
        
        // Check if submission was successful
        if (result && (result.success !== false)) {
          // Show success message
          showSuccess(`${validBatchItems.length}개 제품이 성공적으로 등록되었습니다.`);

          // Reset form
          setBatchItems([]);
          setFormData({
            transaction_date: new Date().toISOString().split('T')[0],
            product_item_id: 0,
            quantity: 0,
            reference_no: '',
            use_bom: true,
            scrap_quantity: 0,
            created_by: 1
          });
          setProcessTypes(['프레스', '용접']); // 기본값으로 리셋
          setSelectedCapacities(new Set());
          setCustomerId(null);

          // Close modal - parent component will refresh stock info
          onCancel();
          return;
        } else {
          const errorMessage = (result as any)?.error || '생산 등록에 실패했습니다.';
          throw new Error(errorMessage);
        }
      }

      // Single mode submission
      // API가 기대하는 형식으로 데이터 변환
      const itemId = selectedProduct?.item_id || selectedProduct?.id || formData.product_item_id;
      
      // 데이터 타입 강제 변환
      const parsedQuantity = Math.floor(Number(formData.quantity)); // 정수로 강제 변환
      const parsedUnitPrice = parseFloat(
        String(selectedProduct?.price || selectedProduct?.unit_price || 0)
      ); // 명시적 변환 및 기본값 보장
      
      const submissionData: ProductionFormData = {
        transaction_date: formData.transaction_date,
        product_item_id: itemId,
        quantity: parsedQuantity,
        reference_no: formData.reference_no,
        use_bom: formData.use_bom,
        scrap_quantity: formData.scrap_quantity,
        created_by: 1, // Default user ID
        process_types: processTypes.length > 0 ? processTypes : undefined
      };

      // 프레스 용량 배열 추가
      const apiDataWithCapacities = submissionData as any;
      if (selectedCapacities.size > 0) {
        apiDataWithCapacities.selected_capacities = Array.from(selectedCapacities);
      }

      // Convert reference_no to reference_number for API compatibility
      const apiData = submissionData as any;
      if (apiData.reference_no !== undefined) {
        apiData.reference_number = apiData.reference_no;
        delete apiData.reference_no;
      }
      
      // Add company_id for API compatibility
      apiData.company_id = customerId || undefined;
      
      // Include selectedProduct for unit_price extraction
      if (selectedProduct) {
        apiData.selectedProduct = {
          item_id: selectedProduct.item_id || selectedProduct.id,
          price: selectedProduct.price || selectedProduct.unit_price || 0,
          unit_price: selectedProduct.unit_price || selectedProduct.price || 0
        };
      }

      // Remove empty optional fields
      Object.keys(apiData).forEach(key => {
        if (apiData[key] === '' || apiData[key] === undefined) {
          delete apiData[key];
        }
      });

      const result = await onSubmit(apiData);

      // Check if submission was successful
      if (result && (result.success !== false)) {
        // Show result modal with auto-deduction details
        setProductionResult(result);
        setSavedBomCheckData(bomCheckData); // Save BOM check data for result modal
        setShowResultModal(true);
        
        // Reset form after successful submission
        setFormData({
          transaction_date: new Date().toISOString().split('T')[0],
          product_item_id: 0,
          quantity: 0,
          reference_no: '',
          use_bom: true,
          scrap_quantity: 0,
          created_by: 1
        });
        setSelectedProduct(null);
        setProcessTypes(['프레스', '용접']); // 기본값으로 리셋
        setSelectedCapacities(new Set());
        setCustomerId(null);
      } else {
        const errorMessage = (result as any)?.error || '생산 등록에 실패했습니다.';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Production submission error:', error);
      const { extractErrorMessage } = await import('@/lib/fetch-utils');
      showError(`생산 등록 중 오류가 발생했습니다: ${extractErrorMessage(error) || (error instanceof Error ? error.message : '알 수 없는 오류')}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshBom = () => {
    if (selectedProduct && formData.quantity > 0) {
      checkBom(selectedProduct.id, formData.quantity);
    }
  };

  const generateProductionOrder = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    return `PRD-${timestamp}`;
  };

  const handleGenerateReference = () => {
    setFormData(prev => ({
      ...prev,
      reference_no: generateProductionOrder()
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 생산일자 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            생산일자 <span className="text-gray-500">*</span>
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

        {/* 생산오더 번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Factory className="w-4 h-4 inline mr-2" />
            생산오더 번호
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="reference_no"
              value={formData.reference_no}
              onChange={handleChange}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: PRD-20240101001"
            />
            <button
              type="button"
              onClick={handleGenerateReference}
              className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              title="자동 생성"
            >
              <Wrench className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 공정 구분 */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            공정 구분
          </label>
          <div className="flex gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="process_press"
                checked={processTypes.includes('프레스')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setProcessTypes([...processTypes, '프레스']);
                  } else {
                    setProcessTypes(processTypes.filter(p => p !== '프레스'));
                    // 고객사는 유지 (프레스 해제 시에도 고객사 품목 필터링 유지)
                    // setCustomerId(null);
                  }
                }}
              />
              <label htmlFor="process_press" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                프레스
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="process_weld"
                checked={processTypes.includes('용접')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setProcessTypes([...processTypes, '용접']);
                  } else {
                    setProcessTypes(processTypes.filter(p => p !== '용접'));
                  }
                }}
              />
              <label htmlFor="process_weld" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                용접
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="process_coating"
                checked={processTypes.includes('도장')}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setProcessTypes([...processTypes, '도장']);
                  } else {
                    setProcessTypes(processTypes.filter(p => p !== '도장'));
                  }
                }}
              />
              <label htmlFor="process_coating" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                도장
              </label>
            </div>
          </div>
        </div>

        {/* 프레스 용량 선택 (프레스 선택 시에만 표시) - 4개 체크박스로 병렬 선택 가능 */}
        {processTypes.includes('프레스') && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              프레스 용량 (복수 선택 가능)
            </label>
            <div className="flex flex-wrap gap-6">
              {/* 블랭킹 그룹 */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">블랭킹</span>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="capacity_400"
                      checked={selectedCapacities.has(400)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedCapacities);
                        if (checked) {
                          newSet.add(400);
                        } else {
                          newSet.delete(400);
                        }
                        setSelectedCapacities(newSet);
                      }}
                    />
                    <label htmlFor="capacity_400" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      400톤
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="capacity_600"
                      checked={selectedCapacities.has(600)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedCapacities);
                        if (checked) {
                          newSet.add(600);
                        } else {
                          newSet.delete(600);
                        }
                        setSelectedCapacities(newSet);
                      }}
                    />
                    <label htmlFor="capacity_600" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      600톤
                    </label>
                  </div>
                </div>
              </div>
              {/* 프레스 그룹 */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">프레스</span>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="capacity_1000"
                      checked={selectedCapacities.has(1000)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedCapacities);
                        if (checked) {
                          newSet.add(1000);
                        } else {
                          newSet.delete(1000);
                        }
                        setSelectedCapacities(newSet);
                      }}
                    />
                    <label htmlFor="capacity_1000" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      1000톤
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="capacity_1600"
                      checked={selectedCapacities.has(1600)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedCapacities);
                        if (checked) {
                          newSet.add(1600);
                        } else {
                          newSet.delete(1600);
                        }
                        setSelectedCapacities(newSet);
                      }}
                    />
                    <label htmlFor="capacity_1600" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      1600톤
                    </label>
                  </div>
                </div>
              </div>
            </div>
            {selectedCapacities.size > 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                선택: {Array.from(selectedCapacities).sort((a, b) => a - b).map(c => `${c}톤`).join(', ')}
              </p>
            )}
          </div>
        )}

        {/* 고객사 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            고객사 (주문처)
          </label>
          <CompanySelect
            value={customerId}
            onChange={handleCustomerChange}
            companyType="CUSTOMER"
            placeholder="고객사를 선택하세요"
            deliveryOnly={true}
            hideDeliveryPrefix={true}
          />
        </div>

      </div>

      {/* 고객별 품목 목록 */}
      {customerId && (
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
                    const isAlreadyAdded = batchItems.some(i => i.item_id === itemId);
                    
                    return (
                      <tr
                        key={itemId}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                          isAlreadyAdded ? 'opacity-50 bg-gray-100 dark:bg-gray-800' : ''
                        }`}
                        onClick={() => {
                          // 단일 모드에서 품목 클릭 시 자동 선택
                          if (!isBatchMode && !isAlreadyAdded) {
                            handleProductSelect(item);
                          }
                        }}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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

        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 배치 모드 토글 */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                // Clear batch items when switching modes
                if (isBatchMode) {
                  setBatchItems([]);
                } else {
                  // Clear single product when switching to batch mode
                  setSelectedProduct(null);
                  setFormData(prev => ({ ...prev, product_item_id: 0, quantity: 0 }));
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isBatchMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {isBatchMode ? <List className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              {isBatchMode ? '배치 모드' : '단일 모드'}
            </button>
            <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
              {isBatchMode
                ? '여러 제품을 한 번에 생산 등록할 수 있습니다'
                : '한 가지 제품만 생산 등록할 수 있습니다'}
            </div>
          </div>
        </div>

        {/* 단일 모드에서는 고객별 품목 목록 테이블에서만 선택 */}

        {/* 생산수량 */}
        {!isBatchMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            생산수량 <span className="text-gray-500">*</span>
          </label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="1"
            step="1"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.quantity ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="0"
          />
          {selectedProduct && (
            <p className="mt-1 text-sm text-gray-500">단위: {selectedProduct.unit}</p>
          )}
          {errors.quantity && (
            <p className="mt-1 text-sm text-gray-500">{errors.quantity}</p>
          )}
        </div>
        )}

        {/* 스크랩 수량 */}
        {!isBatchMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            스크랩 수량
          </label>
          <input
            type="number"
            name="scrap_quantity"
            value={formData.scrap_quantity}
            onChange={handleChange}
            min="0"
            step="0.01"
            className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.scrap_quantity ? 'border-gray-500' : 'border-gray-300 dark:border-gray-700'
            }`}
            placeholder="0"
          />
          {selectedProduct && (
            <p className="mt-1 text-sm text-gray-500">불량품 또는 스크랩 발생량</p>
          )}
          {errors.scrap_quantity && (
            <p className="mt-1 text-sm text-gray-500">{errors.scrap_quantity}</p>
          )}
        </div>
        )}

        {/* 배치 제품 목록 - 표 형태 */}
        {isBatchMode && (
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                생산 제품 목록 <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({batchItems.length}개)</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  // Add new empty item
                  const newItem: ProductionItem = {
                    product_item_id: 0,
                    item_id: 0,
                    item_code: '',
                    item_name: '',
                    quantity: 0,
                    unit_price: 0,
                    unit: '',
                    reference_no: '',
                    notes: ''
                  };
                  setBatchItems([...batchItems, newItem]);
                }}
                className="px-3 py-1.5 bg-gray-800 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5 text-sm font-medium"
              >
                <Package className="w-4 h-4" />
                제품 추가
              </button>
            </div>

            {batchItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                <p className="text-sm">제품을 추가하여 배치 생산을 시작하세요</p>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
                <table className="w-full" style={{ position: 'relative' }}>
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                        번호
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[300px] border-b border-gray-200 dark:border-gray-700">
                        제품 <span className="text-red-500 font-normal">*</span>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[120px] border-b border-gray-200 dark:border-gray-700">
                        생산수량 <span className="text-red-500 font-normal">*</span>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[80px] border-b border-gray-200 dark:border-gray-700">
                        단위
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[150px] border-b border-gray-200 dark:border-gray-700">
                        참조번호
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[200px] border-b border-gray-200 dark:border-gray-700">
                        비고
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[60px] border-b border-gray-200 dark:border-gray-700">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                    {batchItems.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3" style={{ position: 'relative', overflow: 'visible' }}>
                          <ItemSelect
                            value={item.item_id > 0 ? item.item_id : undefined}
                            onChange={(selectedItem: Item | null) => {
                              const itemId = selectedItem?.item_id || 0;
                              const updatedItems = [...batchItems];
                              updatedItems[index] = {
                                ...updatedItems[index],
                                product_item_id: itemId,
                                item_id: itemId,
                                item_code: selectedItem?.item_code || '',
                                item_name: selectedItem?.item_name || '',
                                unit: selectedItem?.unit || '',
                                unit_price: selectedItem?.unit_price || 0
                              };
                              setBatchItems(updatedItems);
                            }}
                            placeholder={processTypes.includes('프레스') && customerId ? "모 품목 검색..." : customerId ? "고객사 품목 검색..." : "제품 검색..."}
                            required={true}
                            showPrice={true}
                            itemType="PRODUCT"
                            customerId={customerId}
                            error={errors[`batchItem_${index}_product`]}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => {
                              const updatedItems = [...batchItems];
                              updatedItems[index] = {
                                ...updatedItems[index],
                                quantity: Math.floor(parseFloat(e.target.value) || 0)
                              };
                              setBatchItems(updatedItems);
                            }}
                            min="1"
                            step="1"
                            className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 ${
                              errors[`batchItem_${index}_quantity`] 
                                ? 'border-red-500 dark:border-red-500' 
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                            placeholder="0"
                          />
                          {errors[`batchItem_${index}_quantity`] && (
                            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors[`batchItem_${index}_quantity`]}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.unit || ''}
                            onChange={(e) => {
                              const updatedItems = [...batchItems];
                              updatedItems[index] = {
                                ...updatedItems[index],
                                unit: e.target.value
                              };
                              setBatchItems(updatedItems);
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                            placeholder="단위"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.reference_no || ''}
                            onChange={(e) => {
                              const updatedItems = [...batchItems];
                              updatedItems[index] = {
                                ...updatedItems[index],
                                reference_no: e.target.value
                              };
                              setBatchItems(updatedItems);
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                            placeholder="참조번호..."
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => {
                              const updatedItems = [...batchItems];
                              updatedItems[index] = {
                                ...updatedItems[index],
                                notes: e.target.value
                              };
                              setBatchItems(updatedItems);
                            }}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                            placeholder="비고..."
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              const updatedItems = batchItems.filter((_, i) => i !== index);
                              setBatchItems(updatedItems);
                              
                              // 품목 제거 시 고객별 품목 목록 갱신 (제거된 품목을 다시 목록에 표시)
                              if (customerId) {
                                await fetchItemsByCustomer(customerId, processTypes, selectedCapacities);
                              }
                            }}
                            className="px-2 py-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors text-sm font-medium"
                            title="제품 제거"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {errors.batchItems && (
                  <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-red-500 dark:text-red-400">{errors.batchItems}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {/* BOM 사용 여부 */}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="use_bom"
              checked={formData.use_bom}
              onChange={handleChange}
              className="w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              BOM(Bill of Materials)을 사용하여 자재 자동 차감
            </span>
          </label>
          <p className="mt-1 text-sm text-gray-500">
            체크 시 등록된 BOM에 따라 필요한 자재가 자동으로 출고됩니다.
          </p>
        </div>

      </div>

      {/* BOM Preview Panel */}
      {formData.use_bom && (
        <>
          {/* Single mode BOM panel */}
          {!isBatchMode && selectedProduct && formData.quantity > 0 && (
            <BOMPreviewPanel
              bomCheckData={bomCheckData}
              loading={bomLoading}
              error={bomError}
              onRefresh={handleRefreshBom}
            />
          )}
          
          {/* Batch mode BOM panel */}
          {isBatchMode && batchItems.length > 0 && (
            <BOMPreviewPanel
              bomCheckData={null}
              loading={false}
              error={null}
              batchMode={true}
              batchItems={batchItems}
              batchBomChecks={batchBomChecks}
              onRefresh={() => {
                // Refresh all batch BOMs
                batchItems.forEach(item => {
                  if (item.item_id > 0 && item.quantity > 0) {
                    checkBom(item.item_id, item.quantity);
                  }
                });
              }}
            />
          )}
        </>
      )}

      {/* Stock Error Display */}
      {errors.stock && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">{errors.stock}</p>
        </div>
      )}

      {/* Production Summary */}
      {selectedProduct && formData.quantity > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">생산 요약</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">제품:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {selectedProduct.item_code}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">수량:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.quantity.toLocaleString()} {selectedProduct.unit}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">BOM 사용:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {formData.use_bom ? '예' : '아니오'}
              </span>
            </div>
            {formData.use_bom && bomCheckData && (
              <>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">재고 상태:</span>
                  <span className={`ml-2 font-medium ${bomCheckData.can_produce ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {bomCheckData.can_produce ? '충분' : '부족'}
                  </span>
                </div>
                {!bomCheckData.can_produce && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">최대 생산가능:</span>
                    <span className="ml-2 font-bold text-orange-600 dark:text-orange-400">
                      {bomCheckData.summary.max_producible_quantity}개
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Buttons - sticky footer */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 -mx-6 px-6 py-4 mt-6 flex justify-end gap-4 z-10">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading || bomLoading}
          className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              생산 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {formData.use_bom && bomCheckData && !bomCheckData.can_produce ? '재고 부족 - 그래도 생산 등록' : '생산 등록'}
            </>
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && bomCheckData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                생산 확인
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                아래 정보를 확인하시고 생산을 진행해주세요.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Production Details */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">생산 정보</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">생산일자:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {formData.transaction_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">생산오더:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {formData.reference_no || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">제품:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {bomCheckData.product_info.item_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">생산수량:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {formData.quantity.toLocaleString()} {bomCheckData.product_info.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* BOM Preview in Modal */}
              {formData.use_bom && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">자재 소요</h4>
                  <BOMPreviewPanel
                    bomCheckData={bomCheckData}
                    loading={false}
                    error={null}
                    onRefresh={handleRefreshBom}
                  />
                </div>
              )}

              {/* Warning if cannot produce */}
              {formData.use_bom && !bomCheckData.can_produce && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    
                    <div>
                      <h5 className="font-medium text-gray-800 dark:text-gray-300 mb-1">
                        생산 불가능
                      </h5>
                      <p className="text-sm text-gray-700 dark:text-gray-400">
                        재고가 부족한 자재가 있어 현재 생산이 불가능합니다. 자재를 입고한 후 다시 시도해주세요.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmProduction}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                생산 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showResultModal && productionResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-gray-500" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  생산 완료
                </h3>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                생산이 성공적으로 등록되었습니다.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Production Result Summary */}
              <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">생산 결과</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">거래번호:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {productionResult.data.transaction?.transaction_no}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">생산수량:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {productionResult.data.transaction?.quantity.toLocaleString()} {productionResult.data.transaction?.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">제품재고 변화:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400 font-medium">
                      +{productionResult.data.transaction?.quantity.toLocaleString()} {productionResult.data.transaction?.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">등록일시:</span>
                    <span className="ml-2 text-gray-900 dark:text-white font-medium">
                      {productionResult.data.transaction?.created_at ? new Date(productionResult.data.transaction.created_at).toLocaleString('ko-KR') : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stock Shortage Warning */}
              {productionResult.data.stock_warning && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">
                        재고 부족 경고
                      </h4>
                      <div className="space-y-1 text-sm text-orange-700 dark:text-orange-400">
                        <p>
                          현재 재고로는 <span className="font-bold">{productionResult.data.stock_warning.max_producible.toLocaleString()}</span>까지만 생산 가능합니다.
                        </p>
                        <p>
                          희망 수량: <span className="font-semibold">{formData.quantity.toLocaleString()}</span> → 
                          부족 수량: <span className="font-bold text-red-600 dark:text-red-400">{productionResult.data.stock_warning.shortage_quantity.toLocaleString()}</span>
                        </p>
                        {productionResult.data.stock_warning.bottleneck_materials && productionResult.data.stock_warning.bottleneck_materials.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-orange-600 dark:text-orange-500 font-medium mb-1">부족한 원자재:</p>
                            {productionResult.data.stock_warning.bottleneck_materials.map((item: any, idx: number) => (
                              <p key={idx} className="text-xs text-orange-600 dark:text-orange-500">
                                • {item.item_name} ({item.item_code}): 필요 {item.required.toLocaleString()} / 현재 {item.available.toLocaleString()}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto Deduction Details */}
              {productionResult.data.auto_deductions && productionResult.data.auto_deductions.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    자재 자동 차감 내역
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">품목코드</th>
                          <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">품목명</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">차감수량</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">차감 전</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">차감 후</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productionResult.data.auto_deductions?.map((deduction, index) => (
                          <tr key={index} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <td className="py-2 px-3 text-gray-900 dark:text-white font-mono text-xs">
                              {deduction.item_code}
                            </td>
                            <td className="py-2 px-3 text-gray-900 dark:text-white">
                              {deduction.item_name}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400 font-medium">
                              -{deduction.deducted_quantity.toLocaleString()} {deduction.unit}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                              {deduction.stock_before.toLocaleString()} {deduction.unit}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-900 dark:text-white font-medium">
                              {deduction.stock_after.toLocaleString()} {deduction.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowResultModal(false);
                  setProductionResult(null);
                  onCancel(); // Close the form and return to list
                }}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}