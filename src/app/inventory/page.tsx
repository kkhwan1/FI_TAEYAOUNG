'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  Package,
  Factory,
  Truck,
  Upload,
  History,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  RotateCcw
} from 'lucide-react';
import Modal from '@/components/Modal';
import ReceivingForm from '@/components/ReceivingForm';
import ProductionForm from '@/components/ProductionForm';
import ShippingForm from '@/components/ShippingForm';
import { TransactionsExportButton, StockExportButton } from '@/components/ExcelExportButton';
import PrintButton from '@/components/PrintButton';
import ExcelUploadModal from '@/components/upload/ExcelUploadModal';
import {
  InventoryTransaction,
  StockInfo,
  InventoryTab,
  StockStatus,
  ReceivingFormData,
  ReceivingItem,
  ProductionFormData,
  ShippingFormData,
  TRANSACTION_TYPES
} from '@/types/inventory';
import StockHistoryViewer from '@/components/stock/StockHistoryViewer';
import {
  INVENTORY_TYPE_OPTIONS,
  type InventoryType
} from '@/lib/constants/inventoryTypes';
import { useCompanyFilter } from '@/contexts/CompanyFilterContext';
import { CompanyFilterSelect } from '@/components/filters';
import { useToast } from '@/contexts/ToastContext';

// Search params를 사용하는 내부 컴포넌트
function InventoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL 파라미터에서 탭 가져오기, 기본값은 'receiving'
  // 유효한 탭만 허용하여 'history' 등 잘못된 값 방지
  const validTabs = ['receiving', 'production', 'shipping'] as const;
  const tabFromUrl = searchParams?.get('tab');
  const initialTab = (tabFromUrl && validTabs.includes(tabFromUrl as any))
    ? (tabFromUrl as 'receiving' | 'production' | 'shipping')
    : 'receiving';

  const [activeTab, setActiveTab] = useState<'receiving' | 'production' | 'shipping'>(initialTab);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [stockInfo, setStockInfo] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [selectedTransactionForShortage, setSelectedTransactionForShortage] = useState<any>(null);
  // 정렬 상태 추가
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  // 수정/삭제 관련 상태
  const [selectedTransaction, setSelectedTransaction] = useState<InventoryTransaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingTransactionId, setDeletingTransactionId] = useState<number | null>(null);
  const [stockLastUpdated, setStockLastUpdated] = useState<Date | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showStockHistory, setShowStockHistory] = useState(false);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<number | null>(null);
  // Phase 3 - Inventory Classification filter
  const [selectedClassification, setSelectedClassification] = useState<InventoryType | null>(null);
  // Company filter state using shared hook
  const [selectedCompany, setSelectedCompany] = useState<number | 'ALL'>('ALL');
  const { companies: companyOptions, loading: companiesLoading } = useCompanyFilter();
  // Toast notifications for non-blocking UX
  const { success: showSuccess, error: showError } = useToast();
  // TASK-001: Comprehensive search filter state
  const [searchTerm, setSearchTerm] = useState<string>('');

  const tabs: InventoryTab[] = [
    {
      id: 'receiving',
      label: '입고 관리',
      icon: Package,
      description: '자재 및 제품 입고 처리',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20'
    },
    {
      id: 'production',
      label: '생산 관리',
      icon: Factory,
      description: 'BOM 기반 생산 처리',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20'
    },
    {
      id: 'shipping',
      label: '출고 관리',
      icon: Truck,
      description: '제품 출고 및 배송',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20'
    }
  ];

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // 같은 컬럼 클릭 시 정렬 순서 토글
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 컬럼 클릭 시 해당 컬럼으로 정렬 (기본: 내림차순)
      setSortColumn(column);
      setSortOrder('desc');
    }
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedClassification(null);
    setSelectedCompany('ALL');
  };

  const activeTabInfo = tabs.find(tab => tab.id === activeTab)!;

  // 인쇄용 컬럼 정의 - 거래 내역
  const transactionPrintColumns = [
    { key: 'transaction_date', label: '거래일', align: 'center' as const, width: '12%', type: 'date' as const },
    { key: 'transaction_type', label: '구분', align: 'center' as const, width: '8%' },
    { key: 'item_code', label: '품번', align: 'left' as const, width: '12%' },
    { key: 'item_name', label: '품명', align: 'left' as const, width: '18%' },
    { key: 'quantity', label: '수량', align: 'right' as const, width: '10%', type: 'number' as const },
    { key: 'unit_price', label: '단가', align: 'right' as const, width: '12%', type: 'currency' as const },
    { key: 'total_amount', label: '금액', align: 'right' as const, width: '12%', type: 'currency' as const },
    { key: 'company_name', label: '거래처', align: 'left' as const, width: '12%' },
    { key: 'reference_no', label: '참조번호', align: 'left' as const, width: '14%' }
  ];

  // 인쇄용 컬럼 정의 - 재고 현황
  const stockPrintColumns = [
    { key: 'item_code', label: '품번', align: 'left' as const, width: '15%' },
    { key: 'item_name', label: '품명', align: 'left' as const, width: '25%' },
    { key: 'current_stock', label: '현재고', align: 'right' as const, width: '12%', type: 'number' as const },
    { key: 'min_stock_level', label: '최소재고', align: 'right' as const, width: '12%', type: 'number' as const },
    { key: 'stock_value', label: '재고금액', align: 'right' as const, width: '15%', type: 'currency' as const },
    { key: 'location', label: '위치', align: 'left' as const, width: '10%' },
    { key: 'status', label: '상태', align: 'center' as const, width: '11%' }
  ];

  // URL 파라미터가 변경되면 activeTab 업데이트
  useEffect(() => {
    const tab = searchParams?.get('tab') as 'receiving' | 'production' | 'shipping' | null;
    if (tab && ['receiving', 'production', 'shipping'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // activeTab이 변경되면 URL 업데이트
  const handleTabChange = (tab: 'receiving' | 'production' | 'shipping') => {
    setActiveTab(tab);
    router.push(`/inventory?tab=${tab}`);
  };

  useEffect(() => {
    // 초기 로딩 지연: 페이지 로드 직후 네트워크 준비 시간 확보 (100ms)
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [activeTab, sortColumn, sortOrder, refreshKey, selectedCompany]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTransactions(),
        fetchStockInfo()
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      let url = '/api/inventory';
      const params = new URLSearchParams();

      // 정렬 파라미터 추가
      params.append('sort_column', sortColumn);
      params.append('sort_order', sortOrder);

      // 거래처 필터 추가
      if (selectedCompany !== 'ALL') {
        params.append('company_id', selectedCompany.toString());
      }

      switch (activeTab) {
        case 'receiving':
          params.append('type', '입고');
          break;
        case 'production':
          url = '/api/inventory/production';
          break;
        case 'shipping':
          url = '/api/inventory/shipping';
          break;
      }

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson(`${url}?${params}`, {}, {
        timeout: 15000,
        maxRetries: 3,
        retryDelay: 1000
      });

      if (data.success) {
        // Handle paginated response structure
        const transactionsData = data.data?.data || data.data?.transactions || data.data || [];
        setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchStockInfo = async () => {
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson('/api/stock', {}, {
        timeout: 15000,
        maxRetries: 3,
        retryDelay: 1000
      });

      if (data.success) {
        setStockInfo(data.data || []);
        // 현재 시간으로 업데이트 (실시간 반영)
        setStockLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch stock info:', error);
    }
  };

  // 실시간 자동 업데이트 (5초마다)
  useEffect(() => {
    fetchStockInfo(); // 초기 로드
    
    const interval = setInterval(() => {
      fetchStockInfo();
    }, 5000); // 5초마다 업데이트

    return () => clearInterval(interval);
  }, []);

  // 거래 등록 후 재고 정보 새로고침
  useEffect(() => {
    if (refreshKey > 0) {
      fetchStockInfo();
    }
  }, [refreshKey]);


  const handleEdit = (transaction: InventoryTransaction) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedTransaction(null);
    // 모달 닫힌 후 재고 정보 새로고침 (추가 보장)
    setTimeout(() => {
      fetchStockInfo();
      fetchTransactions();
    }, 500);
  };

  const handleDelete = (transaction: InventoryTransaction) => {
    setSelectedTransaction(transaction);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedTransaction) return;

    try {
      const transactionId = selectedTransaction.transaction_id ?? 0;
      setDeletingTransactionId(transactionId);
      let url = '';
      switch (activeTab) {
        case 'receiving':
          url = `/api/inventory/receiving?id=${transactionId}`;
          break;
        case 'production':
          url = `/api/inventory/production?id=${transactionId}`;
          break;
        case 'shipping':
          url = `/api/inventory/shipping?id=${transactionId}`;
          break;
        default:
          url = `/api/inventory/transactions?id=${transactionId}`;
      }

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(url, {
        method: 'DELETE',
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(transactionId);
          return next;
        });
        setShowDeleteConfirm(false);
        setSelectedTransaction(null);
        setRefreshKey(prev => prev + 1);
        // 즉시 재고 정보 및 거래 내역 새로고침
        await Promise.all([
          fetchStockInfo(),
          fetchTransactions()
        ]);
        showSuccess('거래가 삭제되었습니다.');
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        showError(extractErrorMessage(result.error) || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      showError('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingTransactionId(null);
    }
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTransactions.map(tx => tx.transaction_id ?? 0).filter(id => id !== 0)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 개별 선택/해제
  const handleSelectItem = (transactionId: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(transactionId);
      } else {
        next.delete(transactionId);
      }
      return next;
    });
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`선택한 ${selectedIds.size}개 거래를 삭제하시겠습니까?`)) return;

    const idsToDelete = Array.from(selectedIds);
    setDeletingTransactionId(-1); // 일괄 삭제 중 표시

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const deletePromises = idsToDelete.map(id => {
        let url = '';
        switch (activeTab) {
          case 'receiving':
            url = `/api/inventory/receiving?id=${id}`;
            break;
          case 'production':
            url = `/api/inventory/production?id=${id}`;
            break;
          case 'shipping':
            url = `/api/inventory/shipping?id=${id}`;
            break;
          default:
            url = `/api/inventory/transactions?id=${id}`;
        }
        return safeFetchJson(url, {
          method: 'DELETE'
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        });
      });

      const results = await Promise.allSettled(deletePromises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      if (failed.length > 0) {
        showError(`${failed.length}개 거래 삭제에 실패했습니다.`);
      } else {
        showSuccess(`${idsToDelete.length}개 거래가 삭제되었습니다.`);
      }

      setSelectedIds(new Set());
      setRefreshKey(prev => prev + 1);
      await Promise.all([
        fetchStockInfo(),
        fetchTransactions()
      ]);
    } catch (error) {
      console.error('Bulk delete error:', error);
      showError('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingTransactionId(null);
    }
  };

  const handleShowShortageDetail = async (transaction: any) => {
    // 해당 거래의 BOM 차감 로그를 가져옴
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: bomLogs } = await supabase
        .from('bom_deduction_log')
        .select(`
          quantity_required,
          deducted_quantity,
          items!child_item_id (
            item_code,
            item_name,
            unit
          )
        `)
        .eq('transaction_id', transaction.transaction_id);

      setSelectedTransactionForShortage({
        ...transaction,
        bomLogs: bomLogs || []
      });
      setShowShortageModal(true);
    } catch (error) {
      console.error('Failed to fetch shortage details:', error);
      showError('부족 상세 정보를 불러올 수 없습니다.');
    }
  };

  const handleFormSubmit = async (formData: ReceivingFormData | ProductionFormData | ShippingFormData) => {
    try {
      let url = '';
      switch (activeTab) {
        case 'receiving':
          url = '/api/inventory/receiving';
          break;
        case 'production':
          url = '/api/inventory/production';
          break;
        case 'shipping':
          url = '/api/inventory/shipping';
          break;
      }

      // Handle shipping/receiving forms with multiple items - Use batch API
      if ((activeTab === 'shipping' || activeTab === 'receiving') && 'items' in formData && Array.isArray(formData.items)) {
        const multiItemData = formData as ShippingFormData | ReceivingFormData;
        
        // Use batch API for multiple items (일괄 등록 기능)
        if (multiItemData.items.length > 0) {
          const batchUrl = activeTab === 'receiving' 
            ? '/api/inventory/receiving/batch'
            : '/api/inventory/shipping/batch';
          
          const batchData = activeTab === 'receiving' ? {
            transaction_date: multiItemData.transaction_date,
            company_id: (multiItemData as ReceivingFormData).company_id,
            items: multiItemData.items.map(item => ({
              item_id: item.item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              lot_no: (item as ReceivingItem).lot_no,
              expiry_date: (item as ReceivingItem).expiry_date,
              to_location: (item as ReceivingItem).to_location,
              arrival_date: multiItemData.transaction_date
            })),
            reference_no: multiItemData.reference_no,
            created_by: multiItemData.created_by || 1
          } : {
            transaction_date: multiItemData.transaction_date,
            customer_id: (multiItemData as ShippingFormData).customer_id,
            items: multiItemData.items.map(item => ({
              item_id: item.item_id,
              quantity: item.quantity,
              unit_price: item.unit_price
            })),
            created_by: multiItemData.created_by || 1
          };

          const { safeFetchJson } = await import('@/lib/fetch-utils');
          const result = await safeFetchJson(batchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchData)
          }, {
            timeout: 30000,
            maxRetries: 2,
            retryDelay: 1000
          });

          if (result.success) {
            setShowModal(false);
            setRefreshKey(prev => prev + 1);
            // 즉시 재고 정보 및 거래 내역 새로고침
            await Promise.all([
              fetchStockInfo(),
              fetchTransactions()
            ]);
            showSuccess(`${multiItemData.items.length}개 품목이 일괄 등록되었습니다.`);
            return;
          } else {
            const { extractErrorMessage } = await import('@/lib/fetch-utils');
            throw new Error(extractErrorMessage(result.error) || '일괄 등록에 실패했습니다.');
          }
        }
        
        // Fallback: Submit each item as a separate transaction (single item case)
        const promises = multiItemData.items.map(async (item) => {
          const singleItemData = activeTab === 'shipping' ? {
            transaction_date: multiItemData.transaction_date,
            company_id: (multiItemData as ShippingFormData).customer_id,
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            created_by: multiItemData.created_by || 1
          } : {
            transaction_date: multiItemData.transaction_date,
            company_id: (multiItemData as ReceivingFormData).company_id,
            item_id: item.item_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            reference_number: multiItemData.reference_no || `RCV-${Date.now()}`,
            lot_no: (item as ReceivingItem).lot_no || null,
            expiry_date: (item as ReceivingItem).expiry_date || null,
            to_location: (item as ReceivingItem).to_location || null,
            created_by: multiItemData.created_by || 1
          };

          const { safeFetchJson } = await import('@/lib/fetch-utils');
          const data = await safeFetchJson(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(singleItemData),
          }, {
            timeout: 15000,
            maxRetries: 2,
            retryDelay: 1000
          });
          
          if (!data.success) {
            const { extractErrorMessage } = await import('@/lib/fetch-utils');
            throw new Error(extractErrorMessage(data.error) || '처리에 실패했습니다');
          }
          
          return data;
        });

        await Promise.all(promises);
        
        setShowModal(false);
        setRefreshKey(prev => prev + 1);
        // 즉시 재고 정보 및 거래 내역 새로고침
        await Promise.all([
          fetchStockInfo(),
          fetchTransactions()
        ]);
        showSuccess(`${activeTabInfo.label} 처리가 완료되었습니다.`);
        return { success: true };
      } else {
        // Handle production form - check for batch items
        if (activeTab === 'production' && 'items' in formData && Array.isArray((formData as any).items) && (formData as any).items.length > 0) {
          // Production batch mode
          const productionData = formData as ProductionFormData;
          const batchUrl = '/api/inventory/production/batch';
          
          const batchData = {
            transaction_date: productionData.transaction_date,
            items: productionData.items!.map(item => ({
              product_item_id: item.product_item_id || item.item_id,
              item_id: item.item_id,
              quantity: item.quantity,
              unit_price: item.unit_price || 0
            })),
            reference_no: productionData.reference_no,
            use_bom: productionData.use_bom,
            created_by: productionData.created_by || 1,
            process_types: (productionData as any).process_types,
            selected_capacities: Array.isArray((productionData as any).selected_capacities) && (productionData as any).selected_capacities.length > 0
              ? (productionData as any).selected_capacities
              : undefined,
            company_id: (productionData as any).company_id
          };

          const { safeFetchJson } = await import('@/lib/fetch-utils');
          const result = await safeFetchJson(batchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchData)
          }, {
            timeout: 30000,
            maxRetries: 2,
            retryDelay: 1000
          });

          if (result.success) {
            setShowModal(false);
            setRefreshKey(prev => prev + 1);
            // 즉시 재고 정보 및 거래 내역 새로고침
            await Promise.all([
              fetchStockInfo(),
              fetchTransactions()
            ]);
            showSuccess(`${productionData.items!.length}개 품목 생산이 일괄 등록되었습니다.`);
            return;
          } else {
            const { extractErrorMessage } = await import('@/lib/fetch-utils');
            throw new Error(extractErrorMessage(result.error) || '생산 일괄 등록에 실패했습니다.');
          }
        }
        
        // Standard submission for receiving and production (single item)
        // Handle PUT (update) vs POST (create)
        const method = selectedTransaction ? 'PUT' : 'POST';
        
        // Production form data transformation
        let requestBody: any;
        if (activeTab === 'production') {
          const productionData = formData as ProductionFormData;
          // Get selected product to get unit_price
          const selectedProduct = (productionData as any).selectedProduct || null;
          
          requestBody = {
            transaction_date: productionData.transaction_date,
            item_id: productionData.product_item_id || (productionData as any).item_id,
            quantity: productionData.quantity,
            unit_price: selectedProduct?.price || selectedProduct?.unit_price || (productionData as any).unit_price || 0,
            transaction_type: '생산입고',
            reference_number: productionData.reference_no || (productionData as any).reference_number,
            use_bom: productionData.use_bom !== undefined ? productionData.use_bom : true,
            created_by: productionData.created_by || 1,
            process_types: (productionData as any).process_types,
            selected_capacities: Array.isArray((productionData as any).selected_capacities) && (productionData as any).selected_capacities.length > 0
              ? (productionData as any).selected_capacities
              : undefined,
            company_id: (productionData as any).company_id
          };

          // Remove undefined/null fields
          Object.keys(requestBody).forEach(key => {
            if (requestBody[key] === undefined || requestBody[key] === null || requestBody[key] === '') {
              delete requestBody[key];
            }
          });
          
          if (selectedTransaction) {
            requestBody.id = selectedTransaction.transaction_id;
          }
        } else {
          requestBody = formData;
        }

        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const data = await safeFetchJson(url, {
          method,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify(requestBody),
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        });

        if (data.success) {
          setShowModal(false);
          setSelectedTransaction(null);
          setRefreshKey(prev => prev + 1);
          
          // 즉시 재고 정보 및 거래 내역 새로고침
          await Promise.all([
            fetchStockInfo(),
            fetchTransactions()
          ]);

          // Show success notification
          showSuccess(`${selectedTransaction ? '수정' : '등록'}이 완료되었습니다.`);
          return data; // Return the response data
        } else {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          const errorMsg = extractErrorMessage(data.error) || '처리에 실패했습니다';
          showError(`오류: ${errorMsg}`);
          throw new Error(errorMsg);
        }
      }
    } catch (error) {
      console.error('Failed to submit form:', error);
      showError('처리 중 오류가 발생했습니다');
      throw error;
    }
  };

  const handleUploadSuccess = async () => {
    // 데이터 새로고침
    setRefreshKey(prev => prev + 1);
    await fetchData();
    
    // 성공 메시지 표시
    showSuccess('엑셀 업로드가 완료되었습니다. 데이터가 반영되었습니다.');
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case '입고':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case '생산입고':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case '생산출고':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case '출고':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStockStatus = (item: StockInfo) => {
    if (!item.min_stock_level) return 'normal';
    if (item.current_stock <= 0) return 'empty';
    if (item.current_stock <= item.min_stock_level) return 'low';
    return 'normal';
  };

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case 'empty':
        return '재고없음';
      case 'low':
        return '재고부족';
      case 'normal':
        return '정상';
      default:
        return '정상';
    }
  };

  // 인쇄용 재고 데이터 변환
  const printableStockData = stockInfo.map(item => {
    const status = getStockStatus(item);
    return {
      ...item,
      status: getStockStatusLabel(status),
      stock_value: (item.current_stock * (item.unit_price || 0)),
      location: item.location || '-'
    };
  });

  const getStockStatusIcon = (status: string) => {
    switch (status) {
      case 'empty':
        return <AlertCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
      case 'low':
        return <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const renderForm = () => {
    const handleCancel = () => {
      setShowModal(false);
      setSelectedTransaction(null);
      // 모달 닫힌 후 재고 정보 새로고침 (추가 보장)
      setTimeout(() => {
        fetchStockInfo();
        fetchTransactions();
      }, 500);
    };

    switch (activeTab) {
      case 'receiving':
        return (
          <ReceivingForm
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            initialData={selectedTransaction ? {
              transaction_date: selectedTransaction.transaction_date || '',
              items: [{
                item_id: selectedTransaction.item_id || 0,
                item_code: (selectedTransaction as any).item_code || '',
                item_name: (selectedTransaction as any).item_name || '',
                unit: (selectedTransaction as any).unit || 'EA',
                quantity: selectedTransaction.quantity || 0,
                unit_price: selectedTransaction.unit_price || 0
              }],
              company_id: (selectedTransaction as any).company_id || undefined,
              reference_no: selectedTransaction.reference_no || '',
              created_by: (selectedTransaction as any).created_by || 1
            } : undefined}
            isEdit={!!selectedTransaction}
          />
        );
      case 'production':
        return (
          <ProductionForm
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            initialData={selectedTransaction ? {
              transaction_date: selectedTransaction.transaction_date || '',
              product_item_id: selectedTransaction.item_id || 0,
              quantity: selectedTransaction.quantity || 0,
              reference_no: selectedTransaction.reference_no || '',
              use_bom: true,
              scrap_quantity: 0,
              created_by: (selectedTransaction as any).created_by || 1
            } : undefined}
            isEdit={!!selectedTransaction}
          />
        );
      case 'shipping':
        return (
          <ShippingForm
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            initialData={selectedTransaction ? {
              transaction_date: selectedTransaction.transaction_date || '',
              customer_id: (selectedTransaction as any).company_id || 0,
              items: [{
                item_id: selectedTransaction.item_id || 0,
                item_code: (selectedTransaction as any).item_code || '',
                item_name: (selectedTransaction as any).item_name || '',
                unit: (selectedTransaction as any).unit || 'EA',
                unit_price: selectedTransaction.unit_price || 0,
                current_stock: (selectedTransaction as any).current_stock || 0,
                quantity: selectedTransaction.quantity || 0,
                total_amount: (selectedTransaction.quantity || 0) * (selectedTransaction.unit_price || 0),
                sufficient_stock: true
              }],
              created_by: (selectedTransaction as any).created_by || 1
            } : undefined}
            isEdit={!!selectedTransaction}
          />
        );
    }
  };

  // Memoized filtered data for both card view and table view
  const filteredStockInfo = useMemo(() => stockInfo
    .filter((item) => !selectedClassification || (item as any).inventory_type === selectedClassification)
    .filter((item) => selectedCompany === 'ALL' || (item as any).company_id === selectedCompany),
  [stockInfo, selectedClassification, selectedCompany]);

  // Filter transactions: classification and search only (company filter is handled server-side)
  const filteredTransactions = useMemo(() => transactions
    .filter((tx) => {
      if (!selectedClassification) return true;
      const txClassification = (tx as any).inventory_type || (tx as any).items?.inventory_type || null;
      return txClassification === selectedClassification;
    })
    .filter((tx) => {
      // TASK-002: Comprehensive search filter logic (with null safety fix)
      if (searchTerm === '') return true;
      const searchLower = searchTerm.toLowerCase().trim();
      return (
        (tx.item_name ?? '').toLowerCase().includes(searchLower) ||
        (tx.item_code ?? '').toLowerCase().includes(searchLower) ||
        (tx.reference_no && tx.reference_no.toLowerCase().includes(searchLower))
      );
    }),
  [transactions, selectedClassification, searchTerm]);

  return (
    <div className="flex flex-col gap-3 sm:gap-6 p-3 sm:p-6 max-w-[2000px] mx-auto">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">재고 관리</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">입고, 생산, 출고 통합 관리</p>
            </div>
          </div>
          <div className="flex flex-nowrap gap-1.5 items-center overflow-x-auto pb-1">
            <PrintButton
              data={printableStockData}
              columns={stockPrintColumns}
              title="재고 현황 보고서"
              orientation="landscape"
              variant="icon"
              className="bg-gray-800 hover:bg-gray-700 text-white whitespace-nowrap text-xs px-2 py-1 flex items-center gap-1 flex-shrink-0"
            />
            <StockExportButton
              stockData={stockInfo}
              className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white flex-shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          {tabs.map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

              {/* Active Tab Content */}
      <div className={`rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700 ${activeTabInfo.bgColor}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activeTabInfo.label}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {activeTabInfo.description}
            </p>
          </div>
          <div className="flex flex-nowrap gap-1.5 items-center overflow-x-auto pb-1">
            <PrintButton
              data={transactions}
              columns={transactionPrintColumns}
              title={`${activeTabInfo.label} 거래 내역`}
              orientation="landscape"
              variant="icon"
              className="bg-gray-800 hover:bg-gray-700 text-white whitespace-nowrap text-xs px-2 py-1 flex items-center gap-1 flex-shrink-0"
            />
            {activeTab === 'production' && (
              <>
                <TransactionsExportButton
                  transactions={transactions.filter(t => t.transaction_type === '생산입고' || t.transaction_type === '생산출고')}
                  type="생산"
                  className="bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white whitespace-nowrap text-xs px-2 py-1 flex items-center gap-1 flex-shrink-0"
                />
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-xs font-medium whitespace-nowrap flex-shrink-0"
                  title="엑셀 파일로 대량 생산 등록"
                >
                  <Upload className="w-3.5 h-3.5" />
                  엑셀 업로드
                </button>
                <button
                  onClick={() => {
                    setSelectedTransaction(null);
                    setShowModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium whitespace-nowrap flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  생산 등록
                </button>
              </>
            )}
            {/* 엑셀 업로드 버튼 (입고 관리, 출고 관리만) */}
            {(activeTab === 'receiving' || activeTab === 'shipping') && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-xs font-medium whitespace-nowrap flex-shrink-0"
                title="엑셀 파일로 대량 입고/출고 등록"
              >
                <Upload className="w-3.5 h-3.5" />
                엑셀 업로드
              </button>
            )}
            {(activeTab === 'receiving' || activeTab === 'shipping') && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {activeTab === 'receiving' && '입고 등록'}
                {activeTab === 'shipping' && '출고 등록'}
              </button>
            )}
          </div>
        </div>

        {/* Real-time Stock Display */}
        {stockInfo.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">실시간 재고 현황</h3>
              {stockLastUpdated && (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>
                    업데이트: {stockLastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
            {/* Filter Section - Classification & Company */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              {/* Classification Filter Dropdown */}
              <div className="flex-1">
                <label htmlFor="classification-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  분류
                </label>
                <select
                  id="classification-filter"
                  value={selectedClassification || ''}
                  onChange={(e) => setSelectedClassification(e.target.value as InventoryType || null)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
                >
                  <option value="">전체 분류</option>
                  {INVENTORY_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Filter Dropdown - Using shared component */}
              <CompanyFilterSelect
                value={selectedCompany}
                onChange={(value) => setSelectedCompany(value === 'ALL' ? 'ALL' : Number(value))}
                showLabel={true}
                label="거래처"
                showLoadingMessage={true}
                width="auto"
                testId="inventory-company-filter"
              />
              
              {/* 필터 초기화 버튼 */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
                  title="필터 초기화"
                >
                  <RotateCcw className="w-4 h-4" />
                  초기화
                </button>
              </div>
            </div>

            {/* TASK-003: Comprehensive Search Filter UI */}
            <div className="mb-4">
              <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                  id="search-filter"
                  type="text"
                  placeholder="품목명, 코드, 참조번호..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStockInfo
                .sort((a, b) => {
                  const dateA = (a as any).last_transaction_date 
                    ? new Date((a as any).last_transaction_date).getTime() 
                    : 0;
                  const dateB = (b as any).last_transaction_date 
                    ? new Date((b as any).last_transaction_date).getTime() 
                    : 0;
                  // 최신순 정렬 (날짜가 없으면 맨 아래로)
                  if (dateA === 0 && dateB === 0) return 0;
                  if (dateA === 0) return 1;
                  if (dateB === 0) return -1;
                  return dateB - dateA; // 내림차순
                })
                .slice(0, 8)
                .map((item) => {
                const status = getStockStatus(item);
                const lastTransactionDate = (item as any).last_transaction_date;
                const lastTransactionType = (item as any).last_transaction_type;
                
                return (
                  <div
                    key={item.item_id}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.item_code}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {item.item_name}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {(item.current_stock || 0).toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {item.unit}
                          </span>
                        </div>
                        {item.min_stock_level && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            최소: {item.min_stock_level.toLocaleString()} {item.unit}
                          </p>
                        )}
                        {/* 최근 거래 정보 */}
                        {lastTransactionDate && (
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              최근 거래: {lastTransactionType || '정보 없음'}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(lastTransactionDate).toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="ml-2 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setSelectedItemForHistory(item.item_id);
                            setShowStockHistory(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors rounded"
                          title="재고 이력 보기"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {getStockStatusIcon(status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 일괄 삭제 버튼 */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
            <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">
              {selectedIds.size}개 항목 선택됨
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={deletingTransactionId === -1}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {deletingTransactionId === -1 ? '삭제 중...' : `선택 항목 삭제 (${selectedIds.size}개)`}
            </button>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">최근 거래 내역</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredTransactions.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                    />
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      거래일시
                      {sortColumn === 'created_at' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('transaction_type')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      구분
                      {sortColumn === 'transaction_type' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('item_name')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      품번/품명
                      {sortColumn === 'item_name' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('quantity')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      수량
                      {sortColumn === 'quantity' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('unit_price')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      단가
                      {sortColumn === 'unit_price' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('total_amount')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      금액
                      {sortColumn === 'total_amount' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('company_name')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      거래처
                      {sortColumn === 'company_name' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button
                      onClick={() => handleSort('reference_no')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      참조번호
                      {sortColumn === 'reference_no' ? (
                        sortOrder === 'asc' ?
                          <ArrowUp className="w-3 h-3" /> :
                          <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-3 sm:px-6 py-12 text-center text-gray-500">
                      데이터를 불러오는 중...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 sm:px-6 py-12 text-center text-gray-500">
                      필터링된 거래 내역이 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredTransactions
                    .sort((a, b) => {
                      let aValue: any;
                      let bValue: any;

                      switch (sortColumn) {
                        case 'created_at':
                          aValue = (a as any).created_at ? new Date((a as any).created_at).getTime() : new Date(a.transaction_date || 0).getTime();
                          bValue = (b as any).created_at ? new Date((b as any).created_at).getTime() : new Date(b.transaction_date || 0).getTime();
                          break;
                        case 'transaction_type':
                          aValue = (a as any).transaction_type || '';
                          bValue = (b as any).transaction_type || '';
                          break;
                        case 'item_name':
                          aValue = a.item_name || (a as any).items?.item_name || '';
                          bValue = b.item_name || (b as any).items?.item_name || '';
                          break;
                        case 'quantity':
                          aValue = a.quantity || 0;
                          bValue = b.quantity || 0;
                          break;
                        case 'unit_price':
                          aValue = (a as any).unit_price || 0;
                          bValue = (b as any).unit_price || 0;
                          break;
                        case 'total_amount':
                          aValue = (a as any).total_amount || 0;
                          bValue = (b as any).total_amount || 0;
                          break;
                        case 'company_name':
                          aValue = (a as any).company_name || '';
                          bValue = (b as any).company_name || '';
                          break;
                        default:
                          // 기본: 날짜로 정렬
                          aValue = (a as any).created_at ? new Date((a as any).created_at).getTime() : new Date(a.transaction_date || 0).getTime();
                          bValue = (b as any).created_at ? new Date((b as any).created_at).getTime() : new Date(b.transaction_date || 0).getTime();
                          break;
                      }

                      if (typeof aValue === 'string' && typeof bValue === 'string') {
                        return sortOrder === 'asc' 
                          ? aValue.localeCompare(bValue, 'ko')
                          : bValue.localeCompare(aValue, 'ko');
                      } else {
                        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
                      }
                    })
                    .map((transaction) => {
                    const shortageTotal = (transaction as any).shortage_total || 0;
                    return (
                      <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 sm:px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(transaction.transaction_id ?? 0)}
                            onChange={(e) => handleSelectItem(transaction.transaction_id ?? 0, e.target.checked)}
                            className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                          />
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {(() => {
                              const date = (transaction as any).created_at || transaction.transaction_date;
                              if (!date) return '-';
                              const d = new Date(date);
                              return (
                                <div className="flex flex-col">
                                  <span>
                                    {d.toLocaleDateString('ko-KR', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit'
                                    }).replace(/\. /g, '.').replace(/\.$/, '')}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {d.toLocaleTimeString('ko-KR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                      hour12: false
                                    })}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full truncate ${getTransactionTypeColor(transaction.transaction_type || '')}`}>
                            {transaction.transaction_type || '-'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={transaction.item_code || (transaction as any).items?.item_code || '-'}>
                            {transaction.item_code || (transaction as any).items?.item_code || '-'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={transaction.item_name || (transaction as any).items?.item_name || '-'}>
                            {transaction.item_name || (transaction as any).items?.item_name || '-'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="flex flex-col items-end gap-1">
                            <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                              {(transaction.quantity || 0).toLocaleString()}
                            </div>
                            {activeTab === 'production' && (
                              <div className="text-xs">
                                {shortageTotal > 0 ? (
                                  <button
                                    onClick={() => handleShowShortageDetail(transaction)}
                                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline"
                                  >
                                    부족 수량: {shortageTotal.toLocaleString()} {(transaction as any).shortage_unit || 'EA'}
                                  </button>
                                ) : (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    부족 수량: 0 {(transaction as any).shortage_unit || 'EA'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                            ₩{(transaction.unit_price || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-right text-gray-900 dark:text-white truncate">
                            ₩{(transaction.total_amount || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={transaction.company_name || (transaction as any).companies?.company_name || '-'}>
                            {transaction.company_name || (transaction as any).companies?.company_name || '-'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 overflow-hidden">
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={transaction.reference_no || '-'}>
                            {transaction.reference_no || '-'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(transaction)}
                              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                              title="수정"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(transaction)}
                              disabled={deletingTransactionId === transaction.transaction_id}
                              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="삭제"
                            >
                              {deletingTransactionId === transaction.transaction_id ? (
                                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for Forms */}
      <Modal
        isOpen={showModal}
        onClose={handleModalClose}
        title={
          selectedTransaction 
            ? (activeTab === 'receiving' ? '입고 수정' :
               activeTab === 'production' ? '생산 수정' :
               '출고 수정')
            : (activeTab === 'receiving' ? '입고 등록' :
               activeTab === 'production' ? '생산 등록' :
               '출고 등록')
        }
        size={activeTab === 'production' ? '2xl' : 'xl'}
        maxHeight={activeTab === 'production' ? 'tall' : 'auto'}
      >
        {renderForm()}
      </Modal>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                거래 삭제 확인
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                이 거래를 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 관련 재고도 자동으로 조정됩니다.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  거래 정보
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  거래일: {selectedTransaction.transaction_date}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  구분: {selectedTransaction.transaction_type}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  품번: {selectedTransaction.item_code || (selectedTransaction as any).items?.item_code || '-'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  수량: {selectedTransaction.quantity}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedTransaction(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shortage Detail Modal */}
      {showShortageModal && selectedTransactionForShortage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  재고 부족 상세
                </h3>
                <button
                  onClick={() => setShowShortageModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  거래일자: {selectedTransactionForShortage.transaction_date}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  생산품목: {selectedTransactionForShortage.item_code || selectedTransactionForShortage.items?.item_code} - {selectedTransactionForShortage.item_name || selectedTransactionForShortage.items?.item_name}
                </p>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">원자재</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">필요 수량</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">차감 수량</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">부족 수량</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransactionForShortage.bomLogs
                    ?.filter((log: any) => {
                      const required = parseFloat(log.quantity_required || 0);
                      const deducted = parseFloat(log.deducted_quantity || 0);
                      return required > deducted;
                    })
                    .map((log: any, index: number) => {
                      const required = parseFloat(log.quantity_required || 0);
                      const deducted = parseFloat(log.deducted_quantity || 0);
                      const shortage = required - deducted;
                      return (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">
                            {log.items?.item_code} - {log.items?.item_name}
                          </td>
                          <td className="py-2 px-3 text-sm text-right text-gray-900 dark:text-white">
                            {required.toLocaleString()} {log.items?.unit || 'EA'}
                          </td>
                          <td className="py-2 px-3 text-sm text-right text-gray-900 dark:text-white">
                            {deducted.toLocaleString()} {log.items?.unit || 'EA'}
                          </td>
                          <td className="py-2 px-3 text-sm text-right text-red-600 dark:text-red-400 font-semibold">
                            {shortage.toLocaleString()} {log.items?.unit || 'EA'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {selectedTransactionForShortage.bomLogs?.filter((log: any) => {
                const required = parseFloat(log.quantity_required || 0);
                const deducted = parseFloat(log.deducted_quantity || 0);
                return required > deducted;
              }).length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  부족한 자재가 없습니다.
                </p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowShortageModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 업로드 모달 */}
      <ExcelUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        uploadUrl="/api/import/inventory"
        title={
          activeTab === 'receiving' ? '입고 데이터 엑셀 업로드' :
          activeTab === 'production' ? '생산 데이터 엑셀 업로드' :
          '출고 데이터 엑셀 업로드'
        }
        templateUrl="/api/import/inventory"
        templateFileName="재고거래_업로드_템플릿.xlsx"
        onUploadSuccess={handleUploadSuccess}
      />

      {/* 재고 이력 모달 */}
      {showStockHistory && selectedItemForHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                재고 이력
              </h2>
              <button
                onClick={() => {
                  setShowStockHistory(false);
                  setSelectedItemForHistory(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <StockHistoryViewer itemId={selectedItemForHistory} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 메인 페이지 컴포넌트 - Suspense로 감싸기
export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
      </div>
    }>
      <InventoryContent />
    </Suspense>
  );
}