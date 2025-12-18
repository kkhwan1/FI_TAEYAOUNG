'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useToastNotification } from '@/hooks/useToast';
import type { ItemCategory, ItemTypeCode, MaterialTypeCode } from '@/types/supabase';
import {
  type CoatingStatus,
  COATING_STATUS_OPTIONS as SHARED_COATING_STATUS_OPTIONS,
  DEFAULT_COATING_STATUS
} from '@/lib/constants/coatingStatus';
import {
  INVENTORY_TYPE_OPTIONS as SHARED_INVENTORY_TYPE_OPTIONS,
  QUALITY_STATUS_OPTIONS as SHARED_QUALITY_STATUS_OPTIONS,
  type InventoryType,
  type QualityStatus
} from '@/lib/constants/inventoryTypes';

interface ItemFormProps {
  item?: Partial<ItemFormValues> | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

interface ItemFormValues {
  item_id?: number;
  item_code: string;
  item_name: string;
  category: ItemCategory | '';
  item_type: ItemTypeCode;
  material_type: MaterialTypeCode;
  vehicle_model: string;
  material: string;
  spec: string;
  unit: string;
  thickness: string;
  width: string;
  height: string;
  specific_gravity: string;
  mm_weight: string;
  daily_requirement: string;
  blank_size: string;
  current_stock: string;
  safety_stock: string;
  price: string;
  location: string;
  description: string;
  coating_status: CoatingStatus;
  scrap_rate?: number;
  scrap_unit_price?: number;
  yield_rate?: number;
  overhead_rate?: number;
  // Phase 3 - Inventory Classification
  inventory_type?: InventoryType;
  warehouse_zone?: string;
  quality_status?: QualityStatus;
  // 프레스 공정 타입 (블랭킹/성형 구분)
  press_process_type?: 'BLANKING' | 'STAMPING' | null;
}

const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: '원자재' as ItemCategory, label: '원자재' },
  { value: '부자재' as ItemCategory, label: '부자재' },
  { value: '반제품' as ItemCategory, label: '반제품' },
  { value: '완제품' as ItemCategory, label: '완제품' },
  { value: '상품' as ItemCategory, label: '상품' }
];

const ITEM_TYPES: { value: string; label: string }[] = [
  { value: 'RAW', label: '원자재 (RAW)' },
  { value: 'SUB', label: '부자재 (SUB)' },
  { value: 'FINISHED', label: '완제품 (FINISHED)' }
];

const MATERIAL_TYPES: { value: string; label: string }[] = [
  { value: 'COIL', label: 'COIL' },
  { value: 'SHEET', label: 'SHEET' },
  { value: 'OTHER', label: '기타 (OTHER)' }
];

// 프레스 공정 타입 옵션
const PRESS_PROCESS_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'BLANKING', label: '블랭킹 (400~600톤)' },
  { value: 'STAMPING', label: '성형 (1000~1600톤)' }
];

import { UNIT_OPTIONS } from '@/constants/units';

// COATING_STATUS_OPTIONS now imported from @/lib/constants/coatingStatus
const COATING_STATUS_OPTIONS = SHARED_COATING_STATUS_OPTIONS.filter(opt => opt.value !== '');

// Phase 3 - Inventory Classification options
// Now imported from centralized constants to ensure consistency with database schema
const INVENTORY_TYPE_OPTIONS = SHARED_INVENTORY_TYPE_OPTIONS;
const QUALITY_STATUS_OPTIONS = SHARED_QUALITY_STATUS_OPTIONS;

const DEFAULT_VALUES: ItemFormValues = {
  item_code: '',
  item_name: '',
  category: '' as ItemCategory | '',
  item_type: 'RAW',
  material_type: 'OTHER',
  vehicle_model: '',
  material: '',
  spec: '',
  unit: 'EA',
  thickness: '',
  width: '',
  height: '',
  specific_gravity: '7.85',
  mm_weight: '',
  daily_requirement: '',
  blank_size: '',
  current_stock: '',
  safety_stock: '',
  price: '',
  location: '',
  description: '',
  coating_status: DEFAULT_COATING_STATUS
};

export default function ItemForm({ item, onSubmit, onCancel }: ItemFormProps) {
  const [formData, setFormData] = useState<ItemFormValues>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mmWeightDirty, setMmWeightDirty] = useState(false);
  const toast = useToastNotification();

  useEffect(() => {
    if (!item) {
      setFormData(DEFAULT_VALUES);
      setMmWeightDirty(false);
      return;
    }

    const initialCategory = (item.category as ItemCategory | undefined) ?? (item as any)?.category ?? '';
    const initialValues: ItemFormValues = {
      item_id: item.item_id,
      item_code: item.item_code ?? '',
      item_name: item.item_name ?? (item as any)?.name ?? '',
      category: (initialCategory as ItemCategory) ?? ('' as ItemCategory | ''),
      item_type: (item.item_type as ItemTypeCode) ?? 'RAW',
      material_type: (item.material_type as MaterialTypeCode) ?? 'OTHER',
      vehicle_model: item.vehicle_model ?? '',
      material: item.material ?? '',
      spec: item.spec ?? '',
      unit: item.unit ?? 'EA',
      thickness: toFormValue(item.thickness),
      width: toFormValue(item.width),
      height: toFormValue(item.height),
      specific_gravity: toFormValue(item.specific_gravity, '7.85'),
      mm_weight: toFormValue(item.mm_weight),
      daily_requirement: toFormValue(item.daily_requirement),
      blank_size: toFormValue(item.blank_size),
      current_stock: toFormValue(item.current_stock),
      safety_stock: toFormValue(item.safety_stock ?? (item as any)?.min_stock_level),
      price: toFormValue(item.price ?? (item as any)?.unit_price),
      location: item.location ?? '',
      description: item.description ?? '',
      coating_status: (item as any)?.coating_status ?? 'no_coating',
      press_process_type: (item as any)?.press_process_type ?? null
    };

    setFormData(initialValues);
    setMmWeightDirty(Boolean(item?.mm_weight));
  }, [item]);

  useEffect(() => {
    if (mmWeightDirty) return;
    const computed = computeMmWeight(
      parseNumber(formData.thickness),
      parseNumber(formData.width),
      parseNumber(formData.specific_gravity),
      formData.material_type,
      parseNumber(formData.height),
      parseNumber(formData.blank_size)
    );

    if (computed === null) {
      if (formData.mm_weight !== '') {
        setFormData(prev => ({ ...prev, mm_weight: '' }));
      }
      return;
    }

    const formatted = computed.toFixed(4);
    if (formatted !== formData.mm_weight) {
      setFormData(prev => ({ ...prev, mm_weight: formatted }));
    }
  }, [
    formData.thickness,
    formData.width,
    formData.height,
    formData.blank_size,
    formData.specific_gravity,
    formData.material_type,
    mmWeightDirty
  ]);

  const itemTypeOptions = useMemo(() => ITEM_TYPES, []);
  const materialTypeOptions = useMemo(() => MATERIAL_TYPES, []);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;

    // press_process_type 필드의 타입 안전성 보장
    let processedValue: string | null = value;
    if (name === 'press_process_type') {
      processedValue = value === '' ? null : (value === 'BLANKING' || value === 'STAMPING' ? value : null);
    }

    setFormData(prev => ({
      ...prev,
      [name]: name === 'press_process_type' ? processedValue : value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === 'mm_weight') {
      setMmWeightDirty(true);
    } else if (
      name === 'material_type' ||
      name === 'thickness' ||
      name === 'width' ||
      name === 'specific_gravity' ||
      name === 'height' ||
      name === 'blank_size'
    ) {
      setMmWeightDirty(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validation = validate(formData);
    setErrors(validation);

    if (Object.keys(validation).length > 0) {
      toast.입력오류('입력값을 확인해주세요.');
      return;
    }

    setLoading(true);
    try {
      const payload = buildSubmitPayload(formData);
      await onSubmit(payload);
      setMmWeightDirty(false);
      onCancel();
    } catch (error) {
      console.error('Failed to submit item form:', error);
      toast.error('품목 정보를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">기본 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="품목 코드"
            name="item_code"
            value={formData.item_code}
            onChange={handleInputChange}
            error={errors.item_code}
            placeholder="예: ITEM-001"
            required
          />
          <FormField
            label="품목명"
            name="item_name"
            value={formData.item_name}
            onChange={handleInputChange}
            error={errors.item_name}
            placeholder="예: 프레스 강판"
            required
          />
          <FormSelect
            label="품목 분류"
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            options={ITEM_CATEGORIES}
            placeholder="분류 선택"
            error={errors.category}
            required
          />
          <FormSelect
            label="품목 타입"
            name="item_type"
            value={formData.item_type}
            onChange={handleInputChange}
            options={itemTypeOptions}
          />
          <FormSelect
            label="소재 형태"
            name="material_type"
            value={formData.material_type}
            onChange={handleInputChange}
            options={materialTypeOptions}
          />
          <FormField
            label="차종"
            name="vehicle_model"
            value={formData.vehicle_model}
            onChange={handleInputChange}
            error={errors.vehicle_model}
            placeholder="예: EV6"
          />
          <FormField
            label="소재/강종"
            name="material"
            value={formData.material}
            onChange={handleInputChange}
            error={errors.material}
            placeholder="예: SPHC"
          />
          <FormField
            label="규격/사양"
            name="spec"
            value={formData.spec}
            onChange={handleInputChange}
            error={errors.spec}
            placeholder="예: 0.8T x 1200"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">치수 및 물성</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormNumber
            label="두께 (mm)"
            name="thickness"
            value={formData.thickness}
            onChange={handleInputChange}
            error={errors.thickness}
            min={0}
            step="0.01"
          />
          <FormNumber
            label="폭 (mm)"
            name="width"
            value={formData.width}
            onChange={handleInputChange}
            error={errors.width}
            min={0}
            step="0.01"
          />
          <FormNumber
            label="길이 (mm)"
            name="height"
            value={formData.height}
            onChange={handleInputChange}
            error={errors.height}
            min={0}
            step="0.01"
          />
          <FormNumber
            label="비중"
            name="specific_gravity"
            value={formData.specific_gravity}
            onChange={handleInputChange}
            error={errors.specific_gravity}
            min={0}
            step="0.01"
          />
          <FormNumber
            label="단위중량 (kg)"
            name="mm_weight"
            value={formData.mm_weight}
            onChange={handleInputChange}
            error={errors.mm_weight}
            min={0}
            step="0.0001"
            helperText="두께·폭·비중에 따라 자동 계산됩니다. 값을 직접 입력하면 수동 모드로 전환됩니다."
          />
          <FormNumber
            label="일일 소요량"
            name="daily_requirement"
            value={formData.daily_requirement}
            onChange={handleInputChange}
            error={errors.daily_requirement}
            min={0}
            step="1"
          />
          <FormNumber
            label="블랭크 사이즈"
            name="blank_size"
            value={formData.blank_size}
            onChange={handleInputChange}
            error={errors.blank_size}
            min={0}
            step="1"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">재고 및 단가</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormSelect
            label="단위"
            name="unit"
            value={formData.unit}
            onChange={handleInputChange}
            options={UNIT_OPTIONS.map(value => ({ value, label: value }))}
            error={errors.unit}
            required
          />
          <FormNumber
            label="현재고"
            name="current_stock"
            value={formData.current_stock}
            onChange={handleInputChange}
            error={errors.current_stock}
            min={0}
            step="1"
          />
          <FormNumber
            label="안전재고"
            name="safety_stock"
            value={formData.safety_stock}
            onChange={handleInputChange}
            error={errors.safety_stock}
            min={0}
            step="1"
          />
          <FormNumber
            label="기준단가"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            error={errors.price}
            min={0}
            step="0.01"
            prefix="₩"
          />
          <FormField
            label="보관 위치"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            error={errors.location}
            placeholder="예: A-01-01"
          />
          <FormSelect
            label="도장 상태"
            name="coating_status"
            value={formData.coating_status}
            onChange={handleInputChange}
            options={COATING_STATUS_OPTIONS}
          />
          <FormSelect
            label="프레스 공정 타입"
            name="press_process_type"
            value={formData.press_process_type ?? ''}
            onChange={handleInputChange}
            options={PRESS_PROCESS_TYPE_OPTIONS}
            placeholder="공정 선택 (선택사항)"
          />
          {/* Phase 3 - Inventory Classification */}
          <FormSelect
            label="재고 분류"
            name="inventory_type"
            value={formData.inventory_type ?? ''}
            onChange={handleInputChange}
            options={INVENTORY_TYPE_OPTIONS}
            error={errors.inventory_type}
            placeholder="분류 선택"
          />
          <FormField
            label="보관 구역"
            name="warehouse_zone"
            value={formData.warehouse_zone ?? ''}
            onChange={handleInputChange}
            error={errors.warehouse_zone}
            placeholder="예: A-01, B-03"
          />
          <FormSelect
            label="품질 상태"
            name="quality_status"
            value={formData.quality_status ?? ''}
            onChange={handleInputChange}
            options={QUALITY_STATUS_OPTIONS}
            error={errors.quality_status}
            placeholder="상태 선택"
          />
          <FormTextArea
            label="비고"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            error={errors.description}
            rows={3}
            placeholder="추가 메모를 입력하세요."
            className="md:col-span-3"
          />
        </div>
      </section>

      {/* 원가 관련 정보 섹션 */}
      <section className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
          원가 관련 정보
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FormNumber
            label="스크랩율 (%)"
            name="scrap_rate"
            value={formData.scrap_rate?.toString() ?? ''}
            onChange={handleInputChange}
            error={errors.scrap_rate}
            min={0}
            step="0.1"
            placeholder="0.0"
          />
          <FormNumber
            label="스크랩 단가 (원/kg)"
            name="scrap_unit_price"
            value={formData.scrap_unit_price?.toString() ?? ''}
            onChange={handleInputChange}
            error={errors.scrap_unit_price}
            min={0}
            step="1"
            prefix="₩"
            placeholder="0"
          />
          <FormNumber
            label="수율 (%)"
            name="yield_rate"
            value={formData.yield_rate?.toString() ?? ''}
            onChange={handleInputChange}
            error={errors.yield_rate}
            min={0}
            step="0.1"
            placeholder="100"
          />
          <FormNumber
            label="간접비율 (%)"
            name="overhead_rate"
            value={formData.overhead_rate?.toString() ?? ''}
            onChange={handleInputChange}
            error={errors.overhead_rate}
            min={0}
            step="0.1"
            placeholder="10"
          />
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>• 수율 기본값: 100% (수율이 낮을수록 더 많은 원자재가 필요합니다)</p>
          <p>• 간접비율 기본값: 10% (재료비 + 노무비의 10%로 계산됩니다)</p>
        </div>
      </section>

      <div className="flex justify-end gap-4 border-t border-gray-200 dark:border-gray-700 pt-6">
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
              저장 중...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {item ? '수정' : '등록'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function toFormValue(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return String(numeric);
  }
  return String(value);
}

function parseNumber(value: string): number | null {
  if (value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function computeMmWeight(
  thickness: number | null,
  width: number | null,
  density: number | null,
  materialType: MaterialTypeCode,
  height: number | null,
  blankSize: number | null
): number | null {
  if (thickness === null || width === null) {
    return null;
  }

  const safeDensity = density && density > 0 ? density : 7.85;
  if (safeDensity <= 0 || thickness <= 0 || width <= 0) {
    return null;
  }

  const thicknessCm = thickness / 10;
  const widthCm = width / 10;
  const rawLength = blankSize && blankSize > 0 ? blankSize : height && height > 0 ? height : null;
  const lengthCm = rawLength ? rawLength / 10 : 100; // 기본 1m 기준
  const volumeCm3 = thicknessCm * widthCm * lengthCm;
  const weightKg = (volumeCm3 * safeDensity) / 1000;
  return Number.isFinite(weightKg) ? weightKg : null;
}

function buildSubmitPayload(formData: ItemFormValues): Record<string, unknown> {
  return {
    item_id: formData.item_id,
    item_code: formData.item_code.trim(),
    item_name: formData.item_name.trim(),
    category: formData.category || null,
    unit: formData.unit.trim(),
    item_type: formData.item_type,
    material_type: formData.material_type,
    vehicle_model: formData.vehicle_model.trim() || null,
    material: formData.material.trim() || null,
    spec: formData.spec.trim() || null,
    thickness: parseNumber(formData.thickness),
    width: parseNumber(formData.width),
    height: parseNumber(formData.height),
    specific_gravity: parseNumber(formData.specific_gravity),
    mm_weight: parseNumber(formData.mm_weight),
    daily_requirement: parseNumber(formData.daily_requirement),
    blank_size: parseNumber(formData.blank_size),
    current_stock: parseNumber(formData.current_stock),
    safety_stock: parseNumber(formData.safety_stock),
    price: parseNumber(formData.price),
    location: formData.location.trim() || null,
    description: formData.description.trim() || null,
    coating_status: formData.coating_status,
    press_process_type: formData.press_process_type || null,
    inventory_type: formData.inventory_type || null,
    warehouse_zone: formData.warehouse_zone?.trim() || null,
    quality_status: formData.quality_status || null
  };
}

function validate(formData: ItemFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.item_code.trim()) {
    errors.item_code = '품목 코드를 입력해주세요.';
  }

  if (!formData.item_name.trim()) {
    errors.item_name = '품목명을 입력해주세요.';
  }

  if (!formData.category) {
    errors.category = '품목 분류를 선택해주세요.';
  }

  if (!formData.unit.trim()) {
    errors.unit = '단위를 입력해주세요.';
  }

  const numericFields: Array<{ name: keyof ItemFormValues; label: string; allowZero?: boolean }> = [
    { name: 'thickness', label: '두께' },
    { name: 'width', label: '폭' },
    { name: 'height', label: '길이' },
    { name: 'specific_gravity', label: '비중' },
    { name: 'mm_weight', label: '단위중량', allowZero: true },
    { name: 'daily_requirement', label: '일일 소요량', allowZero: true },
    { name: 'blank_size', label: '블랭크 사이즈', allowZero: true },
    { name: 'current_stock', label: '현재고', allowZero: true },
    { name: 'safety_stock', label: '안전재고', allowZero: true },
    { name: 'price', label: '기준단가', allowZero: true }
  ];

  numericFields.forEach(({ name, label, allowZero }) => {
    const value = formData[name];
    if (value === '') return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || (!allowZero && numeric <= 0) || (allowZero && numeric < 0)) {
      errors[name as string] = `${label} 값이 올바르지 않습니다.`;
    }
  });

  return errors;
}

type FormFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
};

function FormField({ label, name, value, onChange, error, placeholder, required }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

type FormNumberProps = FormFieldProps & {
  min?: number;
  step?: string;
  prefix?: string;
  helperText?: string;
};

function FormNumber({ label, name, value, onChange, error, placeholder, min, step, prefix, helperText }: FormNumberProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">{prefix}</span>
        )}
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          min={min}
          step={step}
          className={`w-full py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${prefix ? 'pl-8 pr-4' : 'px-4'}`}
        />
      </div>
      {helperText && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

type FormSelectProps = {
  label: string;
  name: string;
  value: string | ItemCategory | ItemTypeCode | MaterialTypeCode;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  required?: boolean;
};

function FormSelect({ label, name, value, onChange, options, placeholder, error, required }: FormSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={value ?? ''}
        onChange={onChange}
        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

type FormTextAreaProps = {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
};

function FormTextArea({ label, name, value, onChange, error, placeholder, rows = 4, className }: FormTextAreaProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="mt-1 text-sm text-gray-500">{error}</p>}
    </div>
  );
}
