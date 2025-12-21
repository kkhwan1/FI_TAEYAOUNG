'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Search } from 'lucide-react';
import CompanySelect from './CompanySelect';

interface BOM {
  bom_id?: number;
  parent_item_id: number;
  child_item_id: number;
  parent_item_name?: string;
  child_item_name?: string;
  quantity: number;
  level_no?: number;
  notes?: string;
  customer_id?: number | null;
  child_supplier_id?: number | null;
  parent_item_data?: {
    price?: number | null;
    vehicle_model?: string | null;
    thickness?: number | null;
    width?: number | null;
    height?: number | null;
    material?: string | null;
  };
  child_item_data?: {
    price?: number | null;
    vehicle_model?: string | null;
    thickness?: number | null;
    width?: number | null;
    height?: number | null;
    material?: string | null;
  };
}

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  category: string;
  unit: string;
  inventory_type?: string;
  price?: number | null;
  vehicle_model?: string | null;
  thickness?: number | null;
  width?: number | null;
  height?: number | null;
  material?: string | null;
}

interface BOMFormProps {
  bom?: BOM | null;
  items: Item[];
  onSubmit: (data: Omit<BOM, 'bom_id' | 'parent_item_name' | 'child_item_name'>) => Promise<void>;
  onCancel: () => void;
}

export default function BOMForm({ bom, items, onSubmit, onCancel }: BOMFormProps) {
  const [formData, setFormData] = useState<Omit<BOM, 'bom_id' | 'parent_item_name' | 'child_item_name'>>({
    parent_item_id: 0,
    child_item_id: 0,
    quantity: 1,
    level_no: 1,
    notes: '',
    customer_id: null,
    child_supplier_id: null
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [parentSearchTerm, setParentSearchTerm] = useState('');
  const [childSearchTerm, setChildSearchTerm] = useState('');
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [showChildDropdown, setShowChildDropdown] = useState(false);
  const [selectedParentItem, setSelectedParentItem] = useState<Item | null>(null);
  const [selectedChildItem, setSelectedChildItem] = useState<Item | null>(null);
  const [showCoilOnly, setShowCoilOnly] = useState(false);
  const [parentItemData, setParentItemData] = useState<{
    price?: number | null;
    vehicle_model?: string | null;
    thickness?: number | null;
    width?: number | null;
    height?: number | null;
    material?: string | null;
  }>({});
  const [childItemData, setChildItemData] = useState<{
    price?: number | null;
    vehicle_model?: string | null;
    thickness?: number | null;
    width?: number | null;
    height?: number | null;
    material?: string | null;
  }>({});


  useEffect(() => {
    if (bom) {
      setFormData({
        parent_item_id: bom.parent_item_id,
        child_item_id: bom.child_item_id,
        quantity: bom.quantity,
        level_no: bom.level_no || 1,
        notes: bom.notes || '',
        customer_id: bom.customer_id ?? null,
        child_supplier_id: bom.child_supplier_id ?? null
      });

      // Find and set selected items
      const parentItem = items.find(item => item.item_id === bom.parent_item_id);
      const childItem = items.find(item => item.item_id === bom.child_item_id);

      if (parentItem) {
        setSelectedParentItem(parentItem);
        setParentSearchTerm(`${parentItem.item_code} - ${parentItem.item_name}`);
        // Set parent item data from bom or item
        setParentItemData({
          price: bom.parent_item_data?.price ?? parentItem.price ?? null,
          vehicle_model: bom.parent_item_data?.vehicle_model ?? parentItem.vehicle_model ?? null,
          thickness: bom.parent_item_data?.thickness ?? parentItem.thickness ?? null,
          width: bom.parent_item_data?.width ?? parentItem.width ?? null,
          height: bom.parent_item_data?.height ?? parentItem.height ?? null,
          material: bom.parent_item_data?.material ?? parentItem.material ?? null,
        });
      }

      if (childItem) {
        setSelectedChildItem(childItem);
        setChildSearchTerm(`${childItem.item_code} - ${childItem.item_name}`);
        // Set child item data from bom or item
        setChildItemData({
          price: bom.child_item_data?.price ?? childItem.price ?? null,
          vehicle_model: bom.child_item_data?.vehicle_model ?? childItem.vehicle_model ?? null,
          thickness: bom.child_item_data?.thickness ?? childItem.thickness ?? null,
          width: bom.child_item_data?.width ?? childItem.width ?? null,
          height: bom.child_item_data?.height ?? childItem.height ?? null,
          material: bom.child_item_data?.material ?? childItem.material ?? null,
        });
      }
    }
  }, [bom, items]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : 0) : value
    }));
    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleParentSearch = (searchTerm: string) => {
    setParentSearchTerm(searchTerm);
    setShowParentDropdown(true);
    if (!searchTerm) {
      setSelectedParentItem(null);
      setFormData(prev => ({ ...prev, parent_item_id: 0 }));
    }
  };

  const handleChildSearch = (searchTerm: string) => {
    setChildSearchTerm(searchTerm);
    setShowChildDropdown(true);
    if (!searchTerm) {
      setSelectedChildItem(null);
      setFormData(prev => ({ ...prev, child_item_id: 0 }));
    }
  };

  const selectParentItem = (item: Item) => {
    setSelectedParentItem(item);
    setParentSearchTerm(`${item.item_code} - ${item.item_name}`);
    setFormData(prev => ({ ...prev, parent_item_id: item.item_id }));
    setShowParentDropdown(false);
    // Set parent item data from selected item
    setParentItemData({
      price: item.price ?? null,
      vehicle_model: item.vehicle_model ?? null,
      thickness: item.thickness ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      material: item.material ?? null,
    });
    // Clear error
    if (errors.parent_item_id) {
      setErrors(prev => ({ ...prev, parent_item_id: '' }));
    }
  };

  const selectChildItem = (item: Item) => {
    setSelectedChildItem(item);
    setChildSearchTerm(`${item.item_code} - ${item.item_name}`);
    setFormData(prev => ({
      ...prev,
      child_item_id: item.item_id
    }));
    setShowChildDropdown(false);
    // Set child item data from selected item
    setChildItemData({
      price: item.price ?? null,
      vehicle_model: item.vehicle_model ?? null,
      thickness: item.thickness ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      material: item.material ?? null,
    });
    // Clear error
    if (errors.child_item_id) {
      setErrors(prev => ({ ...prev, child_item_id: '' }));
    }
  };

  const filteredParentItems = items.filter(item =>
    // 완제품, 반제품 모두 모품목으로 선택 가능 (제조 공정에서 중간 산출물도 모품목이 될 수 있음)
    (item.category === '완제품' || item.category === '반제품' || item.category === '제품') &&
    (item.item_code.toLowerCase().includes(parentSearchTerm.toLowerCase()) ||
     item.item_name.toLowerCase().includes(parentSearchTerm.toLowerCase()))
  ).slice(0, 10);

  const filteredChildItems = items.filter(item => {
    // Prevent self-referencing
    if (item.item_id === formData.parent_item_id) return false;

    // Apply coil filter if checkbox is checked
    if (showCoilOnly && item.inventory_type !== '코일') return false;

    // Apply search filter
    return (
      item.item_code.toLowerCase().includes(childSearchTerm.toLowerCase()) ||
      item.item_name.toLowerCase().includes(childSearchTerm.toLowerCase())
    );
  }).slice(0, 10);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.parent_item_id) {
      newErrors.parent_item_id = '모품목을 선택해주세요';
    }
    if (!formData.child_item_id) {
      newErrors.child_item_id = '자품목을 선택해주세요';
    }
    // 자기 참조 허용: 모품목과 자품목이 같을 수 있음
    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = '소요량은 0보다 커야 합니다';
    }
    if (!formData.level_no || formData.level_no < 1 || formData.level_no > 10) {
      newErrors.level_no = '레벨은 1~10 사이여야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleItemDataChange = (
    type: 'parent' | 'child',
    field: string,
    value: string | number | null
  ) => {
    // Validate and convert value with NaN check
    let processedValue: string | number | null = value;

    if (value === '' || value === null) {
      processedValue = null;
    } else if (typeof value === 'string') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        console.warn(`[BOMForm] Invalid numeric value for ${field}: "${value}"`);
        processedValue = null;
      } else {
        processedValue = numValue;
      }
    } else if (typeof value === 'number' && isNaN(value)) {
      console.warn(`[BOMForm] NaN detected for ${field}, setting to null`);
      processedValue = null;
    }

    if (type === 'parent') {
      setParentItemData(prev => ({
        ...prev,
        [field]: processedValue
      }));
    } else {
      setChildItemData(prev => ({
        ...prev,
        [field]: processedValue
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      console.log('[BOM FORM] Submitting formData:', formData);
      console.log('[BOM FORM] parent_item_id:', formData.parent_item_id);
      console.log('[BOM FORM] child_item_id:', formData.child_item_id);
      console.log('[BOM FORM] quantity:', formData.quantity);
      console.log('[BOM FORM] level_no:', formData.level_no);
      console.log('[BOM FORM] customer_id:', formData.customer_id);
      console.log('[BOM FORM] child_supplier_id:', formData.child_supplier_id);
      console.log('[BOM FORM] parent_item_data:', parentItemData);
      console.log('[BOM FORM] child_item_data:', childItemData);

      const submitData = {
        ...formData,
        parent_item_data: Object.keys(parentItemData).length > 0 ? parentItemData : undefined,
        child_item_data: Object.keys(childItemData).length > 0 ? childItemData : undefined,
      };

      await onSubmit(submitData);
      // 성공 시 자동으로 모달 닫기
      onCancel();
    } catch (error) {
      // 에러는 상위 컴포넌트에서 처리
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 품목 정보 & 거래처 정보 - 2열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 품목 정보 섹션 */}
        <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2">
            품목 정보
          </h3>

          {/* 모품목 (Parent Item) */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              모품목 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={parentSearchTerm}
                onChange={(e) => handleParentSearch(e.target.value)}
                onFocus={() => setShowParentDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowParentDropdown(false);
                  } else if (e.key === 'ArrowDown' && filteredParentItems.length > 0) {
                    e.preventDefault();
                    setShowParentDropdown(true);
                  }
                }}
                className={`w-full px-4 py-2 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.parent_item_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="모품목을 검색하세요..."
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>

            {showParentDropdown && filteredParentItems.length > 0 && (
              <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm max-h-60 overflow-y-auto">
                {filteredParentItems.map((item) => (
                  <button
                    key={item.item_id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectParentItem(item);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.item_code}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {item.item_name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {errors.parent_item_id && (
              <p className="mt-1 text-sm text-red-500">{errors.parent_item_id}</p>
            )}
          </div>

          {/* 자품목 (Child Item) */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              자품목 <span className="text-red-500">*</span>
            </label>

            <div className="mb-2">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCoilOnly}
                  onChange={(e) => setShowCoilOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  코일 자재만 표시
                </span>
              </label>
            </div>

            <div className="relative">
              <input
                type="text"
                value={childSearchTerm}
                onChange={(e) => handleChildSearch(e.target.value)}
                onFocus={() => setShowChildDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowChildDropdown(false);
                  } else if (e.key === 'ArrowDown' && filteredChildItems.length > 0) {
                    e.preventDefault();
                    setShowChildDropdown(true);
                  }
                }}
                className={`w-full px-4 py-2 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.child_item_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="자품목을 검색하세요..."
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>

            {showChildDropdown && filteredChildItems.length > 0 && (
              <div className="absolute z-[9999] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm max-h-60 overflow-y-auto">
                {filteredChildItems.map((item) => (
                  <button
                    key={item.item_id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectChildItem(item);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.item_code}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {item.item_name} ({item.category})
                        </div>
                      </div>
                      {item.inventory_type === '코일' && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          코일
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {errors.child_item_id && (
              <p className="mt-1 text-sm text-red-500">{errors.child_item_id}</p>
            )}
          </div>
        </div>

        {/* 거래처 정보 섹션 */}
        <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2">
            거래처 정보
          </h3>

          {/* 납품처 (Customer) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              납품처 (고객사)
            </label>
            <CompanySelect
              value={formData.customer_id}
              onChange={(companyId) => {
                setFormData(prev => ({ ...prev, customer_id: companyId }));
                if (errors.customer_id) {
                  setErrors(prev => ({ ...prev, customer_id: '' }));
                }
              }}
              companyType="CUSTOMER"
              placeholder="납품처를 선택하세요..."
              error={errors.customer_id}
            />
          </div>

          {/* 공급처 (Supplier) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              공급처 (자품목 공급업체)
            </label>
            <CompanySelect
              value={formData.child_supplier_id}
              onChange={(companyId) => {
                setFormData(prev => ({ ...prev, child_supplier_id: companyId }));
                if (errors.child_supplier_id) {
                  setErrors(prev => ({ ...prev, child_supplier_id: '' }));
                }
              }}
              companyType="SUPPLIER"
              placeholder="공급처를 선택하세요..."
              error={errors.child_supplier_id}
            />
          </div>
        </div>
      </div>

      {/* BOM 상세 섹션 */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
          BOM 상세
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 레벨 (Level) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              레벨 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="level_no"
              value={formData.level_no}
              onChange={handleChange}
              min="1"
              max="10"
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.level_no ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="1"
            />
            <p className="mt-1 text-xs text-gray-500">BOM 계층 수준 (1~10)</p>
            {errors.level_no && (
              <p className="mt-1 text-sm text-red-500">{errors.level_no}</p>
            )}
          </div>

          {/* 소요량 (Quantity) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              소요량 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              min="0"
              step="0.01"
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.quantity ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="1"
            />
            <p className="mt-1 text-xs text-gray-500">모품목 1개 생산에 필요한 자품목 수량</p>
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>
            )}
          </div>
        </div>

        {/* 비고 (Notes) */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            비고
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="추가 정보나 특이사항을 입력하세요..."
          />
        </div>
      </div>

      {/* 품목 상세 정보 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 모품목 상세 정보 */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
            모품목 상세 정보
          </h3>
          {selectedParentItem ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  차종
                </label>
                <input
                  type="text"
                  value={parentItemData.vehicle_model || ''}
                  onChange={(e) => handleItemDataChange('parent', 'vehicle_model', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="차종을 입력하세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  단가 (₩)
                </label>
                <input
                  type="number"
                  value={parentItemData.price || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = value ? parseFloat(value) : null;
                    if (numValue !== null && isNaN(numValue)) {
                      console.warn('[BOMForm] Invalid price value');
                      return;
                    }
                    handleItemDataChange('parent', 'price', numValue);
                  }}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="단가를 입력하세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  재질
                </label>
                <input
                  type="text"
                  value={parentItemData.material || ''}
                  onChange={(e) => handleItemDataChange('parent', 'material', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="재질을 입력하세요..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    두께 (mm)
                  </label>
                  <input
                    type="number"
                    value={parentItemData.thickness || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value ? parseFloat(value) : null;
                      if (numValue !== null && isNaN(numValue)) {
                        console.warn('[BOMForm] Invalid thickness value');
                        return;
                      }
                      handleItemDataChange('parent', 'thickness', numValue);
                    }}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="두께"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    폭 (mm)
                  </label>
                  <input
                    type="number"
                    value={parentItemData.width || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value ? parseFloat(value) : null;
                      if (numValue !== null && isNaN(numValue)) {
                        console.warn('[BOMForm] Invalid width value');
                        return;
                      }
                      handleItemDataChange('parent', 'width', numValue);
                    }}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="폭"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    길이 (mm)
                  </label>
                  <input
                    type="number"
                    value={parentItemData.height || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value ? parseFloat(value) : null;
                      if (numValue !== null && isNaN(numValue)) {
                        console.warn('[BOMForm] Invalid height value');
                        return;
                      }
                      handleItemDataChange('parent', 'height', numValue);
                    }}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="길이"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">모품목을 선택하면 상세 정보를 수정할 수 있습니다.</p>
          )}
        </div>

        {/* 자품목 상세 정보 */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-2 mb-4">
            자품목 상세 정보
          </h3>
          {selectedChildItem ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  차종
                </label>
                <input
                  type="text"
                  value={childItemData.vehicle_model || ''}
                  onChange={(e) => handleItemDataChange('child', 'vehicle_model', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="차종을 입력하세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  단가 (₩)
                </label>
                <input
                  type="number"
                  value={childItemData.price || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = value ? parseFloat(value) : null;
                    if (numValue !== null && isNaN(numValue)) {
                      console.warn('[BOMForm] Invalid child price value');
                      return;
                    }
                    handleItemDataChange('child', 'price', numValue);
                  }}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="단가를 입력하세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  재질
                </label>
                <input
                  type="text"
                  value={childItemData.material || ''}
                  onChange={(e) => handleItemDataChange('child', 'material', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="재질을 입력하세요..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    두께 (mm)
                  </label>
                  <input
                    type="number"
                    value={childItemData.thickness || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value ? parseFloat(value) : null;
                      if (numValue !== null && isNaN(numValue)) {
                        console.warn('[BOMForm] Invalid child thickness value');
                        return;
                      }
                      handleItemDataChange('child', 'thickness', numValue);
                    }}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="두께"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    폭 (mm)
                  </label>
                  <input
                    type="number"
                    value={childItemData.width || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value ? parseFloat(value) : null;
                      if (numValue !== null && isNaN(numValue)) {
                        console.warn('[BOMForm] Invalid child width value');
                        return;
                      }
                      handleItemDataChange('child', 'width', numValue);
                    }}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="폭"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    길이 (mm)
                  </label>
                  <input
                    type="number"
                    value={childItemData.height || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = value ? parseFloat(value) : null;
                      if (numValue !== null && isNaN(numValue)) {
                        console.warn('[BOMForm] Invalid child height value');
                        return;
                      }
                      handleItemDataChange('child', 'height', numValue);
                    }}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="길이"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">자품목을 선택하면 상세 정보를 수정할 수 있습니다.</p>
          )}
        </div>
      </div>

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
          className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              처리중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {bom ? '수정' : '등록'}
            </>
          )}
        </button>
      </div>

      {/* Click away handlers */}
      {(showParentDropdown || showChildDropdown) && (
        <div
          className="fixed inset-0 z-[9998]"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowParentDropdown(false);
            setShowChildDropdown(false);
          }}
        />
      )}
    </form>
  );
}
