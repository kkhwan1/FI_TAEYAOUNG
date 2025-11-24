'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Edit2,
  ImageIcon,
  History,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import { ImageUploadZone } from '@/components/ImageUploadZone';
import { ItemImageGallery } from '@/components/ItemImageGallery';
import { useToast } from '@/contexts/ToastContext';

interface ItemDetail {
  // 기본 정보
  item_id: number;
  item_code: string;
  item_name: string;
  category: string;
  item_type: string;
  material_type: string;
  vehicle_model?: string;
  
  // 규격 정보
  material?: string;
  spec?: string;
  unit: string;
  thickness?: number;
  width?: number;
  height?: number;
  specific_gravity?: number;
  mm_weight?: number;
  
  // 재고 정보
  current_stock?: number;
  safety_stock?: number;
  location?: string;
  
  // 가격 정보
  price?: number;
  
  // 원가 정보
  scrap_rate?: number;
  scrap_unit_price?: number;
  yield_rate?: number;
  overhead_rate?: number;
  
  // 기타
  coating_status?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BOMUsage {
  as_parent: number;  // 이 품목을 모품목으로 사용하는 BOM 수
  as_child: number;   // 이 품목을 자품목으로 사용하는 BOM 수
}

interface BOMItem {
  item_id: number;
  item_code: string;
  item_name: string;
  unit: string;
  current_stock?: number;
  price?: number;
}

interface BOMStructure {
  bom_id: number;
  quantity_required: number;
  level_no: number;
  labor_cost?: number;
  machine_time?: number;
  setup_time?: number;
  notes?: string;
  child_item?: BOMItem;
  parent_item?: BOMItem;
}

interface BOMData {
  as_parent: BOMStructure[];  // 이 품목이 자품목인 경우의 부모 품목들
  as_child: BOMStructure[];    // 이 품목이 모품목인 경우의 자식 품목들
}

interface StockHistory {
  date: string;
  stock_level: number;
  transaction_type: string;
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { error: showError } = useToast();
  const itemId = params.id as string;
  
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [bomUsage, setBomUsage] = useState<BOMUsage | null>(null);
  const [bomData, setBomData] = useState<BOMData | null>(null);
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'images' | 'bom' | 'history'>('info');
  
  // BOM 테이블 정렬 상태
  const [childSortColumn, setChildSortColumn] = useState<string>('');
  const [childSortOrder, setChildSortOrder] = useState<'asc' | 'desc'>('asc');
  const [parentSortColumn, setParentSortColumn] = useState<string>('');
  const [parentSortOrder, setParentSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadItemDetails();
  }, [itemId]);

  // 자식 품목 정렬 핸들러
  const handleChildSort = (column: string) => {
    if (childSortColumn === column) {
      setChildSortOrder(childSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setChildSortColumn(column);
      setChildSortOrder('asc');
    }
  };

  // 부모 품목 정렬 핸들러
  const handleParentSort = (column: string) => {
    if (parentSortColumn === column) {
      setParentSortOrder(parentSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setParentSortColumn(column);
      setParentSortOrder('asc');
    }
  };

  // 정렬된 자식 품목 목록
  const sortedChildBOM = bomData?.as_child ? [...bomData.as_child].sort((a, b) => {
    if (!childSortColumn) return 0;
    
    let aValue: any;
    let bValue: any;

    switch (childSortColumn) {
      case 'item_code':
        aValue = a.child_item?.item_code || '';
        bValue = b.child_item?.item_code || '';
        break;
      case 'item_name':
        aValue = a.child_item?.item_name || '';
        bValue = b.child_item?.item_name || '';
        break;
      case 'quantity_required':
        aValue = a.quantity_required || 0;
        bValue = b.quantity_required || 0;
        break;
      case 'current_stock':
        aValue = a.child_item?.current_stock || 0;
        bValue = b.child_item?.current_stock || 0;
        break;
      case 'price':
        aValue = a.child_item?.price || 0;
        bValue = b.child_item?.price || 0;
        break;
      case 'level_no':
        aValue = a.level_no || 0;
        bValue = b.level_no || 0;
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return childSortOrder === 'asc' 
        ? aValue.localeCompare(bValue, 'ko')
        : bValue.localeCompare(aValue, 'ko');
    } else {
      return childSortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  }) : [];

  // 정렬된 부모 품목 목록
  const sortedParentBOM = bomData?.as_parent ? [...bomData.as_parent].sort((a, b) => {
    if (!parentSortColumn) return 0;
    
    let aValue: any;
    let bValue: any;

    switch (parentSortColumn) {
      case 'item_code':
        aValue = a.parent_item?.item_code || '';
        bValue = b.parent_item?.item_code || '';
        break;
      case 'item_name':
        aValue = a.parent_item?.item_name || '';
        bValue = b.parent_item?.item_name || '';
        break;
      case 'quantity_required':
        aValue = a.quantity_required || 0;
        bValue = b.quantity_required || 0;
        break;
      case 'current_stock':
        aValue = a.parent_item?.current_stock || 0;
        bValue = b.parent_item?.current_stock || 0;
        break;
      case 'price':
        aValue = a.parent_item?.price || 0;
        bValue = b.parent_item?.price || 0;
        break;
      case 'level_no':
        aValue = a.level_no || 0;
        bValue = b.level_no || 0;
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return parentSortOrder === 'asc' 
        ? aValue.localeCompare(bValue, 'ko')
        : bValue.localeCompare(aValue, 'ko');
    } else {
      return parentSortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  }) : [];

  const loadItemDetails = async () => {
    setLoading(true);
    try {
      console.log('Loading item details for ID:', itemId);
      
      // 모든 데이터를 병렬로 가져오기 (타임아웃 및 재시도 포함)
      const { safeFetchAllJson } = await import('@/lib/fetch-utils');
      
      const [itemData, bomUsageData, bomStructureData, historyData] = await safeFetchAllJson([
        { url: `/api/items/${itemId}` },
        { url: `/api/items/${itemId}/bom-usage` },
        { url: `/api/items/${itemId}/bom-structure` },
        { url: `/api/items/${itemId}/stock-history?days=30` }
      ], {
        timeout: 15000, // 15초 타임아웃
        maxRetries: 2,  // 최대 2회 재시도
        retryDelay: 1000 // 1초 간격
      });

      // 응답 검증 및 상태 업데이트
      if (itemData?.success && itemData.data) {
        setItem(itemData.data);
      }
      
      if (bomUsageData?.success && bomUsageData.data) {
        setBomUsage(bomUsageData.data);
      }
      
      if (bomStructureData?.success && bomStructureData.data) {
        setBomData(bomStructureData.data);
      }
      
      if (historyData?.success && historyData.data) {
        setStockHistory(historyData.data);
      }
      
      console.log('All data loaded successfully');
    } catch (error) {
      console.error('Failed to load item details:', error);
      // 부분 실패 시에도 표시 가능한 데이터는 유지
      // 전체 실패 시에만 빈 데이터로 설정
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-lg">로딩 중...</div>
    </div>;
  }

  if (!item) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-lg">품목을 찾을 수 없습니다</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{item.item_name}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {item.item_code} · {item.category}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/master/items?edit=${itemId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <Edit2 className="w-4 h-4" />
              수정
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-6 mt-4 border-b border-gray-200">
            {[
              { key: 'info', label: '기본 정보' },
              { key: 'images', label: '이미지' },
              { key: 'bom', label: 'BOM 구성' },
              { key: 'history', label: '재고 이력' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-gray-700 text-gray-900 dark:border-gray-300 dark:text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 왼쪽: 대표 이미지 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">대표 이미지</h3>
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  {/* Primary image will be loaded here */}
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-16 h-16" />
                  </div>
                </div>
              </div>

              {/* 요약 카드 */}
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">요약 정보</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">현재고</dt>
                    <dd className="font-semibold text-gray-900">
                      {item.current_stock?.toLocaleString() || 0} {item.unit}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">단가</dt>
                    <dd className="font-semibold text-gray-900">
                      ₩{item.price?.toLocaleString() || 0}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">재고금액</dt>
                    <dd className="font-semibold text-gray-900 dark:text-white">
                      ₩{((item.current_stock || 0) * (item.price || 0)).toLocaleString()}
                    </dd>
                  </div>
                  {bomUsage && (
                    <>
                      <div className="flex justify-between pt-3 border-t">
                        <dt className="text-gray-600">BOM (모품목)</dt>
                        <dd className="font-semibold">{bomUsage.as_parent}개</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">BOM (자품목)</dt>
                        <dd className="font-semibold">{bomUsage.as_child}개</dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            </div>

            {/* 오른쪽: 상세 정보 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 기본 정보 섹션 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  
                  기본 정보
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  <InfoRow label="품목코드" value={item.item_code} />
                  <InfoRow label="품목명" value={item.item_name} />
                  <InfoRow label="분류" value={item.category} />
                  <InfoRow label="품목 유형" value={item.item_type} />
                  <InfoRow label="차종" value={item.vehicle_model} />
                  <InfoRow label="재질" value={item.material} />
                  <InfoRow label="규격" value={item.spec} />
                  <InfoRow label="단위" value={item.unit} />
                  <InfoRow label="도장상태" value={item.coating_status} />
                </div>
              </div>

              {/* 치수 정보 섹션 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  
                  치수 및 물성 정보
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  <InfoRow label="두께 (mm)" value={item.thickness} />
                  <InfoRow label="폭 (mm)" value={item.width} />
                  <InfoRow label="높이 (mm)" value={item.height} />
                  <InfoRow label="비중" value={item.specific_gravity} />
                  <InfoRow label="단위중량 (kg)" value={item.mm_weight} />
                  <div></div> {/* 빈 공간으로 레이아웃 유지 */}
                </div>
              </div>

              {/* 원가 정보 섹션 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  
                  원가 관련 정보
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  <InfoRow label="스크랩율 (%)" value={item.scrap_rate} />
                  <InfoRow label="스크랩 단가 (원/kg)" value={item.scrap_unit_price} prefix="₩" />
                  <InfoRow label="수율 (%)" value={item.yield_rate} />
                  <InfoRow label="간접비율 (%)" value={item.overhead_rate} />
                  <div></div> {/* 빈 공간으로 레이아웃 유지 */}
                  <div></div> {/* 빈 공간으로 레이아웃 유지 */}
                </div>
              </div>

              {/* 재고 정보 섹션 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  
                  재고 관리 정보
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  <InfoRow label="현재고" value={item.current_stock} suffix={item.unit} />
                  <InfoRow label="안전재고" value={item.safety_stock} suffix={item.unit} />
                  <InfoRow label="보관위치" value={item.location} />
                  <InfoRow label="단가" value={item.price} prefix="₩" />
                  <div></div> {/* 빈 공간으로 레이아웃 유지 */}
                  <div></div> {/* 빈 공간으로 레이아웃 유지 */}
                </div>
              </div>

              {/* 비고 */}
              {item.description && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">비고</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{item.description}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">이미지 업로드</h3>
                <ImageUploadZone
                  itemId={itemId}
                  onUploadSuccess={() => {}}
                  onUploadError={(error) => showError(error)}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">등록된 이미지</h3>
                <ItemImageGallery
                  itemId={itemId}
                  refreshTrigger={0}
                  onImageDeleted={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bom' && (
          <div className="space-y-6">
            {/* 이 품목이 모품목인 경우 - 자식 품목들 */}
            {bomData?.as_child && bomData.as_child.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  
                  구성 품목 (자식 품목)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleChildSort('item_code')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            품목코드
                            {childSortColumn === 'item_code' ? (
                              childSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleChildSort('item_name')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            품목명
                            {childSortColumn === 'item_name' ? (
                              childSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleChildSort('quantity_required')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                          >
                            필요수량
                            {childSortColumn === 'quantity_required' ? (
                              childSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">단위</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleChildSort('current_stock')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                          >
                            현재고
                            {childSortColumn === 'current_stock' ? (
                              childSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleChildSort('price')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                          >
                            단가
                            {childSortColumn === 'price' ? (
                              childSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleChildSort('level_no')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            레벨
                            {childSortColumn === 'level_no' ? (
                              childSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedChildBOM.map((bom) => (
                        <tr key={bom.bom_id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-600">
                            {bom.child_item?.item_code}
                          </td>
                          <td className="px-4 py-3 text-sm">{bom.child_item?.item_name}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {bom.quantity_required}
                          </td>
                          <td className="px-4 py-3 text-sm">{bom.child_item?.unit}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {bom.child_item?.current_stock?.toLocaleString() || 0}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            ₩{bom.child_item?.price?.toLocaleString() || 0}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                              L{bom.level_no}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{bom.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 이 품목이 자품목인 경우 - 부모 품목들 */}
            {bomData?.as_parent && bomData.as_parent.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  
                  사용처 (부모 품목)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleParentSort('item_code')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            품목코드
                            {parentSortColumn === 'item_code' ? (
                              parentSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleParentSort('item_name')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            품목명
                            {parentSortColumn === 'item_name' ? (
                              parentSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleParentSort('quantity_required')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                          >
                            사용수량
                            {parentSortColumn === 'quantity_required' ? (
                              parentSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">단위</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleParentSort('current_stock')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                          >
                            현재고
                            {parentSortColumn === 'current_stock' ? (
                              parentSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleParentSort('price')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                          >
                            단가
                            {parentSortColumn === 'price' ? (
                              parentSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          <button
                            onClick={() => handleParentSort('level_no')}
                            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            레벨
                            {parentSortColumn === 'level_no' ? (
                              parentSortOrder === 'asc' ?
                                <ArrowUp className="w-3 h-3" /> :
                                <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedParentBOM.map((bom) => (
                        <tr key={bom.bom_id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-600">
                            {bom.parent_item?.item_code}
                          </td>
                          <td className="px-4 py-3 text-sm">{bom.parent_item?.item_name}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {bom.quantity_required}
                          </td>
                          <td className="px-4 py-3 text-sm">{bom.parent_item?.unit}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {bom.parent_item?.current_stock?.toLocaleString() || 0}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            ₩{bom.parent_item?.price?.toLocaleString() || 0}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                              L{bom.level_no}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{bom.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* BOM 데이터가 없는 경우 */}
            {(!bomData?.as_child || bomData.as_child.length === 0) && 
             (!bomData?.as_parent || bomData.as_parent.length === 0) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">BOM 구성 정보</h3>
                <div className="text-center py-8">
                  
                  <p className="text-gray-500 text-lg">BOM 구성 정보가 없습니다</p>
                  <p className="text-gray-400 text-sm mt-2">
                    이 품목은 다른 품목의 구성품으로 사용되지 않으며,<br />
                    다른 품목을 구성품으로 사용하지 않습니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">재고 이력 (최근 30일)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">날짜</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">재고량</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">유형</th>
                  </tr>
                </thead>
                <tbody>
                  {stockHistory.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                        재고 이력이 없습니다
                      </td>
                    </tr>
                  ) : (
                    stockHistory.map((record, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{record.date}</td>
                        <td className="px-4 py-3 text-sm text-right">{record.stock_level}</td>
                        <td className="px-4 py-3 text-sm">{record.transaction_type}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component
function InfoRow({ 
  label, 
  value, 
  prefix = '', 
  suffix = '' 
}: { 
  label: string; 
  value?: string | number | null; 
  prefix?: string; 
  suffix?: string; 
}) {
  const displayValue = value !== null && value !== undefined 
    ? `${prefix}${typeof value === 'number' ? value.toLocaleString() : value}${suffix}`
    : '-';

  return (
    <div className="min-h-[60px] flex flex-col justify-start">
      <dt className="text-sm text-gray-600 mb-2 font-medium">{label}</dt>
      <dd className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1 flex items-center">
        {displayValue}
      </dd>
    </div>
  );
}
