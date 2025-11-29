'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToastNotification } from '@/hooks/useToast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2
} from 'lucide-react';
import BOMDeductionResults from './BOMDeductionResults';
import { useBomCheck } from '@/lib/hooks/useBomCheck';
import { useDebounce } from '@/lib/hooks/useDebounce';
import BOMPreviewPanel from '@/components/inventory/BOMPreviewPanel';
import CompanySelect from '@/components/CompanySelect';

const productionSchema = z.object({
  transaction_date: z.string().min(1, '거래일자를 선택해주세요'),
  item_id: z.string().min(1, '품목을 선택해주세요'),
  quantity: z.number().int().positive('수량은 0보다 큰 정수여야 합니다'),
  unit_price: z.number().min(0, '단가는 0 이상이어야 합니다'),
  transaction_type: z.enum(['생산입고', '생산출고'], '거래유형을 선택해주세요'),
  company_id: z.number().nullable().optional(),
  reference_number: z.string().optional(),
  created_by: z.number().positive('작성자 ID가 필요합니다')
});

type ProductionFormData = z.infer<typeof productionSchema>;

// Batch mode interfaces
interface BatchItem {
  item_id: number;
  item_code?: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
}

interface BatchSubmissionData {
  transaction_date: string;
  items: BatchItem[];
  reference_no?: string;
  notes?: string;
  use_bom: boolean;
  created_by: number;
  process_types?: ('프레스' | '용접' | '도장')[];
  press_capacity?: number;
}

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  spec: string;
  unit: string;
  category: string;
}

interface BOMDeduction {
  log_id: number;
  child_item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  deducted_quantity: number;
  usage_rate: number;
  stock_before: number;
  stock_after: number;
}

interface ProductionEntryFormProps {
  onSuccess?: () => void;
}

export default function ProductionEntryForm({ onSuccess }: ProductionEntryFormProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [bomDeductions, setBomDeductions] = useState<BOMDeduction[]>([]);
  const [stockError, setStockError] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [currentBatchItem, setCurrentBatchItem] = useState<Partial<BatchItem>>({});
  const toast = useToastNotification();
  
  // 공정 구분 상태 (프레스, 용접, 도장)
  const [processTypes, setProcessTypes] = useState<('프레스' | '용접' | '도장')[]>(['프레스', '용접']); // 기본값: 프레스, 용접
  const [pressCapacity, setPressCapacity] = useState<number | undefined>(undefined);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [loadingCustomerItems, setLoadingCustomerItems] = useState(false);

  // BOM 체크 훅 추가
  const { data: bomCheckData, loading: bomLoading, error: bomError, checkBom } = useBomCheck();
  const debouncedCheckBom = useDebounce(checkBom, 500);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
        setValue,
    watch,
    getValues
  } = useForm<ProductionFormData>({
    resolver: zodResolver(productionSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: '생산입고',
      created_by: 1, // admin user_id from users table
      company_id: null,
      quantity: 1
    }
  });

  const selectedItemId = watch('item_id');
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');
  const totalAmount = quantity && unitPrice ? quantity * unitPrice : 0;

  // 프레스 선택 해제 시 관련 상태 초기화
  useEffect(() => {
    if (!processTypes.includes('프레스')) {
      setPressCapacity(undefined);
      setCustomerId(null);
      setValue('company_id', null);
    }
  }, [processTypes, setValue]);

  // Fetch items on mount or when customer changes
  useEffect(() => {
    const fetchItems = async () => {
      setItemsLoading(true);
      try {
        // 프레스 선택 시: 고객사 선택 전에는 전체 모 품목 조회, 고객사 선택 후에는 해당 고객사의 모 품목만 조회
        if (processTypes.includes('프레스')) {
          if (customerId) {
            // 고객사 선택 시: 해당 고객사의 모 품목만 조회
            // 프레스 용량이 선택된 경우 필터링 파라미터 추가
            let url = `/api/items/by-customer?customer_id=${customerId}&limit=1000`;
            if (pressCapacity) {
              url += `&press_capacity=${pressCapacity}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
              setItems(data.data.items || []);
            } else {
              const { extractErrorMessage } = await import('@/lib/fetch-utils');
              toast.error('모 품목 조회 실패', extractErrorMessage(data.error) || '모 품목 목록을 불러올 수 없습니다');
              setItems([]);
            }
          } else {
            // 프레스 선택했지만 고객사 미선택: 전체 품목 조회 (나중에 모 품목만 필터링하는 API 추가 가능)
            const response = await fetch('/api/items?is_active=true&limit=1000');
            const data = await response.json();

            if (data.success) {
              setItems(data.data.items || []);
            } else {
              const { extractErrorMessage } = await import('@/lib/fetch-utils');
              toast.error('품목 조회 실패', extractErrorMessage(data.error) || '품목 목록을 불러올 수 없습니다');
              setItems([]);
            }
          }
        } else {
          // 프레스 미선택: 전체 품목 조회
          const response = await fetch('/api/items?is_active=true&limit=1000');
          const data = await response.json();

          if (data.success) {
            setItems(data.data.items || []);
          } else {
            const { extractErrorMessage } = await import('@/lib/fetch-utils');
            toast.error('품목 조회 실패', extractErrorMessage(data.error) || '품목 목록을 불러올 수 없습니다');
            setItems([]);
          }
        }
      } catch (error) {
        toast.error('오류 발생', '품목 목록을 불러오는 중 오류가 발생했습니다');
        setItems([]);
      } finally {
        setItemsLoading(false);
      }
    };

    fetchItems();
  }, [toast, processTypes, customerId, pressCapacity]); // pressCapacity 의존성 추가

  // BOM 체크 - 품목과 수량이 변경될 때 실시간으로 확인
  useEffect(() => {
    if (selectedItemId && quantity && Number(quantity) > 0) {
      const productItemId = parseInt(selectedItemId);
      if (!isNaN(productItemId)) {
        debouncedCheckBom(productItemId, Number(quantity));
      }
    }
  }, [selectedItemId, quantity, debouncedCheckBom]);

  const onSubmit = async (data: ProductionFormData) => {
    // 중복 제출 방지
    if (loading) {
      toast.warning('처리 중', '이미 처리 중인 요청이 있습니다. 잠시만 기다려주세요.');
      return;
    }

    setLoading(true);
    setStockError(null);
    setBomDeductions([]);

    try {
      // Batch mode submission
      if (batchMode && batchItems.length > 0) {
        const batchData: BatchSubmissionData = {
          transaction_date: data.transaction_date,
          items: batchItems.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: item.unit_price
          })),
          reference_no: data.reference_number,
          use_bom: true,
          created_by: data.created_by,
          process_types: processTypes.length > 0 ? processTypes : undefined,
          press_capacity: pressCapacity || undefined
        };

        // Idempotency Key 생성
        const { generateIdempotencyKey, extractKeyData } = await import('@/lib/utils/idempotency');
        const keyData = extractKeyData(batchData);
        const idempotencyKey = generateIdempotencyKey(data.created_by || 1, keyData);

        const response = await fetch('/api/inventory/production/batch', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(batchData)
        });

        const result = await response.json();

        if (!response.ok) {
          if (result.error) {
            const { extractErrorMessage } = await import('@/lib/fetch-utils');
            const errorMsg = extractErrorMessage(result.error);
            setStockError(errorMsg);
            toast.error('일괄 등록 실패', errorMsg);
          }
          return;
        }

        if (result.success) {
          const summary = result.data.summary;
          const msg = `${summary.total_count}개 품목 일괄 등록 완료 (총 수량: ${summary.total_quantity})`;
          toast.success('일괄 등록 성공', msg);

          // Reset batch items
          setBatchItems([]);
          setCurrentBatchItem({});

          // Reset form
          reset({
            transaction_date: new Date().toISOString().split('T')[0],
            transaction_type: '생산입고',
            created_by: 1,
            company_id: null,
            item_id: '',
            quantity: 1,
            unit_price: undefined,
            reference_number: ''
          });
          setProcessTypes(['프레스', '용접']);
          setPressCapacity(undefined);
          setCustomerId(null);

          if (onSuccess) onSuccess();
        }
        return;
      }

      // Single item mode submission (existing logic)
      const requestBody = {
        ...data,
        item_id: parseInt(data.item_id),
        quantity: Number(data.quantity),
        unit_price: Number(data.unit_price),
        company_id: data.company_id ? Number(data.company_id) : null,
        process_types: processTypes.length > 0 ? processTypes : undefined,
        press_capacity: pressCapacity || undefined
      };

      // Idempotency Key 생성
      const { generateIdempotencyKey, extractKeyData } = await import('@/lib/utils/idempotency');
      const keyData = extractKeyData(requestBody);
      const idempotencyKey = generateIdempotencyKey(data.created_by || 1, keyData);

      const response = await fetch('/api/inventory/production', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check for stock shortage error
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        const errorMsg = extractErrorMessage(result.error);
        if (errorMsg?.includes('재고 부족')) {
          setStockError(errorMsg);
          if (result.hint) {
            setStockError(`${errorMsg}\n${result.hint}`);
          }
          toast.error('재고 부족', errorMsg);
        } else {
          throw new Error(errorMsg || '생산 등록에 실패했습니다');
        }
        return;
      }

      if (result.success) {
        const deductionMsg = result.data.auto_deductions && result.data.auto_deductions.length > 0
          ? `${result.message} (${result.data.auto_deductions.length}개 원자재 자동 차감 완료)`
          : result.message;

        toast.success('생산 등록 완료', deductionMsg);

        // Display BOM deduction results
        if (result.data.auto_deductions && result.data.auto_deductions.length > 0) {
          setBomDeductions(result.data.auto_deductions);
        }

        // Reset form
        reset({
          transaction_date: new Date().toISOString().split('T')[0],
          transaction_type: '생산입고',
          created_by: 1, // admin user_id from users table
          company_id: null,
          item_id: '',
          quantity: 1,
          unit_price: undefined,
          reference_number: ''
        });
        setProcessTypes(['프레스', '용접']);
        setPressCapacity(undefined);
        setCustomerId(null);

        // Trigger parent refresh
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      toast.error('오류 발생', error.message || '생산 등록 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // Batch item management functions
  const addBatchItem = () => {
    if (!currentBatchItem.item_id || !currentBatchItem.quantity || currentBatchItem.unit_price === undefined) {
      toast.error('입력 오류', '품목, 수량, 단가를 모두 입력해주세요');
      return;
    }

    const selectedItem = items.find(item => item.item_id === currentBatchItem.item_id);
    if (!selectedItem) {
      toast.error('품목 오류', '선택한 품목을 찾을 수 없습니다');
      return;
    }

    const newBatchItem: BatchItem = {
      item_id: currentBatchItem.item_id,
      item_code: selectedItem.item_code,
      item_name: selectedItem.item_name,
      quantity: currentBatchItem.quantity,
      unit_price: currentBatchItem.unit_price
    };

    setBatchItems([...batchItems, newBatchItem]);
    setCurrentBatchItem({});
    toast.success('품목 추가', `${selectedItem.item_name}이(가) 목록에 추가되었습니다`);
  };

  const removeBatchItem = (index: number) => {
    const updated = batchItems.filter((_, i) => i !== index);
    setBatchItems(updated);
    toast.info('품목 제거', '품목이 목록에서 제거되었습니다');
  };

  const toggleBatchMode = () => {
    if (batchMode && batchItems.length > 0) {
      if (!confirm('일괄 등록 모드를 해제하면 추가한 품목 목록이 초기화됩니다. 계속하시겠습니까?')) {
        return;
      }
      setBatchItems([]);
      setCurrentBatchItem({});
    }
    setBatchMode(!batchMode);
  };

  const selectedItem = items.find(item => item.item_id === parseInt(selectedItemId));

  return (
    <div className="space-y-6">
      {/* Batch Mode Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
        <div>
          <h3 className="font-semibold">
            {batchMode ? '일괄 등록 모드' : '단일 등록 모드'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {batchMode
              ? '여러 품목을 한 번에 등록할 수 있습니다'
              : '한 번에 하나의 품목만 등록됩니다'}
          </p>
        </div>
        <Button
          type="button"
          variant={batchMode ? "default" : "outline"}
          onClick={toggleBatchMode}
          disabled={loading}
        >
          {batchMode ? '단일 모드로 전환' : '일괄 모드로 전환'}
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Stock Error Alert */}
        {stockError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>재고 부족</AlertTitle>
            <AlertDescription className="whitespace-pre-line">
              {stockError}
            </AlertDescription>
          </Alert>
        )}

        {/* Common Fields: Transaction Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="transaction_date">
              거래일자 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="transaction_date"
              type="date"
              {...register('transaction_date')}
              max={new Date().toISOString().split('T')[0]}
            />
            {errors.transaction_date && (
              <p className="text-sm text-destructive">{errors.transaction_date.message}</p>
            )}
          </div>

          {/* Reference Number - Common for both modes */}
          <div className="space-y-2">
            <Label htmlFor="reference_number">생산오더 번호 (참조번호)</Label>
            <div className="flex gap-2">
              <Input
                id="reference_number"
                placeholder="예: PROD-2025-001"
                {...register('reference_number')}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, '0');
                  const day = String(now.getDate()).padStart(2, '0');
                  const timestamp = Date.now().toString().slice(-6);
                  const generatedRef = `PRD-${year}${month}${day}-${timestamp}`;
                  setValue('reference_number', generatedRef);
                }}
                title="자동 생성"
              >
                자동 생성
              </Button>
            </div>
          </div>
        </div>

        {/* Conditional Rendering: Single Mode vs Batch Mode */}
        {!batchMode ? (
          /* Single Item Mode */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Transaction Type */}
            <div className="space-y-2">
              <Label htmlFor="transaction_type">
                거래유형 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('transaction_type')}
                onValueChange={(value) => setValue('transaction_type', value as '생산입고' | '생산출고')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="거래유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="생산입고">생산입고</SelectItem>
                  <SelectItem value="생산출고">생산출고</SelectItem>
                </SelectContent>
              </Select>
              {errors.transaction_type && (
                <p className="text-sm text-destructive">{errors.transaction_type.message}</p>
              )}
            </div>

            {/* Item Selection */}
            <div className="space-y-2">
              <Label htmlFor="item_id">
                품목 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedItemId}
                onValueChange={(value) => setValue('item_id', value)}
                disabled={itemsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={itemsLoading ? "품목 불러오는 중..." : "품목 선택"} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.item_id} value={item.item_id.toString()}>
                      [{item.item_code}] {item.item_name} {item.spec && `(${item.spec})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.item_id && (
                <p className="text-sm text-destructive">{errors.item_id.message}</p>
              )}
              {selectedItem && (
                <p className="text-sm text-muted-foreground">
                  단위: {selectedItem.unit} | 분류: {selectedItem.category}
                </p>
              )}
            </div>

            {/* 공정 구분 */}
            <div className="space-y-2">
              <Label>공정 구분</Label>
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
                        setPressCapacity(undefined);
                        setCustomerId(null);
                        setValue('company_id', null);
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

            {/* 프레스 용량 선택 (프레스 선택 시에만 표시) */}
            {processTypes.includes('프레스') && (
              <div className="space-y-2">
                <Label htmlFor="press_capacity">프레스 용량</Label>
                <Select
                  value={pressCapacity?.toString() || ''}
                  onValueChange={(value) => {
                    console.log('[ProductionEntryForm] 프레스 용량 선택:', value);
                    setPressCapacity(parseInt(value));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="프레스 용량 선택" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="400">400톤</SelectItem>
                    <SelectItem value="600">600톤</SelectItem>
                    <SelectItem value="800">800톤</SelectItem>
                    <SelectItem value="1000">1000톤</SelectItem>
                    <SelectItem value="1600">1600톤</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 고객사 선택 (프레스 선택 시에만 표시) */}
            {processTypes.includes('프레스') && (
              <div className="space-y-2">
                <Label htmlFor="company_id">고객사 (주문처)</Label>
                <CompanySelect
                  value={customerId}
                  onChange={(value) => {
                    const numValue = value ? Number(value) : null;
                    setCustomerId(numValue);
                    setValue('company_id', numValue);
                  }}
                  companyType="CUSTOMER"
                  placeholder="고객사를 선택하세요"
                />
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                수량 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                step="1"
                min="1"
                placeholder="1"
                {...register('quantity', { valueAsNumber: true, setValueAs: (v) => v === '' ? 1 : Math.floor(Number(v)) })}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            {/* Unit Price */}
            <div className="space-y-2">
              <Label htmlFor="unit_price">
                단가 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                placeholder="0"
                {...register('unit_price', { valueAsNumber: true })}
              />
              {errors.unit_price && (
                <p className="text-sm text-destructive">{errors.unit_price.message}</p>
              )}
            </div>

            {/* Total Amount Display */}
            <div className="space-y-2">
              <Label>총 금액</Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 py-2">
                <span className="text-lg font-semibold">
                  {totalAmount.toLocaleString('ko-KR')} 원
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Batch Mode */
          <div className="space-y-6">
            {/* 공정 구분 - Batch Mode에서도 표시 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 공정 구분 */}
              <div className="space-y-2">
                <Label>공정 구분</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="batch_process_press"
                      checked={processTypes.includes('프레스')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setProcessTypes([...processTypes, '프레스']);
                        } else {
                          setProcessTypes(processTypes.filter(p => p !== '프레스'));
                          setPressCapacity(undefined);
                          setCustomerId(null);
                          setValue('company_id', null);
                        }
                      }}
                    />
                    <label htmlFor="batch_process_press" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      프레스
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="batch_process_weld"
                      checked={processTypes.includes('용접')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setProcessTypes([...processTypes, '용접']);
                        } else {
                          setProcessTypes(processTypes.filter(p => p !== '용접'));
                        }
                      }}
                    />
                    <label htmlFor="batch_process_weld" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      용접
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="batch_process_coating"
                      checked={processTypes.includes('도장')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setProcessTypes([...processTypes, '도장']);
                        } else {
                          setProcessTypes(processTypes.filter(p => p !== '도장'));
                        }
                      }}
                    />
                    <label htmlFor="batch_process_coating" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      도장
                    </label>
                  </div>
                </div>
              </div>

              {/* 프레스 용량 선택 (프레스 선택 시에만 표시) */}
              {processTypes.includes('프레스') && (
                <div className="space-y-2">
                  <Label htmlFor="batch_press_capacity">프레스 용량</Label>
                  <Select
                    value={pressCapacity?.toString() || ''}
                    onValueChange={(value) => {
                      console.log('[ProductionEntryForm-Batch] 프레스 용량 선택:', value);
                      setPressCapacity(parseInt(value));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="프레스 용량 선택" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="400">400톤</SelectItem>
                      <SelectItem value="600">600톤</SelectItem>
                      <SelectItem value="800">800톤</SelectItem>
                      <SelectItem value="1000">1000톤</SelectItem>
                      <SelectItem value="1600">1600톤</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* 고객사 선택 (프레스 선택 시에만 표시) - Batch Mode */}
            {processTypes.includes('프레스') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="batch_company_id">고객사 (주문처)</Label>
                  <CompanySelect
                    value={customerId}
                    onChange={(value) => {
                      const numValue = value ? Number(value) : null;
                      setCustomerId(numValue);
                      setValue('company_id', numValue);
                    }}
                    companyType="CUSTOMER"
                    placeholder="고객사를 선택하세요"
                  />
                </div>
              </div>
            )}

            {/* Batch Item Input Section */}
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="font-semibold mb-4">품목 추가</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Item Selection */}
                <div className="space-y-2">
                  <Label>품목 <span className="text-destructive">*</span></Label>
                  <Select
                    value={currentBatchItem.item_id?.toString() || ''}
                    onValueChange={(value) => setCurrentBatchItem({ ...currentBatchItem, item_id: parseInt(value) })}
                    disabled={itemsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={itemsLoading ? "품목 불러오는 중..." : "품목 선택"} />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.item_id} value={item.item_id.toString()}>
                          [{item.item_code}] {item.item_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label>수량 <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="수량"
                    value={currentBatchItem.quantity || ''}
                    onChange={(e) => setCurrentBatchItem({ ...currentBatchItem, quantity: Math.floor(parseFloat(e.target.value) || 0) })}
                  />
                </div>

                {/* Unit Price */}
                <div className="space-y-2">
                  <Label>단가 <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="단가"
                    value={currentBatchItem.unit_price !== undefined ? currentBatchItem.unit_price : ''}
                    onChange={(e) => setCurrentBatchItem({ ...currentBatchItem, unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {/* Add Button */}
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={addBatchItem}
                    className="w-full"
                    variant="default"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    추가
                  </Button>
                </div>
              </div>
            </div>

            {/* Batch Items Table */}
            {batchItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">품목코드</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">품목명</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">수량</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">단가</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">합계</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batchItems.map((item, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">{item.item_code}</td>
                        <td className="px-4 py-3 text-sm">{item.item_name}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.unit_price.toLocaleString()} 원</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          {(item.quantity * item.unit_price).toLocaleString()} 원
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeBatchItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">총 합계:</td>
                      <td className="px-4 py-3 text-sm font-bold text-right">
                        {batchItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toLocaleString()} 원
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {batchItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                추가된 품목이 없습니다. 위에서 품목을 추가해주세요.
              </div>
            )}
          </div>
        )}

        {/* BOM 분석 결과 미리보기 - Only in single mode */}
        {!batchMode && selectedItemId && quantity && Number(quantity) > 0 && (
          <BOMPreviewPanel
            bomCheckData={bomCheckData}
            loading={bomLoading}
            error={bomError}
            onRefresh={() => {
              const productItemId = parseInt(selectedItemId);
              if (!isNaN(productItemId)) {
                checkBom(productItemId, Number(quantity));
              }
            }}
          />
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (batchMode) {
                setBatchItems([]);
                setCurrentBatchItem({});
              }
              reset();
            }}
            disabled={loading}
          >
            초기화
          </Button>
          <Button
            type="submit"
            disabled={loading || (batchMode && batchItems.length === 0)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? '등록 중...' : (batchMode ? '일괄 등록' : '생산 등록')}
          </Button>
        </div>
      </form>

      {/* BOM Deduction Results */}
      {bomDeductions.length > 0 && (
        <div className="mt-8">
          <BOMDeductionResults deductions={bomDeductions} />
        </div>
      )}
    </div>
  );
}
