'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useToastNotification } from '@/hooks/useToast';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface CoilSpecification {
  coil_spec_id?: number;
  item_id: number;
  material_grade: string;        // 재질등급
  specific_gravity: number;      // 비중
  length: number;                // 길이 (mm)
  width: number;                 // 폭 (mm)
  thickness: number;             // 두께 (mm)
  sep: number;                   // SEP (분할 수)
  weight_per_piece: number;      // EA중량 (kg/개) - GENERATED
  kg_unit_price?: number;        // KG단가 (won/kg)
  piece_unit_price?: number;     // 단품단가 (won/개) - GENERATED
}

interface CoilSpecsFormProps {
  itemId: number;
  initialSpecs?: CoilSpecification;
  onSave?: (specs: CoilSpecification) => Promise<void>;
  onCancel?: () => void;
  readOnly?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MATERIAL_GRADES = [
  'SPHC',   // Hot-rolled steel
  'SPCC',   // Cold-rolled steel
  'SECC',   // Electro-galvanized steel
  'SGCC',   // Hot-dip galvanized steel
  'SUS304', // Stainless steel
  'SUS430', // Ferritic stainless
  'AL1050', // Aluminum
  'C1100'   // Copper
] as const;

const DEFAULT_SPECIFIC_GRAVITY = 7.85; // Steel
const AUTO_SAVE_DELAY = 1000; // 1 second

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate weight per piece (EA중량)
 * Formula: (비중 × 길이 × 폭 × 두께) / 1,000,000 / SEP
 */
const calculateWeightPerPiece = (
  specificGravity: number,
  length: number,
  width: number,
  thickness: number,
  sep: number
): number => {
  if (sep === 0) return 0;
  return (specificGravity * length * width * thickness) / 1000000 / sep;
};

/**
 * Calculate piece unit price (단품단가)
 * Formula: KG단가 × EA중량
 */
const calculatePieceUnitPrice = (
  kgUnitPrice: number,
  weightPerPiece: number
): number => {
  return kgUnitPrice * weightPerPiece;
};

// ============================================================================
// Reusable Form Sub-Components
// ============================================================================

interface FormNumberProps {
  label: string;
  field: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
  step?: number;
  isInteger?: boolean;
}

const FormNumber: React.FC<FormNumberProps> = ({
  label,
  field,
  value,
  unit,
  onChange,
  error,
  disabled = false,
  step = 0.01,
  isInteger = false
}) => (
  <div className="form-group">
    <label htmlFor={field} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}
    </label>
    <div className="relative">
      <input
        type="number"
        id={field}
        value={value}
        onChange={(e) => {
          const newValue = isInteger
            ? parseInt(e.target.value) || 0
            : parseFloat(e.target.value) || 0;
          onChange(newValue);
        }}
        disabled={disabled}
        step={step}
        min={0}
        className={`
          w-full px-3 py-2 pr-16 rounded-md border
          ${error ? 'border-gray-500' : 'border-gray-300 dark:border-gray-600'}
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
        `}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
        {unit}
      </span>
    </div>
    {error && (
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{error}</p>
    )}
  </div>
);

interface FormSelectProps {
  label: string;
  field: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

const FormSelect: React.FC<FormSelectProps> = ({
  label,
  field,
  value,
  options,
  onChange,
  error,
  disabled = false
}) => (
  <div className="form-group">
    <label htmlFor={field} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}
    </label>
    <select
      id={field}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`
        w-full px-3 py-2 rounded-md border
        ${error ? 'border-gray-500' : 'border-gray-300 dark:border-gray-600'}
        bg-white dark:bg-gray-800
        text-gray-900 dark:text-gray-100
        focus:ring-2 focus:ring-blue-500 focus:border-transparent
        disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
      `}
    >
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
    {error && (
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{error}</p>
    )}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export default function CoilSpecsForm({
  itemId,
  initialSpecs,
  onSave,
  onCancel,
  readOnly = false
}: CoilSpecsFormProps) {
  // --------------------------------------------------------------------------
  // State Management (lines 1-100)
  // --------------------------------------------------------------------------

  const [formData, setFormData] = useState<CoilSpecification>({
    item_id: itemId,
    material_grade: initialSpecs?.material_grade || 'SPHC',
    specific_gravity: initialSpecs?.specific_gravity || DEFAULT_SPECIFIC_GRAVITY,
    length: initialSpecs?.length || 0,
    width: initialSpecs?.width || 0,
    thickness: initialSpecs?.thickness || 0,
    sep: initialSpecs?.sep || 1,
    weight_per_piece: initialSpecs?.weight_per_piece || 0,
    kg_unit_price: initialSpecs?.kg_unit_price || 0,
    piece_unit_price: initialSpecs?.piece_unit_price || 0,
    ...(initialSpecs?.coil_spec_id && { coil_spec_id: initialSpecs.coil_spec_id })
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const debouncedSave = useRef<NodeJS.Timeout | null>(null);
  const toast = useToastNotification();

  // --------------------------------------------------------------------------
  // Form Field Change Handler
  // --------------------------------------------------------------------------

  const handleChange = (field: keyof CoilSpecification, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // --------------------------------------------------------------------------
  // Real-time Calculation Effect (lines 101-150)
  // --------------------------------------------------------------------------

  useEffect(() => {
    // Calculate EA중량
    const weightPerPiece = calculateWeightPerPiece(
      formData.specific_gravity,
      formData.length,
      formData.width,
      formData.thickness,
      formData.sep
    );

    // Calculate 단품단가
    const pieceUnitPrice = calculatePieceUnitPrice(
      formData.kg_unit_price || 0,
      weightPerPiece
    );

    setFormData(prev => ({
      ...prev,
      weight_per_piece: weightPerPiece,
      piece_unit_price: pieceUnitPrice
    }));
  }, [
    formData.specific_gravity,
    formData.length,
    formData.width,
    formData.thickness,
    formData.sep,
    formData.kg_unit_price
  ]);

  // --------------------------------------------------------------------------
  // Validation (lines 151-200)
  // --------------------------------------------------------------------------

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.material_grade || formData.material_grade.trim() === '') {
      newErrors.material_grade = '재질등급을 입력해주세요';
    }

    if (formData.specific_gravity <= 0) {
      newErrors.specific_gravity = '비중은 0보다 커야 합니다';
    }

    if (formData.length <= 0) {
      newErrors.length = '길이는 0보다 커야 합니다';
    }

    if (formData.width <= 0) {
      newErrors.width = '폭은 0보다 커야 합니다';
    }

    if (formData.thickness <= 0) {
      newErrors.thickness = '두께는 0보다 커야 합니다';
    }

    if (formData.sep <= 0 || !Number.isInteger(formData.sep)) {
      newErrors.sep = 'SEP는 양의 정수여야 합니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --------------------------------------------------------------------------
  // Auto-save with Debounce (lines 201-250)
  // --------------------------------------------------------------------------

  useEffect(() => {
    // Skip auto-save if:
    // - Form is invalid
    // - No changes made
    // - It's a new record (no coil_spec_id)
    // - Read-only mode
    if (!validateForm() || !hasChanges || !formData.coil_spec_id || readOnly) {
      return;
    }

    // Clear previous timer
    if (debouncedSave.current) {
      clearTimeout(debouncedSave.current);
    }

    // Set new timer
    debouncedSave.current = setTimeout(() => {
      handleSave(true); // true = silent save (no toast)
    }, AUTO_SAVE_DELAY);

    return () => {
      if (debouncedSave.current) {
        clearTimeout(debouncedSave.current);
      }
    };
  }, [formData, hasChanges, readOnly]);

  // --------------------------------------------------------------------------
  // Save Handler (lines 251-300)
  // --------------------------------------------------------------------------

  const handleSave = async (silent: boolean = false) => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      if (onSave) {
        await onSave(formData);
      } else {
        // Default API call
        const url = formData.coil_spec_id
          ? `/api/coil-specs/${formData.coil_spec_id}`
          : '/api/coil-specs';

        const method = formData.coil_spec_id ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (!result.success) {
          const { extractErrorMessage } = await import('@/lib/fetch-utils');
          throw new Error(extractErrorMessage(result.error) || '저장에 실패했습니다');
        }

        // Update coil_spec_id if this was a create operation
        if (!formData.coil_spec_id && result.data?.coil_spec_id) {
          setFormData(prev => ({
            ...prev,
            coil_spec_id: result.data.coil_spec_id
          }));
        }

        if (!silent) {
          toast.success('저장 완료', '코일 규격이 저장되었습니다');
        }
      }

      setHasChanges(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '저장 실패';
      toast.error('저장 실패', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Manual Save Handler (button click)
  // --------------------------------------------------------------------------

  const handleManualSave = () => {
    handleSave(false); // false = show toast notification
  };

  // --------------------------------------------------------------------------
  // Render Functions
  // --------------------------------------------------------------------------

  // Calculated Fields Display (lines 401-450)
  const renderCalculatedFields = () => (
    <div className="calculated-section mt-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        계산 결과
      </h3>

      <div className="space-y-3">
        {/* EA Weight (Calculated) */}
        <div className="calculated-field flex items-center justify-between p-3 rounded bg-white dark:bg-gray-800 shadow-sm">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            EA중량:
          </label>
          <span className="text-lg font-bold text-gray-600 dark:text-gray-400">
            {formData.weight_per_piece.toFixed(3)} kg/개
          </span>
        </div>

        {/* KG Unit Price Input */}
        <div className="form-group">
          <label htmlFor="kg_unit_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            KG단가
          </label>
          <div className="relative">
            <input
              type="number"
              id="kg_unit_price"
              value={formData.kg_unit_price || 0}
              onChange={(e) => handleChange('kg_unit_price', parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              step={100}
              min={0}
              className={`
                w-full px-3 py-2 pr-20 rounded-md border
                border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-gray-100
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
              `}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
              won/kg
            </span>
          </div>
        </div>

        {/* Piece Unit Price (Calculated) */}
        {(formData.kg_unit_price || 0) > 0 && (
          <div className="calculated-field flex items-center justify-between p-3 rounded bg-white dark:bg-gray-800 shadow-sm">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              단품단가:
            </label>
            <span className="text-lg font-bold text-gray-600 dark:text-gray-400">
              ₩{Math.round(formData.piece_unit_price || 0).toLocaleString('ko-KR')}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // Main Render
  // --------------------------------------------------------------------------

  return (
    <div className="coil-specs-form bg-white dark:bg-gray-900 rounded-lg shadow-md">
      {/* Header */}
      <div className="form-header flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          코일 규격 입력
        </h2>
        <div className="flex gap-2">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={handleManualSave}
                disabled={saving || Object.keys(errors).length > 0}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium
                  ${saving || Object.keys(errors).length > 0
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }
                  transition-colors duration-200
                `}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={saving}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  취소
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Form Body */}
      <div className="form-body p-4">
        {/* Input Fields Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Material Grade */}
          <FormSelect
            label="재질등급"
            field="material_grade"
            value={formData.material_grade}
            options={MATERIAL_GRADES}
            onChange={(value) => handleChange('material_grade', value)}
            error={errors.material_grade}
            disabled={readOnly}
          />

          {/* Specific Gravity */}
          <FormNumber
            label="비중"
            field="specific_gravity"
            value={formData.specific_gravity}
            unit="kg/dm³"
            onChange={(value) => handleChange('specific_gravity', value)}
            error={errors.specific_gravity}
            disabled={readOnly}
            step={0.01}
          />

          {/* Length */}
          <FormNumber
            label="길이"
            field="length"
            value={formData.length}
            unit="mm"
            onChange={(value) => handleChange('length', value)}
            error={errors.length}
            disabled={readOnly}
            step={0.1}
          />

          {/* Width */}
          <FormNumber
            label="폭"
            field="width"
            value={formData.width}
            unit="mm"
            onChange={(value) => handleChange('width', value)}
            error={errors.width}
            disabled={readOnly}
            step={0.1}
          />

          {/* Thickness */}
          <FormNumber
            label="두께"
            field="thickness"
            value={formData.thickness}
            unit="mm"
            onChange={(value) => handleChange('thickness', value)}
            error={errors.thickness}
            disabled={readOnly}
            step={0.01}
          />

          {/* SEP */}
          <FormNumber
            label="SEP"
            field="sep"
            value={formData.sep}
            unit=""
            onChange={(value) => handleChange('sep', value)}
            error={errors.sep}
            disabled={readOnly}
            step={1}
            isInteger={true}
          />
        </div>

        {/* Calculated Results */}
        {renderCalculatedFields()}

        {/* Auto-save Indicator */}
        {!readOnly && hasChanges && !saving && (
          <div className="mt-4 p-2 text-sm text-gray-600 dark:text-gray-400 text-center">
            변경사항은 자동으로 저장됩니다 (1초 후)
          </div>
        )}

        {/* Save Indicator */}
        {!readOnly && saving && (
          <div className="mt-4 p-2 text-sm text-gray-600 dark:text-gray-400 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            저장 중...
          </div>
        )}
      </div>
    </div>
  );
}
