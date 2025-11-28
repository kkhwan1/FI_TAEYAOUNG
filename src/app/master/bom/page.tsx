'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Network,
  Plus,
  Search,
  Edit2,
  Trash2,
  Filter,
  Copy,
  Upload,
  Download,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GitBranch,
  Loader2,
  Package
} from 'lucide-react';
import Modal from '@/components/Modal';
import BOMForm from '@/components/BOMForm';
import BOMBulkForm from '@/components/BOMBulkForm';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/hooks/useConfirm';
import { BOMExportButton } from '@/components/ExcelExportButton';
import PrintButton from '@/components/PrintButton';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Pie } from 'recharts';
import BOMViewer from '@/components/bom/BOMViewer';
import { ItemEditModal } from '@/components/ItemEditModal';

// 납품처 정보 인터페이스
interface CustomerInfo {
  company_id: number;
  company_name: string;
  company_code?: string;
}

// 공급처 정보 인터페이스
interface SupplierInfo {
  company_id: number;
  company_name: string;
  company_code?: string;
}

interface BOM {
  bom_id: number;
  parent_item_id: number;
  child_item_id: number;
  parent_item_name?: string;
  child_item_name?: string;
  parent_item_code?: string;
  child_item_code?: string;
  // Parent item details
  parent_spec?: string;
  parent_unit?: string;
  parent_category?: string;
  parent_inventory_type?: string;
  parent_car_model?: string;
  parent_vehicle?: string | null; // API에서 반환되는 차종 필드
  parent_location?: string;
  // Child item details
  child_spec?: string;
  child_unit?: string;
  child_category?: string;
  child_inventory_type?: string;
  child_car_model?: string;
  child_vehicle?: string | null; // API에서 반환되는 차종 필드
  child_location?: string;
  // Supplier information (parent)
  parent_supplier_name?: string;
  parent_supplier_code?: string;
  parent_supplier_business_number?: string;
  parent_supplier_representative?: string;
  parent_supplier_phone?: string;
  parent_supplier_email?: string;
  parent_supplier_address?: string;
  parent_supplier_type?: string;
  // Supplier information (child)
  child_supplier_name?: string;
  child_supplier_code?: string;
  child_supplier_business_number?: string;
  child_supplier_representative?: string;
  child_supplier_phone?: string;
  child_supplier_email?: string;
  child_supplier_address?: string;
  child_supplier_type?: string;
  quantity: number;
  level: number;
  notes?: string;
  is_active: boolean;
  material_grade?: string;
  weight_per_piece?: number;
  material_cost?: number;
  net_cost?: number;
  item_scrap_revenue?: number;
  purchase_unit_price?: number;
  item_type?: 'internal_production' | 'external_purchase';
  // 원가 정보 추가
  unit_price?: number;
  // 납품처 정보 (API에서 제공)
  customer?: CustomerInfo | null;
  // 공급처 정보 (API에서 제공)
  child_supplier?: SupplierInfo | null;
  // BOM 트리 뷰용 - API full-tree 응답에서 사용
  quantity_required?: number;
  // 조인된 부모/자품목 상세 정보 (optional)
  parent?: {
    item_code?: string;
    item_name?: string;
    spec?: string;
    unit?: string;
    category?: string;
    unit_price?: number;
    vehicle_model?: string | null;
    price?: number;
  };
  child?: {
    item_code?: string;
    item_name?: string;
    spec?: string;
    unit?: string;
    category?: string;
    vehicle_model?: string | null;
    price?: number;
  };
}

interface CoilSpecification {
  coil_spec_id?: number;
  item_id: number;
  material_grade: string;
  thickness: number;
  width: number;
  length?: number;
  coil_weight?: number;
  scrap_rate?: number;
  weight_per_piece?: number;
}

interface FilterState {
  searchTerm: string;
  level: number | null;
  itemType: 'all' | 'internal_production' | 'external_purchase';
  minCost: number | null;
  maxCost: number | null;
  category: string;
  materialType: string;
  // 납품처/구매처/공급처/차량 필터 추가
  customerId: number | null;
  purchaseSupplierId: number | null; // 구매처 (parent item의 supplier)
  supplierId: number | null;
  vehicleType: string;
}

type TabType = 'structure' | 'coil-specs' | 'cost-analysis';
type ViewMode = 'table' | 'grouped' | 'tree';
type CoilSpecsViewMode = 'table' | 'card';
type CostAnalysisViewMode = 'overview' | 'table' | 'charts';

export default function BOMPage() {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('structure');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [coilSpecsViewMode, setCoilSpecsViewMode] = useState<CoilSpecsViewMode>('table');
  const [costAnalysisViewMode, setCostAnalysisViewMode] = useState<CostAnalysisViewMode>('overview');
  const [bomData, setBomData] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [selectedParentItem, setSelectedParentItem] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingBOM, setEditingBOM] = useState<BOM | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [deletingBomId, setDeletingBomId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedCoilItem, setSelectedCoilItem] = useState<number | null>(null);
  const [costSummary, setCostSummary] = useState<any>(null);
  const [priceMonth, setPriceMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showFilters, setShowFilters] = useState(false); // 필터 토글 (모바일용)
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set()); // 그룹화 뷰 확장/축소
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<string>('parent_item_code');

  const { success, error, info, warning } = useToast();
  const { warningConfirm, deleteWithToast, ConfirmDialog } = useConfirm();

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    level: null,
    itemType: 'all',
    minCost: null,
    maxCost: null,
    category: '',
    materialType: '',
    customerId: null,
    purchaseSupplierId: null,
    supplierId: null,
    vehicleType: ''
  });

  // 납품처 목록 (고객사)
  const [customers, setCustomers] = useState<CustomerInfo[]>([]);
  // 공급처 목록
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  // 차량 목록 (BOM 데이터에서 추출)
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);

  // 모품목 상세정보 모달 상태
  const [selectedParentDetail, setSelectedParentDetail] = useState<BOM | null>(null);
  const [showParentDetailModal, setShowParentDetailModal] = useState(false);

  // 품목 수정 모달 상태
  const [isItemEditModalOpen, setIsItemEditModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  // 모품목 더블클릭 핸들러 - 해당 모품목 관련 모든 BOM 조회
  const handleParentDoubleClick = useCallback((bom: BOM) => {
    setSelectedParentDetail(bom);
    setShowParentDetailModal(true);
  }, []);

  // 모품목에 연결된 자품목 목록 계산
  const getChildItemsForParent = useCallback((parentItemCode: string | undefined) => {
    if (!parentItemCode) return [];
    return bomData.filter(item =>
      (item.parent_item_code === parentItemCode || item.parent?.item_code === parentItemCode)
    );
  }, [bomData]);

  // 품목 더블클릭 핸들러 (상세정보 모달 내)
  const handleItemDoubleClick = useCallback((itemId: number | undefined) => {
    console.log('[handleItemDoubleClick] Received itemId:', itemId);
    if (!itemId) {
      console.warn('[handleItemDoubleClick] No itemId provided');
      return;
    }
    setEditingItemId(itemId);
    setIsItemEditModalOpen(true);
    console.log('[handleItemDoubleClick] Modal opened for itemId:', itemId);
  }, []);

  // 품목 수정 모달 닫기 핸들러
  const handleItemEditModalClose = useCallback(() => {
    setIsItemEditModalOpen(false);
    setEditingItemId(null);
  }, []);

  // Print columns
  const printColumns = [
    { key: 'level_display', label: '레벨', align: 'left' as const, width: '8%' },
    { key: 'parent_item_code', label: '모품번', align: 'left' as const, width: '15%' },
    { key: 'parent_item_name', label: '모품명', align: 'left' as const, width: '20%' },
    { key: 'child_item_code', label: '자품번', align: 'left' as const, width: '15%' },
    { key: 'child_item_name', label: '자품명', align: 'left' as const, width: '20%' },
    { key: 'quantity', label: '소요량', align: 'right' as const, width: '10%', type: 'number' as const },
    { key: 'unit', label: '단위', align: 'center' as const, width: '6%' },
    { key: 'notes', label: '비고', align: 'left' as const, width: '6%' }
  ];

  // Fetch items
  const fetchItems = useCallback(async () => {
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson('/api/items?limit=1000', {}, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (data.success) {
        setItems(data.data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    }
  }, []);

  // 납품처(고객사) 목록 가져오기
  const fetchCustomers = useCallback(async () => {
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson('/api/companies?type=고객사&limit=500', {}, {
        timeout: 10000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (data.success && data.data) {
        // API 응답 구조: { success: true, data: { data: [...], meta: {...} } }
        const companies = data.data.data || data.data || [];
        const customerList: CustomerInfo[] = companies.map((c: any) => ({
          company_id: c.company_id,
          company_name: c.company_name,
          company_code: c.company_code
        }));
        setCustomers(customerList);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  }, []);

  // 공급처 목록 가져오기 (공급사 + 협력사)
  const fetchSuppliers = useCallback(async () => {
    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson('/api/companies?type=공급사,협력사&limit=500', {}, {
        timeout: 10000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (data.success && data.data) {
        // API 응답 구조: { success: true, data: { data: [...], meta: {...} } }
        const companies = data.data.data || data.data || [];
        const supplierList: SupplierInfo[] = companies.map((s: any) => ({
          company_id: s.company_id,
          company_name: s.company_name,
          company_code: s.company_code
        }));
        setSuppliers(supplierList);
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  }, []);

  // Fetch BOM data with cost analysis
  const fetchBOMData = useCallback(async () => {
    try {
      setLoading(true);

      // 중앙 집중식 필터 헬퍼 사용
      const { buildFilteredApiUrl } = await import('@/lib/filters');
      const additionalParams: Record<string, string> = {};
      if (selectedParentItem) additionalParams.parent_item_id = selectedParentItem;
      additionalParams.price_month = priceMonth + '-01'; // 기준 월 추가
      additionalParams.limit = '10000'; // 모든 BOM 데이터를 가져오기 위해 limit을 충분히 크게 설정
      if (filters.category) additionalParams.category = filters.category;
      if (filters.materialType) additionalParams.material_type = filters.materialType;
      // 납품처(고객사) 필터 추가
      if (filters.customerId !== null) {
        additionalParams.customer_id = filters.customerId.toString();
      }

      const url = buildFilteredApiUrl(
        '/api/bom',
        filters.customerId, // customerId 필터 적용
        additionalParams
      );

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const data = await safeFetchJson(url, {}, {
        timeout: 30000, // 30초 타임아웃 (대량 데이터 처리)
        maxRetries: 3,
        retryDelay: 1000
      });

      if (data.success) {
        // API returns bom_entries (snake_case), not bomEntries (camelCase)
        const bomArray = data.data.bom_entries || [];

        const transformedBOM = bomArray.map((item: any) => ({
          ...item,
          // Map snake_case API fields to component expected format
          parent_item_name: item.parent?.item_name || item.parent_name || '',
          parent_item_code: item.parent?.item_code || item.parent_code || '',
          parent_vehicle: item.parent_vehicle || item.parent?.vehicle_model || null,
          parent_car_model: item.parent_vehicle || item.parent?.vehicle_model || null, // 모달에서 사용
          child_item_name: item.child?.item_name || item.child_name || '',
          child_item_code: item.child?.item_code || item.child_code || '',
          child_vehicle: item.child_vehicle || item.child?.vehicle_model || null,
          child_car_model: item.child_vehicle || item.child?.vehicle_model || null, // 모달에서 사용
          quantity: item.quantity_required || 0,
          level: item.level_no || 1,
          is_active: item.is_active !== undefined ? item.is_active : true,
          // 원가 정보 추가
          unit_price: item.unit_price || 0,
          material_cost: item.material_cost || 0,
          net_cost: item.net_cost || 0,
          // customer 정보 유지
          customer: item.customer || null,
          // child_supplier 정보 유지 (BOM 레벨의 구매처)
          child_supplier: item.child_supplier || null,
          // parent와 child 객체 명시적으로 유지 (단가 정보 포함)
          parent: item.parent || null,
          child: item.child || null,
          // BOMForm에서 사용할 parent_item_data와 child_item_data 추가
          parent_item_data: {
            price: item.parent?.price ?? null,
            vehicle_model: item.parent?.vehicle_model ?? null,
            thickness: item.parent?.thickness ?? null,
            width: item.parent?.width ?? null,
            height: item.parent?.height ?? null,
            material: item.parent?.material ?? null,
          },
          child_item_data: {
            price: item.child?.price ?? null,
            vehicle_model: item.child?.vehicle_model ?? null,
            thickness: item.child?.thickness ?? null,
            width: item.child?.width ?? null,
            height: item.child?.height ?? null,
            material: item.child?.material ?? null,
          }
        }));

        let bomList = showActiveOnly
          ? transformedBOM.filter((item: BOM) => item.is_active)
          : transformedBOM;

        // 전체보기 모드일 때 납품처 기준으로 정렬하여 동일한 납품처끼리 묶이도록 함
        if (filters.customerId === null) {
          bomList = bomList.sort((a: BOM, b: BOM) => {
            const customerA = a.customer?.company_name || '';
            const customerB = b.customer?.company_name || '';
            if (customerA !== customerB) {
              return customerA.localeCompare(customerB, 'ko');
            }
            // 납품처가 같으면 모품목 코드 기준으로 정렬
            const parentCodeA = a.parent_item_code || a.parent?.item_code || '';
            const parentCodeB = b.parent_item_code || b.parent?.item_code || '';
            return parentCodeA.localeCompare(parentCodeB, 'ko');
          });
        }

        setBomData(bomList);
        setCostSummary(data.data.cost_summary);
      } else {
        console.error('API Error:', data.error);
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error('데이터 로딩 실패', extractErrorMessage(data.error) || 'BOM 데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch BOM data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedParentItem, showActiveOnly, priceMonth, filters.category, filters.materialType, filters.customerId]);

  // 품목 수정 완료 핸들러
  const handleItemUpdated = useCallback(() => {
    // 품목 업데이트 후 BOM 데이터 리프레시
    fetchBOMData();
  }, [fetchBOMData]);

  // Initial fetch
  useEffect(() => {
    fetchBOMData();
    fetchItems();
    fetchCustomers();
    fetchSuppliers();
  }, [fetchBOMData, fetchItems, fetchCustomers, fetchSuppliers]);

  // BOM 데이터에서 차량 목록 추출
  useEffect(() => {
    if (bomData.length > 0) {
      const vehicles = new Set<string>();
      bomData.forEach(item => {
        if (item.parent_car_model) vehicles.add(item.parent_car_model);
        if (item.child_car_model) vehicles.add(item.child_car_model);
      });
      setVehicleTypes(Array.from(vehicles).filter(v => v && v.trim() !== '').sort());
    }
  }, [bomData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      fetchBOMData();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchBOMData]);

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson('/api/bom/upload', {
        method: 'POST',
        body: formData
      }, {
        timeout: 120000,
        maxRetries: 1,
        retryDelay: 2000
      });

      if (result.success) {
        success('업로드 완료', `${result.stats?.valid_rows || 0}개 항목이 성공적으로 업로드되었습니다`);
        await fetchBOMData();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error('업로드 실패', extractErrorMessage(result.error) || '업로드 중 오류가 발생했습니다');
        console.error('Upload errors:', result.details);
      }
    } catch (err) {
      console.error('Upload error:', err);
      error('업로드 실패', '업로드 중 오류가 발생했습니다');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };


  // Filter logic
  const applyFilters = (data: BOM[]): BOM[] => {
    return data.filter(entry => {
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesCode = entry.child_item_code?.toLowerCase().includes(term) ||
                           entry.parent_item_code?.toLowerCase().includes(term);
        const matchesName = entry.child_item_name?.toLowerCase().includes(term) ||
                           entry.parent_item_name?.toLowerCase().includes(term);
        if (!matchesCode && !matchesName) return false;
      }

      if (filters.level !== null && entry.level !== filters.level) {
        return false;
      }

      if (filters.itemType !== 'all' && entry.item_type !== filters.itemType) {
        return false;
      }

      if (filters.minCost !== null && (entry.net_cost || 0) < filters.minCost) {
        return false;
      }
      if (filters.maxCost !== null && (entry.net_cost || 0) > filters.maxCost) {
        return false;
      }

      // 납품처(고객사) 필터
      if (filters.customerId !== null) {
        const customerMatch = entry.customer?.company_id === filters.customerId;
        if (!customerMatch) return false;
      }

      // 공급처 필터
      if (filters.supplierId !== null) {
        const supplierMatch = entry.child_supplier?.company_id === filters.supplierId;
        if (!supplierMatch) return false;
      }

      // 차량 필터
      if (filters.vehicleType && filters.vehicleType.trim() !== '') {
        const vehicleMatch =
          entry.parent_car_model === filters.vehicleType ||
          entry.child_car_model === filters.vehicleType;
        if (!vehicleMatch) return false;
      }

      return true;
    });
  };

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

  const filteredData = useMemo(() => {
    let filtered = applyFilters(bomData);

    // 정렬 적용
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortColumn) {
          case 'customer':
            aValue = a.customer?.company_name || '';
            bValue = b.customer?.company_name || '';
            break;
          case 'parent_vehicle':
            aValue = a.parent_vehicle || a.parent?.vehicle_model || '';
            bValue = b.parent_vehicle || b.parent?.vehicle_model || '';
            break;
          case 'parent_item_code':
            aValue = a.parent_item_code || a.parent?.item_code || '';
            bValue = b.parent_item_code || b.parent?.item_code || '';
            break;
          case 'parent_item_name':
            aValue = a.parent_item_name || a.parent?.item_name || '';
            bValue = b.parent_item_name || b.parent?.item_name || '';
            break;
          case 'parent_price':
            aValue = a.parent?.price || 0;
            bValue = b.parent?.price || 0;
            break;
          case 'parent_supplier':
            aValue = (a as any).parent_supplier?.company_name || a.parent_supplier_name || '';
            bValue = (b as any).parent_supplier?.company_name || b.parent_supplier_name || '';
            break;
          case 'child_supplier':
            aValue = a.child_supplier?.company_name || a.child_supplier_name || '';
            bValue = b.child_supplier?.company_name || b.child_supplier_name || '';
            break;
          case 'child_vehicle':
            aValue = a.child_vehicle || a.child?.vehicle_model || '';
            bValue = b.child_vehicle || b.child?.vehicle_model || '';
            break;
          case 'child_item_code':
            aValue = a.child_item_code || a.child?.item_code || '';
            bValue = b.child_item_code || b.child?.item_code || '';
            break;
          case 'child_item_name':
            aValue = a.child_item_name || a.child?.item_name || '';
            bValue = b.child_item_name || b.child?.item_name || '';
            break;
          case 'quantity':
            aValue = a.quantity || a.quantity_required || 0;
            bValue = b.quantity || b.quantity_required || 0;
            break;
          case 'child_price':
            aValue = a.child?.price || a.unit_price || 0;
            bValue = b.child?.price || b.unit_price || 0;
            break;
          case 'unit_price':
            aValue = a.unit_price || 0;
            bValue = b.unit_price || 0;
            break;
          case 'material_cost':
            aValue = a.material_cost || 0;
            bValue = b.material_cost || 0;
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue, 'ko')
            : bValue.localeCompare(aValue, 'ko');
        } else {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }
      });
    }

    return filtered;
  }, [bomData, filters, sortColumn, sortOrder]);

  // 모품목별 그룹화 함수
  const groupBOMByParent = useCallback((bomList: BOM[]): Map<number, BOM[]> => {
    const grouped = new Map<number, BOM[]>();
    bomList.forEach(bom => {
      const parentId = bom.parent_item_id;
      if (!grouped.has(parentId)) {
        grouped.set(parentId, []);
      }
      grouped.get(parentId)!.push(bom);
    });
    return grouped;
  }, []);

  // 그룹화된 데이터 (메모이제이션)
  const groupedBOMData = useMemo(() => {
    if (viewMode !== 'grouped' || selectedParentItem) return null;
    return groupBOMByParent(filteredData);
  }, [filteredData, viewMode, selectedParentItem, groupBOMByParent]);

  // 확장/축소 토글 함수
  const toggleParent = useCallback((parentId: number) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  // 모두 확장/축소 함수
  const toggleAllParents = useCallback((expand: boolean) => {
    if (!groupedBOMData) return;
    if (expand) {
      const allParentIds = Array.from(groupedBOMData.keys());
      setExpandedParents(new Set(allParentIds));
    } else {
      setExpandedParents(new Set());
    }
  }, [groupedBOMData]);

  // 검색어가 있을 때 관련 모품목 자동 확장
  useEffect(() => {
    if (!groupedBOMData || !filters.searchTerm) return;

    const searchTerm = filters.searchTerm.toLowerCase();
    const matchingParentIds = new Set<number>();

    groupedBOMData.forEach((bomEntries, parentId) => {
      const parentItem = items.find(item => item.item_id === parentId);
      const matchesParent = 
        parentItem?.item_code?.toLowerCase().includes(searchTerm) ||
        parentItem?.item_name?.toLowerCase().includes(searchTerm);
      
      const matchesChild = bomEntries.some(bom =>
        bom.child_item_code?.toLowerCase().includes(searchTerm) ||
        bom.child_item_name?.toLowerCase().includes(searchTerm)
      );

      if (matchesParent || matchesChild) {
        matchingParentIds.add(parentId);
      }
    });

    if (matchingParentIds.size > 0) {
      setExpandedParents(prev => {
        const next = new Set(prev);
        matchingParentIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [filters.searchTerm, groupedBOMData, items]);

  // CRUD handlers
  const handleDelete = async (bom: BOM) => {
    const deleteAction = async () => {
      setDeletingBomId(bom.bom_id);
      try {
        const { safeFetchJson } = await import('@/lib/fetch-utils');
        const data = await safeFetchJson(`/api/bom?id=${bom.bom_id}`, {
          method: 'DELETE'
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        });

        if (!data.success) {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          throw new Error(extractErrorMessage(data.error) || 'BOM 삭제에 실패했습니다.');
        }

        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(bom.bom_id);
          return next;
        });
        fetchBOMData();
      } catch (err) {
        console.error('Failed to delete BOM item:', err);
        throw err;
      } finally {
        setDeletingBomId(null);
      }
    };

    await deleteWithToast(deleteAction, {
      title: 'BOM 삭제',
      itemName: `${bom.parent_item_name || '알 수 없는 품목'} → ${bom.child_item_name || '알 수 없는 품목'}`,
      successMessage: 'BOM 항목이 성공적으로 삭제되었습니다.',
      errorMessage: 'BOM 삭제에 실패했습니다.'
    });
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredData.map(bom => bom.bom_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 개별 선택/해제
  const handleSelectItem = (bomId: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(bomId);
      } else {
        next.delete(bomId);
      }
      return next;
    });
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(`선택한 ${selectedIds.size}개 BOM 항목을 삭제하시겠습니까?`);
    if (!confirmed) return;

    const idsToDelete = Array.from(selectedIds);
    setDeletingBomId(-1); // 일괄 삭제 중 표시

    try {
      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const deletePromises = idsToDelete.map(bomId =>
        safeFetchJson(`/api/bom?id=${bomId}`, {
          method: 'DELETE'
        }, {
          timeout: 15000,
          maxRetries: 2,
          retryDelay: 1000
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      if (failed.length > 0) {
        error('일부 삭제 실패', `${failed.length}개 BOM 항목 삭제에 실패했습니다.`);
      } else {
        success('삭제 완료', `${idsToDelete.length}개 BOM 항목이 삭제되었습니다.`);
      }

      setSelectedIds(new Set());
      fetchBOMData();
    } catch (err) {
      error('삭제 실패', '일괄 삭제 중 오류가 발생했습니다.');
      console.error('Bulk delete error:', err);
    } finally {
      setDeletingBomId(null);
    }
  };

  const handleSaveBOM = async (bomData: Omit<BOM, 'bom_id' | 'is_active' | 'level'>) => {
    try {
      const method = editingBOM ? 'PUT' : 'POST';
      // API는 quantity_required를 기대하므로 변환
      const apiBody: any = {
        ...bomData,
        quantity_required: bomData.quantity,
      };
      delete apiBody.quantity; // quantity 제거
      
      // parent_item_data와 child_item_data는 그대로 전달
      if ((bomData as any).parent_item_data) {
        apiBody.parent_item_data = (bomData as any).parent_item_data;
      }
      if ((bomData as any).child_item_data) {
        apiBody.child_item_data = (bomData as any).child_item_data;
      }
      
      const body = editingBOM
        ? { ...apiBody, bom_id: editingBOM.bom_id }
        : apiBody;

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson('/api/bom', {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        const successMessage = editingBOM ? 'BOM이 성공적으로 수정되었습니다.' : 'BOM이 성공적으로 등록되었습니다.';
        success(editingBOM ? 'BOM 수정 완료' : 'BOM 등록 완료', successMessage);
        setShowAddModal(false);
        setEditingBOM(null);
        fetchBOMData();
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        error('저장 실패', extractErrorMessage(result.error) || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Failed to save BOM:', err);
      error('네트워크 오류', '서버와의 연결에 문제가 발생했습니다.');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingBOM(null);
  };

  const handleCloseBulkModal = () => {
    setShowBulkModal(false);
  };

  const handleBulkSubmit = async (entries: Array<{
    parent_item_id: number;
    child_item_id: number;
    quantity: number;
    notes?: string;
  }>): Promise<{
    success: boolean;
    message?: string;
    data?: {
      success_count: number;
      fail_count: number;
      validation_errors?: { index: number; errors: string[] }[];
    };
  }> => {
    try {
      // Convert quantity to quantity_required for API
      const apiEntries = entries.map(e => ({
        parent_item_id: e.parent_item_id,
        child_item_id: e.child_item_id,
        quantity_required: e.quantity,
        notes: e.notes
      }));

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson('/api/bom/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ entries: apiEntries }),
      }, {
        timeout: 30000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        const { success_count, fail_count, validation_errors } = result.data || {};

        // If all successful, show toast and refresh
        if (!fail_count || fail_count === 0) {
          success('대량 등록 완료', result.message || `${success_count}개 BOM이 등록되었습니다.`);
          fetchBOMData();
        } else {
          // Partial success - show warning
          warning(
            '일부 등록 실패',
            `${success_count}개 등록 성공, ${fail_count}개 실패`
          );
          if (success_count > 0) {
            fetchBOMData();
          }
        }

        return {
          success: true,
          message: result.message,
          data: {
            success_count: success_count || 0,
            fail_count: fail_count || 0,
            validation_errors: validation_errors
          }
        };
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        const errorMsg = extractErrorMessage(result.error) || '대량 등록에 실패했습니다.';
        error('등록 실패', errorMsg);
        return {
          success: false,
          message: errorMsg
        };
      }
    } catch (err) {
      console.error('Failed to bulk save BOM:', err);
      error('네트워크 오류', '서버와의 연결에 문제가 발생했습니다.');
      return {
        success: false,
        message: '서버와의 연결에 문제가 발생했습니다.'
      };
    }
  };

  const handleCopyBOM = async (bom: BOM) => {
    const confirmed = await warningConfirm('BOM 복사 확인', `${bom.parent_item_name || '알 수 없는 품목'}의 BOM 구조를 복사하시겠습니까?`);
    if (!confirmed) return;

    info('준비 중', 'BOM 복사 기능은 준비 중입니다.');
  };

  const handleCoilSpecsSave = async (specs: CoilSpecification) => {
    try {
      const url = specs.coil_spec_id ? `/api/coil-specs/${specs.coil_spec_id}` : '/api/coil-specs';
      const method = specs.coil_spec_id ? 'PUT' : 'POST';

      const { safeFetchJson } = await import('@/lib/fetch-utils');
      const result = await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specs)
      }, {
        timeout: 15000,
        maxRetries: 2,
        retryDelay: 1000
      });

      if (result.success) {
        await fetchBOMData();
        success('저장 완료', '코일 규격이 저장되었습니다');
        setSelectedCoilItem(null);
      } else {
        const { extractErrorMessage } = await import('@/lib/fetch-utils');
        throw new Error(extractErrorMessage(result.error) || '처리 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Save failed:', err);
      error('저장 실패', '코일 규격 저장에 실패했습니다');
    }
  };

  const handleTemplateDownload = async () => {
    try {
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/download/template/bom', {}, {
        timeout: 30000,
        maxRetries: 2,
        retryDelay: 1000
      });
      if (!response.ok) {
        throw new Error('템플릿 다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'BOM_템플릿.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      success('템플릿 다운로드 완료', 'BOM 템플릿 파일이 다운로드되었습니다.');
    } catch (err) {
      console.error('Failed to download template:', err);
      error('다운로드 실패', '템플릿 파일을 다운로드하지 못했습니다.');
    }
  };

  const handleExportToExcel = async () => {
    try {
      setIsDownloading(true);

      // 거래처별 시트 + 최신단가 + 종합 형식으로 BOM 데이터 내보내기
      const { safeFetch } = await import('@/lib/fetch-utils');
      const response = await safeFetch('/api/download/template/bom', {}, {
        timeout: 120000, // 전체 데이터이므로 타임아웃 증가 (2분)
        maxRetries: 1,
        retryDelay: 1000
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'BOM 내보내기에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      // 당일 날짜로 파일명 설정 (한국 시간 기준)
      const now = new Date();
      const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
      const today = koreaTime.toISOString().split('T')[0];
      a.download = `BOM_종합_${today}.xlsx`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      success('BOM 내보내기 완료', '전체 BOM 데이터가 성공적으로 내보내졌습니다.');
    } catch (err) {
      console.error('BOM export error:', err);
      error('BOM 내보내기 실패', err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  // 현재 화면에 표시된 데이터를 템플릿 형식으로 엑셀 파일로 내보내기
  const handleExportCurrentDataToExcel = async () => {
    try {
      if (!filteredData || filteredData.length === 0) {
        warning('데이터 없음', '내보낼 데이터가 없습니다.');
        return;
      }

      // xlsx 라이브러리 동적 import
      const XLSX = await import('xlsx');

      // 엑셀 데이터 준비 (업로드 API가 인식할 수 있는 컬럼명 사용)
      const excelData = filteredData.map((bom) => ({
        // 모품목 상세 정보
        '모품목코드': bom.parent_item_code || '',
        '모품목명': bom.parent_item_name || '',
        '모품목규격': bom.parent_spec || '',
        '모품목단위': bom.parent_unit || '',
        '모품목카테고리': bom.parent_category || '',
        '모품목재고타입': bom.parent_inventory_type || '',
        '모품목차종': bom.parent_car_model || '',
        '모품목위치': bom.parent_location || '',
        // 자품목 상세 정보
        '자품목코드': bom.child_item_code || '',
        '자품목명': bom.child_item_name || '',
        '자품목규격': bom.child_spec || '',
        '자품목단위': bom.child_unit || '',
        '자품목카테고리': bom.child_category || '',
        '자품목재고타입': bom.child_inventory_type || '',
        '자품목차종': bom.child_car_model || '',
        '자품목위치': bom.child_location || '',
        // BOM 관계 정보
        '소요량': bom.quantity || 0,
        '레벨': bom.level || 0,
        '비고': bom.notes || '',
        // 거래처 정보 (모품목 공급사)
        '모품목공급사명': bom.parent_supplier_name || '',
        '모품목공급사코드': bom.parent_supplier_code || '',
        '모품목공급사사업자번호': bom.parent_supplier_business_number || '',
        '모품목공급사대표자': bom.parent_supplier_representative || '',
        '모품목공급사전화번호': bom.parent_supplier_phone || '',
        '모품목공급사이메일': bom.parent_supplier_email || '',
        '모품목공급사주소': bom.parent_supplier_address || '',
        '모품목공급사타입': bom.parent_supplier_type || '',
        // 거래처 정보 (자품목 공급사)
        '자품목공급사명': bom.child_supplier_name || '',
        '자품목공급사코드': bom.child_supplier_code || '',
        '자품목공급사사업자번호': bom.child_supplier_business_number || '',
        '자품목공급사대표자': bom.child_supplier_representative || '',
        '자품목공급사전화번호': bom.child_supplier_phone || '',
        '자품목공급사이메일': bom.child_supplier_email || '',
        '자품목공급사주소': bom.child_supplier_address || '',
        '자품목공급사타입': bom.child_supplier_type || '',
        // Monthly price information (parent) - 템플릿용 빈 값
        '모품목단가월': '',
        '모품목단가': 0,
        '모품목KG단가': 0,
        '모품목단가비고': '',
        // Monthly price information (child) - 템플릿용 빈 값
        '자품목단가월': '',
        '자품목단가': 0,
        '자품목KG단가': 0,
        '자품목단가비고': '',
        // 참고용 컬럼 (업로드 시 무시됨)
        '단위': 'EA',
        '단가 (₩)': bom.unit_price || 0,
        '재료비 (₩)': bom.material_cost || 0,
        '구분': bom.item_type === 'internal_production' ? '내부생산' : bom.item_type === 'external_purchase' ? '외부구매' : '',
        '상태': bom.is_active ? '활성' : '비활성'
      }));

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // 컬럼 너비 설정
      worksheet['!cols'] = [
        // 모품목 상세 정보
        { wch: 15 }, // 모품목코드
        { wch: 25 }, // 모품목명
        { wch: 20 }, // 모품목규격
        { wch: 8 },  // 모품목단위
        { wch: 15 }, // 모품목카테고리
        { wch: 12 }, // 모품목재고타입
        { wch: 12 }, // 모품목차종
        { wch: 15 }, // 모품목위치
        // 자품목 상세 정보
        { wch: 15 }, // 자품목코드
        { wch: 25 }, // 자품목명
        { wch: 20 }, // 자품목규격
        { wch: 8 },  // 자품목단위
        { wch: 15 }, // 자품목카테고리
        { wch: 12 }, // 자품목재고타입
        { wch: 12 }, // 자품목차종
        { wch: 15 }, // 자품목위치
        // BOM 관계 정보
        { wch: 10 }, // 소요량
        { wch: 6 },  // 레벨
        { wch: 20 }, // 비고
        // 거래처 정보 (모품목 공급사)
        { wch: 20 }, // 모품목공급사명
        { wch: 15 }, // 모품목공급사코드
        { wch: 18 }, // 모품목공급사사업자번호
        { wch: 12 }, // 모품목공급사대표자
        { wch: 15 }, // 모품목공급사전화번호
        { wch: 25 }, // 모품목공급사이메일
        { wch: 30 }, // 모품목공급사주소
        { wch: 12 }, // 모품목공급사타입
        // 거래처 정보 (자품목 공급사)
        { wch: 20 }, // 자품목공급사명
        { wch: 15 }, // 자품목공급사코드
        { wch: 18 }, // 자품목공급사사업자번호
        { wch: 12 }, // 자품목공급사대표자
        { wch: 15 }, // 자품목공급사전화번호
        { wch: 25 }, // 자품목공급사이메일
        { wch: 30 }, // 자품목공급사주소
        { wch: 12 }, // 자품목공급사타입
        // Monthly price information (parent)
        { wch: 12 }, // 모품목단가월
        { wch: 12 }, // 모품목단가
        { wch: 12 }, // 모품목KG단가
        { wch: 20 }, // 모품목단가비고
        // Monthly price information (child)
        { wch: 12 }, // 자품목단가월
        { wch: 12 }, // 자품목단가
        { wch: 12 }, // 자품목KG단가
        { wch: 20 }, // 자품목단가비고
        // 참고용 컬럼 (업로드 시 무시됨)
        { wch: 8 },  // 단위 (참고용)
        { wch: 12 }, // 단가 (참고용)
        { wch: 12 }, // 재료비 (참고용)
        { wch: 12 }, // 구분 (참고용)
        { wch: 8 }   // 상태 (참고용)
      ];

      // 워크시트 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM 데이터');

      // 파일명 생성 (날짜 포함)
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const filename = `BOM_템플릿_${dateStr}.xlsx`;

      // 파일 다운로드
      XLSX.writeFile(workbook, filename);

      success('엑셀 다운로드 완료', `${filteredData.length}개 항목이 엑셀 파일로 저장되었습니다.`);
    } catch (err) {
      console.error('Excel export failed:', err);
      error('다운로드 실패', '엑셀 파일 생성 중 오류가 발생했습니다.');
    }
  };

  // Render functions
  const renderBOMRows = (bomList: BOM[]): React.ReactElement[] => {
    // 전체보기 모드(filters.customerId === null)일 때 납품처 셀 병합을 위한 그룹화
    const shouldMergeCustomer = filters.customerId === null;
    
    if (shouldMergeCustomer) {
      // 납품처 기준으로 정렬된 데이터를 사용 (이미 fetchBOMData에서 정렬됨)
      // 모든 BOM을 표시하되, 동일한 모품목(품번 + 차종 + 납품처)에 대해서만 납품처 셀 병합
      // 먼저 모품목별로 그룹화하여 rowspan 계산
      const groupedByParent = new Map<string, BOM[]>();
      bomList.forEach((bom: any) => {
        const parentCode = bom.parent_item_code || bom.parent?.item_code || '';
        const parentVehicle = bom.parent_vehicle || bom.parent?.vehicle_model || '';
        const customerId = bom.customer?.company_id || '';
        const key = `${parentCode}_${parentVehicle}_${customerId}`;
        if (!groupedByParent.has(key)) {
          groupedByParent.set(key, []);
        }
        groupedByParent.get(key)!.push(bom);
      });

      // 모든 BOM을 순서대로 표시하되, 모품목 관련 열들도 병합
      const rows: React.ReactElement[] = [];
      const processedKeys = new Set<string>();
      
      // 각 그룹의 병합 가능 여부를 미리 계산
      const mergeInfoMap = new Map<string, {
        customer: { canMerge: boolean; value: string; rowSpan: number };
        parentVehicle: { canMerge: boolean; value: string; rowSpan: number };
        parentCode: { canMerge: boolean; value: string; rowSpan: number };
        parentName: { canMerge: boolean; value: string; rowSpan: number };
        parentPrice: { canMerge: boolean; value: string; rowSpan: number };
      }>();
      
      groupedByParent.forEach((boms, key) => {
        if (boms.length === 0) return;
        
        const firstBom = boms[0];
        const customerName = firstBom.customer?.company_name || '-';
        const parentVehicle = firstBom.parent_vehicle || firstBom.parent?.vehicle_model || '-';
        const parentCode = firstBom.parent_item_code || firstBom.parent?.item_code || '';
        const parentName = firstBom.parent_item_name || firstBom.parent?.item_name || '-';
        const parentPrice = (firstBom.parent?.price && firstBom.parent.price > 0) ? firstBom.parent.price.toLocaleString() : '-';
        
        // 그룹 내 모든 BOM의 값이 동일한지 확인
        const allSameVehicle = boms.every(b => (b.parent_vehicle || b.parent?.vehicle_model || '-') === parentVehicle);
        const allSameCode = boms.every(b => (b.parent_item_code || b.parent?.item_code || '') === parentCode);
        const allSameName = boms.every(b => (b.parent_item_name || b.parent?.item_name || '-') === parentName);
        const allSamePrice = boms.every(b => {
          const price = (b.parent?.price && b.parent.price > 0) ? b.parent.price.toLocaleString() : '-';
          return price === parentPrice;
        });
        
        const rowSpan = boms.length;
        mergeInfoMap.set(key, {
          customer: { canMerge: true, value: customerName, rowSpan },
          parentVehicle: { canMerge: allSameVehicle, value: parentVehicle, rowSpan },
          parentCode: { canMerge: allSameCode, value: parentCode, rowSpan },
          parentName: { canMerge: allSameName, value: parentName, rowSpan },
          parentPrice: { canMerge: allSamePrice, value: parentPrice, rowSpan }
        });
      });
      
      bomList.forEach((bom: any) => {
        const parentCode = bom.parent_item_code || bom.parent?.item_code || '';
        const parentVehicle = bom.parent_vehicle || bom.parent?.vehicle_model || '';
        const customerId = bom.customer?.company_id || '';
        const key = `${parentCode}_${parentVehicle}_${customerId}`;
        const boms = groupedByParent.get(key) || [];
        const isFirstRow = !processedKeys.has(key);
        const mergeInfo = mergeInfoMap.get(key);
        
        if (isFirstRow) {
          processedKeys.add(key);
        }
        
        if (!mergeInfo) return;
        
        rows.push(
          <tr key={bom.bom_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {/* 납품처 - 첫 번째 행에만 표시하고 rowspan 적용 */}
            {isFirstRow ? (
              <td 
                rowSpan={mergeInfo.customer.rowSpan}
                className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap border-r border-gray-300 dark:border-gray-600 align-top"
              >
                <span className="text-sm text-gray-900 dark:text-white font-medium">
                  {mergeInfo.customer.value}
                </span>
              </td>
            ) : null}
            {/* 차종 - 병합 가능한 경우 첫 번째 행에만 표시 */}
            {mergeInfo.parentVehicle.canMerge ? (
              isFirstRow ? (
                <td 
                  rowSpan={mergeInfo.parentVehicle.rowSpan}
                  className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap align-top"
                >
                  <span className="text-sm text-gray-900 dark:text-white">
                    {mergeInfo.parentVehicle.value}
                  </span>
                </td>
              ) : null
            ) : (
              <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                <span className="text-sm text-gray-900 dark:text-white">
                  {bom.parent_vehicle || bom.parent?.vehicle_model || '-'}
                </span>
              </td>
            )}
            {/* 품번 - 병합 가능한 경우 첫 번째 행에만 표시 */}
            {mergeInfo.parentCode.canMerge ? (
              isFirstRow ? (
                <td 
                  rowSpan={mergeInfo.parentCode.rowSpan}
                  className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap border-r border-gray-300 dark:border-gray-600 align-top"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {mergeInfo.parentCode.value}
                  </span>
                </td>
              ) : null
            ) : (
              <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap border-r border-gray-300 dark:border-gray-600">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {bom.parent_item_code || bom.parent?.item_code || '-'}
                </span>
              </td>
            )}
            {/* 품명 - 병합 가능한 경우 첫 번째 행에만 표시 */}
            {mergeInfo.parentName.canMerge ? (
              isFirstRow ? (
                <td
                  rowSpan={mergeInfo.parentName.rowSpan}
                  className="px-3 sm:px-4 py-3 sm:py-4 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 align-top"
                  onDoubleClick={() => handleParentDoubleClick(bom)}
                  title="더블클릭하여 상세정보 보기"
                >
                  <span className="text-sm text-gray-900 dark:text-white block underline decoration-dashed decoration-gray-400 dark:decoration-gray-500">
                    {mergeInfo.parentName.value}
                  </span>
                </td>
              ) : null
            ) : (
              <td
                className="px-3 sm:px-4 py-3 sm:py-4 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onDoubleClick={() => handleParentDoubleClick(bom)}
                title="더블클릭하여 상세정보 보기"
              >
                <span className="text-sm text-gray-900 dark:text-white block underline decoration-dashed decoration-gray-400 dark:decoration-gray-500">
                  {bom.parent_item_name || bom.parent?.item_name || '-'}
                </span>
              </td>
            )}
            {/* 단가 - 병합 가능한 경우 첫 번째 행에만 표시 */}
            {mergeInfo.parentPrice.canMerge ? (
              isFirstRow ? (
                <td 
                  rowSpan={mergeInfo.parentPrice.rowSpan}
                  className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-right border-r border-gray-300 dark:border-gray-600 align-top"
                >
                  <span className="text-gray-900 dark:text-white">
                    {mergeInfo.parentPrice.value}
                  </span>
                </td>
              ) : null
            ) : (
              <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-right border-r border-gray-300 dark:border-gray-600">
                <span className="text-gray-900 dark:text-white">
                  {(bom.parent?.price && bom.parent.price > 0) ? bom.parent.price.toLocaleString() : '-'}
                </span>
              </td>
            )}
            {/* 공급처 (child item의 supplier) */}
            <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
              <span className="text-sm text-gray-900 dark:text-white">
                {bom.child_supplier?.company_name || bom.child?.supplier?.company_name || bom.child_supplier_name || '-'}
              </span>
            </td>
            {/* 차종 */}
            <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
              <span className="text-sm text-gray-900 dark:text-white">
                {bom.child_vehicle || bom.child?.vehicle_model || '-'}
              </span>
            </td>
            {/* 품번 */}
            <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {bom.child_item_code || bom.child?.item_code || '-'}
              </span>
            </td>
            {/* 품명 */}
            <td className="px-3 sm:px-4 py-3 sm:py-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 block" title={bom.child_item_name || bom.child?.item_name || '-'}>
                {bom.child_item_name || bom.child?.item_name || '-'}
              </span>
            </td>
            {/* U/S */}
            <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
              {parseFloat((bom.quantity || bom.quantity_required || 0).toString()).toLocaleString()}
            </td>
            {/* 단가 */}
            <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
              {((bom.child?.price && bom.child.price > 0) ? bom.child.price.toLocaleString() : 
                (bom.unit_price && bom.unit_price > 0) ? bom.unit_price.toLocaleString() : '-')}
            </td>
            {/* 작업 */}
            <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-center">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setEditingBOM(bom);
                    setShowAddModal(true);
                  }}
                  className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                  title="수정"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(bom)}
                  disabled={deletingBomId === bom.bom_id}
                  className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="삭제"
                >
                  {deletingBomId === bom.bom_id ? (
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </td>
          </tr>
        );
        });
      
      return rows;
    }
    
    // 특정 납품처 선택 시 기존 방식 (병합 없음)
    return bomList.map((bom: any) => (
      <tr key={bom.bom_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* 납품처 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap border-r border-gray-300 dark:border-gray-600">
          <span className="text-sm text-gray-900 dark:text-white">
            {bom.customer?.company_name || '-'}
          </span>
        </td>
        {/* 차종 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
          <span className="text-sm text-gray-900 dark:text-white">
            {bom.parent_vehicle || bom.parent?.vehicle_model || '-'}
          </span>
        </td>
        {/* 품번 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap border-r border-gray-300 dark:border-gray-600">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {bom.parent_item_code || bom.parent?.item_code || '-'}
          </span>
        </td>
        {/* 품명 - 더블클릭 시 상세정보 표시 */}
        <td
          className="px-3 sm:px-4 py-3 sm:py-4 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
          onDoubleClick={() => handleParentDoubleClick(bom)}
          title="더블클릭하여 상세정보 보기"
        >
          <span className="text-sm text-gray-900 dark:text-white block underline decoration-dashed decoration-gray-400 dark:decoration-gray-500">
            {bom.parent_item_name || bom.parent?.item_name || '-'}
          </span>
        </td>
        {/* 단가 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-right border-r border-gray-300 dark:border-gray-600">
          <span className="text-gray-900 dark:text-white">
            {(bom.parent?.price && bom.parent.price > 0) ? bom.parent.price.toLocaleString() : '-'}
          </span>
        </td>
        {/* 공급처 (child item의 supplier) */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
          <span className="text-sm text-gray-900 dark:text-white">
            {bom.child_supplier?.company_name || bom.child?.supplier?.company_name || bom.child_supplier_name || '-'}
          </span>
        </td>
        {/* 차종 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
          <span className="text-sm text-gray-900 dark:text-white">
            {bom.child_vehicle || bom.child?.vehicle_model || '-'}
          </span>
        </td>
        {/* 품번 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {bom.child_item_code || bom.child?.item_code || '-'}
          </span>
        </td>
        {/* 품명 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4">
          <span className="text-sm text-gray-600 dark:text-gray-400 block" title={bom.child_item_name || bom.child?.item_name || '-'}>
            {bom.child_item_name || bom.child?.item_name || '-'}
          </span>
        </td>
        {/* U/S */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
          {parseFloat((bom.quantity || bom.quantity_required || 0).toString()).toLocaleString()}
        </td>
        {/* 단가 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
          {((bom.child?.price && bom.child.price > 0) ? bom.child.price.toLocaleString() : 
            (bom.unit_price && bom.unit_price > 0) ? bom.unit_price.toLocaleString() : '-')}
        </td>
        {/* 작업 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-center">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setEditingBOM(bom);
                setShowAddModal(true);
              }}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
              title="수정"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(bom)}
              disabled={deletingBomId === bom.bom_id}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="삭제"
            >
              {deletingBomId === bom.bom_id ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  // grouped 뷰 전용 렌더링 함수 (테이블 헤더와 일치하는 컬럼 구조)
  const renderGroupedBOMRows = (bomList: BOM[]): React.ReactElement[] => {
    return bomList.map((bom: any) => (
      <tr key={bom.bom_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* 자품번 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-left">
          <span className="text-gray-900 dark:text-white">
            {bom.child_item_code || bom.child?.item_code || '-'}
          </span>
        </td>
        {/* 자품명 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-left">
          <span className="text-gray-900 dark:text-white block" title={bom.child_item_name || bom.child?.item_name || '-'}>
            {bom.child_item_name || bom.child?.item_name || '-'}
          </span>
        </td>
        {/* 소요량 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
          {parseFloat((bom.quantity || bom.quantity_required || 0).toString()).toLocaleString()}
        </td>
        {/* 단위 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
          {bom.child_item_unit || bom.child?.unit || '-'}
        </td>
        {/* 단가 (₩) */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
          {((bom.unit_price && bom.unit_price > 0) ? bom.unit_price.toLocaleString() : 
            (bom.child?.price && bom.child.price > 0) ? bom.child.price.toLocaleString() : '-')}
        </td>
        {/* 재료비 (₩) */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
          {(bom.material_cost && bom.material_cost > 0) ? bom.material_cost.toLocaleString() : '-'}
        </td>
        {/* 구분 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
          {bom.item_type === 'internal_production' ? '내부생산' : bom.item_type === 'external_purchase' ? '외부구매' : '-'}
        </td>
        {/* 비고 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-left">
          <span className="text-gray-600 dark:text-gray-400">
            {bom.notes || bom.remarks || '-'}
          </span>
        </td>
        {/* 상태 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm text-center">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            bom.is_active 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          }`}>
            {bom.is_active ? '활성' : '비활성'}
          </span>
        </td>
        {/* 작업 */}
        <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-center">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setEditingBOM(bom);
                setShowAddModal(true);
              }}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
              title="수정"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(bom)}
              disabled={deletingBomId === bom.bom_id}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="삭제"
            >
              {deletingBomId === bom.bom_id ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </td>
      </tr>
    ));
  };

  // 그룹화 뷰 렌더링 함수
  const renderGroupedView = () => {
    if (!groupedBOMData || groupedBOMData.size === 0) {
      return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-12 text-center text-gray-500">
            {loading ? '데이터를 불러오는 중...' : '등록된 BOM이 없습니다'}
          </div>
        </div>
      );
    }

    const parentIds = Array.from(groupedBOMData.keys()).sort((a, b) => {
      const itemA = items.find(item => item.item_id === a);
      const itemB = items.find(item => item.item_id === b);
      const codeA = itemA?.item_code || '';
      const codeB = itemB?.item_code || '';
      return codeA.localeCompare(codeB);
    });

    return (
      <div className="space-y-4">
        {/* 모두 확장/축소 버튼 */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            총 <span className="font-semibold text-gray-900 dark:text-white">{parentIds.length}개</span> 모품목
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleAllParents(true)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              모두 확장
            </button>
            <button
              onClick={() => toggleAllParents(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              모두 축소
            </button>
          </div>
        </div>

        {/* 모품목별 그룹 */}
        {parentIds.map(parentId => {
          const bomEntries = groupedBOMData.get(parentId) || [];
          const parentItem = items.find(item => item.item_id === parentId);
          const isExpanded = expandedParents.has(parentId);
          const bomCount = bomEntries.length;

          return (
            <div
              key={parentId}
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
            >
              {/* 모품목 헤더 - 클릭 또는 더블클릭으로 확장/축소 */}
              <div
                className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
                onClick={() => toggleParent(parentId)}
                onDoubleClick={() => toggleParent(parentId)}
                title="클릭 또는 더블클릭으로 펼치기/접기"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {parentItem?.item_code || `ID: ${parentId}`}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {parentItem?.item_name || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      BOM 항목: <span className="font-medium text-gray-700 dark:text-gray-300">{bomCount}개</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* BOM 항목 테이블 */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '12%', minWidth: '100px' }}>
                          자품번
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" style={{ width: '18%', minWidth: '150px' }}>
                          자품명
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '8%', minWidth: '70px' }}>
                          소요량
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '6%', minWidth: '50px' }}>
                          단위
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '10%', minWidth: '90px' }}>
                          단가 (₩)
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '11%', minWidth: '100px' }}>
                          재료비 (₩)
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '9%', minWidth: '80px' }}>
                          구분
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider" style={{ width: '10%', minWidth: '80px' }}>
                          비고
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '7%', minWidth: '60px' }}>
                          상태
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap" style={{ width: '9%', minWidth: '80px' }}>
                          작업
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {renderGroupedBOMRows(bomEntries)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCoilSpecsTab = () => {
    const coilItems = filteredData.filter(entry => entry.material_grade);

    // 재질등급별 그룹화 (useMemo는 함수 내부에서 사용 불가하므로 직접 계산)
    const groupedByGrade = (() => {
      const grouped = new Map<string, typeof coilItems>();
      coilItems.forEach(item => {
        const grade = item.material_grade || '기타';
        if (!grouped.has(grade)) {
          grouped.set(grade, []);
        }
        grouped.get(grade)!.push(item);
      });
      return grouped;
    })();

    if (coilSpecsViewMode === 'card') {
      return (
        <div className="coil-specs-tab space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">코일 품목 목록</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                재질등급이 설정된 코일 품목 {coilItems.length}개
              </p>
            </div>
            <div className="p-4">
              {groupedByGrade.size === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  코일 품목이 없습니다
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(groupedByGrade.entries()).map(([grade, items]) => (
                    <div key={grade} className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-2">
                        재질등급: {grade} ({items.length}개)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.map(item => (
                          <div
                            key={item.child_item_id}
                            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                  {item.child_item_code}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {item.child_item_name}
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedCoilItem(item.child_item_id)}
                                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 flex-shrink-0 ml-2"
                                title="설정"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">재질등급:</span>
                                <span className="font-medium text-gray-900 dark:text-white">{grade}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-gray-600 dark:text-gray-400">EA중량:</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {item.weight_per_piece?.toFixed(3) || '-'} kg
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 테이블 뷰 (기본)
    return (
      <div className="coil-specs-tab space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">코일 품목 목록</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              재질등급이 설정된 코일 품목 {coilItems.length}개
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    품목코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    품목명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    재질등급
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    EA중량 (kg)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {coilItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      코일 품목이 없습니다
                    </td>
                  </tr>
                ) : (
                  coilItems.map(item => (
                    <tr key={item.child_item_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.child_item_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.child_item_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {item.material_grade}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                        {item.weight_per_piece?.toFixed(3) || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedCoilItem(item.child_item_id)}
                          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                          <Settings className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedCoilItem && (
          <div
            className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
            onClick={() => setSelectedCoilItem(null)}
          >
            <div
              className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">코일 규격 편집</h3>
              <div className="text-center text-gray-600 dark:text-gray-400 py-8">
                <p>코일 규격 편집 폼은 구현 중입니다.</p>
                <p className="text-sm mt-2">품목 ID: {selectedCoilItem}</p>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setSelectedCoilItem(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCostAnalysisTab = () => {
    if (!costSummary) return null;

    // 차트 뷰만
    if (costAnalysisViewMode === 'charts') {
      return (
        <div className="cost-analysis-tab space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">총 재료비</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    ₩{(costSummary?.total_material_cost || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    기준월: {priceMonth}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">스크랩 수익</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    ₩{costSummary.total_scrap_revenue?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">순 원가</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    ₩{(costSummary?.total_net_cost || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">품목 구성</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {filteredData.length}개
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    코일 {costSummary.coil_count || 0} / 구매 {costSummary.purchased_count || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 차트 섹션 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 원가 구성비 파이 차트 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">원가 구성비</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={[
                        { name: '재료비', value: costSummary?.total_material_cost || 0, color: '#4B5563' },
                        { name: '스크랩 수익', value: costSummary?.total_scrap_revenue || 0, color: '#525252' },
                        { name: '순 원가', value: costSummary?.total_net_cost || 0, color: '#6B7280' }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(1)}%`}
                    >
                      {[
                        { name: '재료비', value: costSummary?.total_material_cost || 0, color: '#4B5563' },
                        { name: '스크랩 수익', value: costSummary?.total_scrap_revenue || 0, color: '#525252' },
                        { name: '순 원가', value: costSummary?.total_net_cost || 0, color: '#6B7280' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, '금액']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 레벨별 원가 분석 바 차트 */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">레벨별 원가 분석</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredData.map(item => ({
                    level: `L${item.level || 1}`,
                    cost: item.net_cost || 0,
                    materialCost: item.material_cost || 0
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, '원가']} />
                    <Legend />
                    <Bar dataKey="cost" fill="#4B5563" name="순 원가" />
                    <Bar dataKey="materialCost" fill="#6B7280" name="재료비" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 수율 분석 섹션 */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">수율 분석</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">내부생산 품목</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                  {filteredData.filter(item => item.item_type === 'internal_production').length}개
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">외부구매 품목</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                  {filteredData.filter(item => item.item_type === 'external_purchase').length}개
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">평균 레벨</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                  {filteredData.length > 0 ? (filteredData.reduce((sum, item) => sum + (item.level || 1), 0) / filteredData.length).toFixed(1) : '0'}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 테이블 뷰만
    if (costAnalysisViewMode === 'table') {
      return (
        <div className="cost-analysis-tab space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">상세 원가 분석</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      품목코드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      품목명
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      재료비
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      스크랩 수익
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      순 원가
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      레벨
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      구분
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        데이터가 없습니다
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item) => (
                      <tr key={item.bom_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {item.child_item_code}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {item.child_item_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                          ₩{item.material_cost?.toLocaleString() || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-400">
                          ₩{item.item_scrap_revenue?.toLocaleString() || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                          ₩{item.net_cost?.toLocaleString() || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                            L{item.level || 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300">
                            {item.item_type === 'internal_production' ? '내부생산' : '외부구매'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    // 개요 뷰 (기본 - 전체)
    return (
      <div className="cost-analysis-tab space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">총 재료비</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{(costSummary?.total_material_cost || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  기준월: {priceMonth}
                </p>
              </div>
              
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">스크랩 수익</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{costSummary.total_scrap_revenue?.toLocaleString() || 0}
                </p>
              </div>
              
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">순 원가</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  ₩{costSummary.total_net_cost?.toLocaleString() || 0}
                </p>
              </div>
              
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">품목 구성</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {filteredData.length}개
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  코일 {costSummary.coil_count || 0} / 구매 {costSummary.purchased_count || 0}
                </p>
              </div>
              
            </div>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 원가 구성비 파이 차트 */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">원가 구성비</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={[
                      { name: '재료비', value: costSummary?.total_material_cost || 0, color: '#4B5563' },
                      { name: '스크랩 수익', value: costSummary?.total_scrap_revenue || 0, color: '#525252' },
                      { name: '순 원가', value: costSummary?.total_net_cost || 0, color: '#6B7280' }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {[
                      { name: '재료비', value: costSummary?.total_material_cost || 0, color: '#4B5563' },
                      { name: '스크랩 수익', value: costSummary?.total_scrap_revenue || 0, color: '#525252' },
                      { name: '순 원가', value: costSummary?.total_net_cost || 0, color: '#6B7280' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, '금액']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 레벨별 원가 분석 바 차트 */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">레벨별 원가 분석</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData.map(item => ({
                  level: `L${item.level || 1}`,
                  cost: item.net_cost || 0,
                  materialCost: item.material_cost || 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, '원가']} />
                  <Legend />
                  <Bar dataKey="cost" fill="#4B5563" name="순 원가" />
                  <Bar dataKey="materialCost" fill="#6B7280" name="재료비" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 수율 분석 섹션 */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">수율 분석</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">내부생산 품목</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {filteredData.filter(item => item.item_type === 'internal_production').length}개
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">외부구매 품목</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {filteredData.filter(item => item.item_type === 'external_purchase').length}개
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">평균 레벨</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {filteredData.length > 0 ? (filteredData.reduce((sum, item) => sum + (item.level || 1), 0) / filteredData.length).toFixed(1) : '0'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">상세 원가 분석</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    품목코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    품목명
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    재료비
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    스크랩 수익
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    순 원가
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    레벨
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    구분
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item.bom_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.child_item_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.child_item_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-900 dark:text-white">
                        ₩{item.material_cost?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600 dark:text-gray-400">
                        ₩{item.item_scrap_revenue?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">
                        ₩{item.net_cost?.toLocaleString() || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                          L{item.level || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 border-gray-800 text-gray-800 bg-transparent dark:border-gray-300 dark:text-gray-300">
                          {item.item_type === 'internal_production' ? '내부생산' : '외부구매'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'structure':
        // 트리 뷰 모드
        if (viewMode === 'tree') {
          return (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden p-4">
              <BOMViewer
                parentItemId={selectedParentItem ? parseInt(selectedParentItem) : undefined}
                readOnly={false}
                onUpdate={() => fetchBOMData()}
                onDelete={() => fetchBOMData()}
                onAdd={() => fetchBOMData()}
                onEditFull={(entry) => {
                  // BOMViewer의 entry를 BOM 페이지의 BOM 타입으로 변환
                  const bomToEdit: BOM = {
                    bom_id: entry.bom_id,
                    parent_item_id: entry.parent_item_id,
                    child_item_id: entry.child_item_id,
                    parent_item_name: entry.parent_item_name,
                    child_item_name: entry.child_item_name,
                    parent_item_code: entry.parent_item_code,
                    child_item_code: entry.child_item_code,
                    quantity: entry.quantity_required,
                    quantity_required: entry.quantity_required,
                    level: entry.level ?? entry.level_no ?? 1,
                    notes: entry.remarks ?? undefined,
                    is_active: entry.is_active ?? true,
                    customer: entry.customer ? {
                      company_id: entry.customer.company_id,
                      company_name: entry.customer.company_name,
                      company_code: entry.customer.company_code
                    } : null,
                    child_supplier: entry.child_supplier ? {
                      company_id: entry.child_supplier.company_id,
                      company_name: entry.child_supplier.company_name,
                      company_code: entry.child_supplier.company_code
                    } : null
                  };
                  setEditingBOM(bomToEdit);
                  setShowAddModal(true);
                }}
                initialSearchTerm={filters.searchTerm}
                customerId={filters.customerId}
                supplierId={filters.supplierId}
                vehicleType={filters.vehicleType}
                suppliers={suppliers}
              />
            </div>
          );
        }

        // 뷰 모드에 따라 테이블 또는 그룹화 뷰 선택
        // 모품목이 선택된 경우 항상 테이블 뷰
        if (viewMode === 'grouped' && !selectedParentItem) {
          return renderGroupedView();
        }
        
        // 테이블 뷰 (기본)
        return (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap border-r border-gray-300 dark:border-gray-600">
                      <button onClick={() => handleSort('customer')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
                        납품처
                        {sortColumn === 'customer' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      <button onClick={() => handleSort('parent_vehicle')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
                        차종
                        {sortColumn === 'parent_vehicle' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap border-r border-gray-300 dark:border-gray-600">
                      <button onClick={() => handleSort('parent_item_code')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
                        품번
                        {sortColumn === 'parent_item_code' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      <button onClick={() => handleSort('parent_item_name')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
                        품명
                        {sortColumn === 'parent_item_name' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap border-r border-gray-300 dark:border-gray-600">
                      <button onClick={() => handleSort('parent_price')} className="flex items-center gap-1 ml-auto hover:text-gray-900 dark:hover:text-gray-100">
                        단가
                        {sortColumn === 'parent_price' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      <button onClick={() => handleSort('child_supplier')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
                        공급처
                        {sortColumn === 'child_supplier' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      <button onClick={() => handleSort('child_vehicle')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
                        차종
                        {sortColumn === 'child_vehicle' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      <button onClick={() => handleSort('child_item_code')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
                        품번
                        {sortColumn === 'child_item_code' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      <button onClick={() => handleSort('child_item_name')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100">
                        품명
                        {sortColumn === 'child_item_name' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      <button onClick={() => handleSort('quantity')} className="flex items-center gap-1 mx-auto hover:text-gray-900 dark:hover:text-gray-100">
                        U/S
                        {sortColumn === 'quantity' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      <button onClick={() => handleSort('child_price')} className="flex items-center gap-1 ml-auto hover:text-gray-900 dark:hover:text-gray-100">
                        단가
                        {sortColumn === 'child_price' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                        데이터를 불러오는 중...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                        등록된 BOM이 없습니다
                      </td>
                    </tr>
                  ) : (
                    renderBOMRows(filteredData)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'coil-specs':
        return renderCoilSpecsTab();

      case 'cost-analysis':
        return renderCostAnalysisTab();

      default:
        return null;
    }
  };

  const printableBOMData = filteredData.map(bom => ({
    ...bom,
    level_display: '├─'.repeat((bom.level || 0)) + (bom.level ? ' ' : ''),
    unit: 'EA'
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Network className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600 dark:text-gray-400" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">BOM 관리</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">부품 구성표(Bill of Materials)를 관리합니다</p>
            </div>
          </div>
          <div className="flex flex-nowrap gap-1.5 items-center overflow-x-auto pb-1">
            {/* 그룹 1: 자동 새로고침 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <label className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">자동갱신</span>
              </label>

              {autoRefresh && (
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs whitespace-nowrap"
                >
                  <option value={10000}>10초</option>
                  <option value={30000}>30초</option>
                  <option value={60000}>1분</option>
                  <option value={300000}>5분</option>
                </select>
              )}
            </div>

            {/* 구분선 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>

            {/* 그룹 2: 주요 액션 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={fetchBOMData}
                disabled={loading}
                className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                갱신
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors whitespace-nowrap text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                BOM 등록
              </button>

              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors whitespace-nowrap text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                대량 등록
              </button>
            </div>

            {/* 구분선 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>

            {/* 그룹 3: 파일 관련 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <label
                className={`flex items-center gap-1 px-2 py-1 border-2 border-dashed rounded-lg cursor-pointer transition-colors whitespace-nowrap text-xs ${
                  dragActive
                    ? 'border-gray-500 bg-gray-50 dark:bg-gray-900/20'
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'
                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? '중...' : '업로드'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInputChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleTemplateDownload}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white rounded-lg hover:bg-gray-700 whitespace-nowrap text-xs"
                title="BOM 템플릿 파일 다운로드 (4개 시트: 고객사별 + 종합 + 최신단가)"
              >
                <Download className="w-3.5 h-3.5" />
                템플릿 다운로드
              </button>

              <button
                onClick={handleExportToExcel}
                disabled={isDownloading}
                className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                title="전체 BOM 데이터를 서버에서 내보내기"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    내보내는 중...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    전체 내보내기
                  </>
                )}
              </button>

              <PrintButton
                data={printableBOMData}
                columns={printColumns}
                title="BOM 구조도"
                subtitle={selectedParentItem ? `모품목 필터 적용` : undefined}
                orientation="landscape"
                className="bg-gray-800 hover:bg-gray-700 text-white whitespace-nowrap text-xs px-2 py-1 flex items-center gap-1"
              />
            </div>
          </div>
        </div>
      </div>


      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-4">
          {/* 첫 번째 줄: 검색창만 */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="품번, 품명으로 검색..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500"
              />
            </div>
          </div>

          {/* 두 번째 줄: 필터 토글 버튼 (모바일에서만 표시) */}
          <div className="md:hidden">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? '필터 접기' : '필터 보기'}
            </button>
          </div>

          {/* 세 번째 줄: 필터 영역 */}
          <div className={`${showFilters ? 'flex' : 'hidden md:flex'} flex-nowrap gap-2 items-end overflow-x-auto pb-1`}>
            {/* 기준 월 선택 */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                기준 월
              </label>
              <input
                type="month"
                value={priceMonth}
                onChange={(e) => setPriceMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm whitespace-nowrap"
              />
            </div>

            <select
              value={filters.level || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                level: e.target.value ? parseInt(e.target.value) : null
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap"
            >
              <option value="">모든 레벨</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
              <option value="5">Level 5</option>
            </select>

            <select
              value={filters.itemType}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                itemType: e.target.value as FilterState['itemType']
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap"
            >
              <option value="all">모든 품목</option>
              <option value="internal_production">내부생산</option>
              <option value="external_purchase">외부구매</option>
            </select>

            {/* 카테고리 필터 */}
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                category: e.target.value
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap"
            >
              <option value="">카테고리</option>
              <option value="원자재">원자재</option>
              <option value="부품">부품</option>
              <option value="완제품">완제품</option>
              <option value="반제품">반제품</option>
              <option value="제품">제품</option>
            </select>

            {/* 소재유형 필터 */}
            <select
              value={filters.materialType}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                materialType: e.target.value
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap"
            >
              <option value="">소재유형</option>
              <option value="COIL">COIL</option>
              <option value="SHEET">SHEET</option>
              <option value="OTHER">OTHER</option>
            </select>

            {/* 납품처(고객사) 필터 */}
            <select
              value={filters.customerId || ''}
              onChange={(e) => {
                const customerId = e.target.value ? parseInt(e.target.value) : null;
                setFilters(prev => ({
                  ...prev,
                  customerId: customerId
                }));
                // 납품처 선택에 따라 뷰 모드 자동 전환
                if (customerId === null) {
                  setViewMode('table'); // 전체 보기: 테이블 뷰
                } else {
                  setViewMode('grouped'); // 특정 납품처: 그룹화 뷰
                }
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap min-w-[150px]"
            >
              <option value="">납품처</option>
              {customers.map(c => (
                <option key={c.company_id} value={c.company_id}>
                  {c.company_name}
                </option>
              ))}
            </select>

            {/* 공급처 필터 (자품목의 supplier) */}
            <select
              value={filters.supplierId || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                supplierId: e.target.value ? parseInt(e.target.value) : null
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap min-w-[150px]"
            >
              <option value="">공급처</option>
              {suppliers.map(s => (
                <option key={s.company_id} value={s.company_id}>
                  {s.company_name}
                </option>
              ))}
            </select>

            {/* 차량 필터 */}
            <select
              value={filters.vehicleType}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                vehicleType: e.target.value
              }))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap min-w-[150px]"
            >
              <option value="">차량</option>
              {vehicleTypes.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="최소 원가"
              value={filters.minCost || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                minCost: e.target.value ? parseFloat(e.target.value) : null
              }))}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm flex-shrink-0 whitespace-nowrap"
            />

            <span className="flex items-center text-gray-500 flex-shrink-0 whitespace-nowrap">~</span>

            <input
              type="number"
              placeholder="최대 원가"
              value={filters.maxCost || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                maxCost: e.target.value ? parseFloat(e.target.value) : null
              }))}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm flex-shrink-0 whitespace-nowrap"
            />

            <select
              value={selectedParentItem}
              onChange={(e) => setSelectedParentItem(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap min-w-[180px]"
            >
              <option value="">모품목</option>
              {items.filter(item => item.category === '제품').map(item => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_code} - {item.item_name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg flex-shrink-0 whitespace-nowrap">
              <input
                type="checkbox"
                id="activeOnly"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-gray-600 focus:ring-gray-400 dark:focus:ring-gray-500"
              />
              <label htmlFor="activeOnly" className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                활성만 표시
              </label>
            </div>

            <button
              onClick={() => {
                setFilters({
                  searchTerm: '',
                  level: null,
                  itemType: 'all',
                  minCost: null,
                  maxCost: null,
                  category: '',
                  materialType: '',
                  customerId: null,
                  purchaseSupplierId: null,
                  supplierId: null,
                  vehicleType: ''
                });
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm flex-shrink-0 whitespace-nowrap"
            >
              초기화
            </button>

            {/* 뷰 모드 토글 버튼 (모든 탭에서 표시) */}
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600 flex-shrink-0"></div>
            <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-700 rounded-lg p-1 flex-shrink-0">
              {activeTab === 'structure' && (
                <>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'table'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="테이블 뷰"
                  >
                    <List className="w-3.5 h-3.5" />
                    테이블
                  </button>
                  <button
                    onClick={() => setViewMode('grouped')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'grouped'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="그룹화 뷰"
                    disabled={!!selectedParentItem}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    그룹화
                  </button>
                  <button
                    onClick={() => setViewMode('tree')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      viewMode === 'tree'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="트리 뷰"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    트리
                  </button>
                </>
              )}
              {activeTab === 'coil-specs' && (
                <>
                  <button
                    onClick={() => setCoilSpecsViewMode('table')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      coilSpecsViewMode === 'table'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="테이블 뷰"
                  >
                    <List className="w-3.5 h-3.5" />
                    테이블
                  </button>
                  <button
                    onClick={() => setCoilSpecsViewMode('card')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      coilSpecsViewMode === 'card'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="카드 뷰"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    카드
                  </button>
                </>
              )}
              {activeTab === 'cost-analysis' && (
                <>
                  <button
                    onClick={() => setCostAnalysisViewMode('overview')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      costAnalysisViewMode === 'overview'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="개요 뷰"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    개요
                  </button>
                  <button
                    onClick={() => setCostAnalysisViewMode('table')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      costAnalysisViewMode === 'table'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="테이블 뷰"
                  >
                    <List className="w-3.5 h-3.5" />
                    테이블
                  </button>
                  <button
                    onClick={() => setCostAnalysisViewMode('charts')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                      costAnalysisViewMode === 'charts'
                        ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                    title="차트 뷰"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    차트
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('structure')}
              className={`px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'structure'
                  ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Network className="w-3 h-3 sm:w-4 sm:h-4" />
                BOM 구조
              </div>
            </button>
            <button
              onClick={() => setActiveTab('coil-specs')}
              className={`px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'coil-specs'
                  ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
                코일 규격
              </div>
            </button>
            <button
              onClick={() => setActiveTab('cost-analysis')}
              className={`px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'cost-analysis'
                  ? 'border-gray-500 text-gray-600 dark:text-gray-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                
                원가 분석
              </div>
            </button>
          </nav>
        </div>

        <div className="p-3 sm:p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* Modal for Add/Edit BOM */}
      <Modal
        isOpen={showAddModal || !!editingBOM}
        onClose={handleCloseModal}
        title={editingBOM ? 'BOM 수정' : 'BOM 등록'}
        size="lg"
      >
        <BOMForm
          bom={editingBOM}
          items={items}
          onSubmit={handleSaveBOM}
          onCancel={handleCloseModal}
        />
      </Modal>

      {/* Modal for Bulk BOM Registration */}
      <Modal
        isOpen={showBulkModal}
        onClose={handleCloseBulkModal}
        title="BOM 대량 등록"
        size="xl"
        maxHeight="tall"
      >
        <BOMBulkForm
          items={items}
          onSubmit={handleBulkSubmit}
          onCancel={handleCloseBulkModal}
        />
      </Modal>

      {/* 모품목 상세정보 모달 */}
      <Modal
        isOpen={showParentDetailModal}
        onClose={() => {
          setShowParentDetailModal(false);
          setSelectedParentDetail(null);
        }}
        title={`모품목 상세정보: ${selectedParentDetail?.parent_item_name || selectedParentDetail?.parent?.item_name || ''}`}
        size="xl"
        maxHeight="tall"
      >
        {selectedParentDetail && (
          <div className="space-y-6">
            {/* 모품목 기본 정보 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                모품목 정보
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">품번</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedParentDetail.parent_item_code || selectedParentDetail.parent?.item_code || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">품명</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedParentDetail.parent_item_name || selectedParentDetail.parent?.item_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">규격</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {selectedParentDetail.parent_spec || selectedParentDetail.parent?.spec || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">차종</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {selectedParentDetail.parent_car_model || selectedParentDetail.parent_vehicle || selectedParentDetail.parent?.vehicle_model || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">납품처</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {selectedParentDetail.customer?.company_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">단가</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {selectedParentDetail.parent?.price && selectedParentDetail.parent.price > 0
                      ? `${selectedParentDetail.parent.price.toLocaleString()} 원`
                      : selectedParentDetail.parent?.unit_price && selectedParentDetail.parent.unit_price > 0
                      ? `${selectedParentDetail.parent.unit_price.toLocaleString()} 원`
                      : selectedParentDetail.unit_price && selectedParentDetail.unit_price > 0
                      ? `${selectedParentDetail.unit_price.toLocaleString()} 원`
                      : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* 연결된 자품목 목록 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Network className="w-5 h-5" />
                연결된 자품목 ({getChildItemsForParent(selectedParentDetail.parent_item_code || selectedParentDetail.parent?.item_code).length}개)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">공급처</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">차종</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">품번</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">품명</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">소요량</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">단가</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {getChildItemsForParent(selectedParentDetail.parent_item_code || selectedParentDetail.parent?.item_code).map((child, index) => {
                      // Debug logging - BOM type has flattened properties
                      if (index === 0) {
                        console.log('[Parent Detail Modal] Child item data structure:', {
                          child_item_id: child.child_item_id,
                          child_item_code: child.child_item_code,
                          child_item_name: child.child_item_name,
                          child_vehicle: child.child_vehicle,
                          child_car_model: child.child_car_model
                        });
                      }

                      return (
                        <tr key={child.bom_id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {child.child_supplier?.company_name || child.child_supplier_name || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {child.child_car_model || child.child_vehicle || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                            {child.child_item_code || '-'}
                          </td>
                          <td
                            className="px-4 py-2 text-sm text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                            onDoubleClick={() => handleItemDoubleClick(child.child_item_id)}
                            title="품목을 더블클릭하여 수정"
                          >
                            {child.child_item_name || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                            {parseFloat((child.quantity || child.quantity_required || 0).toString()).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                            {(child.child?.price && child.child.price > 0)
                              ? `${child.child.price.toLocaleString()} 원`
                              : (child.unit_price && child.unit_price > 0)
                              ? `${child.unit_price.toLocaleString()} 원`
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {getChildItemsForParent(selectedParentDetail.parent_item_code || selectedParentDetail.parent?.item_code).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          연결된 자품목이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 닫기 버튼 */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowParentDetailModal(false);
                  setSelectedParentDetail(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog />

      {/* 품목 수정 모달 */}
      {isItemEditModalOpen && editingItemId && (
        <ItemEditModal
          isOpen={isItemEditModalOpen}
          onClose={handleItemEditModalClose}
          itemId={editingItemId}
          onItemUpdated={handleItemUpdated}
        />
      )}
    </div>
  );
}
