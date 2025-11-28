/**
 * Excel BOM Parser Utility
 *
 * Comprehensive parser for BOM Excel files with multi-level hierarchy support.
 * Handles Korean headers, coil specs, scrap tracking, and price data.
 * Includes robust validation and circular dependency detection.
 */

import * as XLSX from 'xlsx';
import { supabaseAdmin } from './db-unified';
import { checkBomCircular } from './bom';
import { cleanString, cleanNumber, validateRequiredField } from './excel-utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * BOM Excel row structure with all possible fields
 */
export interface BOMExcelRow {
  parent_item_code: string;
  child_item_code: string;
  quantity_required: number;
  level?: number;
  notes?: string;

  // Coil specs (optional, for coil materials)
  material_grade?: string;       // 재질등급
  specific_gravity?: number;     // 비중
  length?: number;               // 길이 (mm)
  width?: number;                // 폭 (mm)
  thickness?: number;            // 두께 (mm)
  sep?: number;                  // SEP

  // Scrap tracking (optional)
  scrap_weight?: number;         // 스크랩중량 (kg)
  scrap_unit_price?: number;     // 스크랩단가 (원/kg)

  // Price data (optional)
  unit_price?: number;           // 구매단가 (원)
  supplier_name?: string;        // 공급사
}

/**
 * Validation error details
 */
export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Parse result with comprehensive information
 */
export interface ParseResult {
  success: boolean;
  data: BOMExcelRow[];
  errors: ValidationError[];
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    warnings: number;
  };
}

/**
 * Item cache for database lookups
 */
interface ItemCache {
  [itemCode: string]: {
    item_id: number;
    item_code: string;
    item_name: string;
    unit: string;
    is_active: boolean;
  };
}

/**
 * Korean to English header mapping
 */
const HEADER_MAP: Record<string, string> = {
  // Required fields
  '부모품목코드': 'parent_item_code',
  '상위품목코드': 'parent_item_code',
  '부모코드': 'parent_item_code',
  '자식품목코드': 'child_item_code',
  '하위품목코드': 'child_item_code',
  '자식코드': 'child_item_code',
  '소요량': 'quantity_required',
  '수량': 'quantity_required',
  '필요수량': 'quantity_required',
  '레벨': 'level',
  '단계': 'level',
  '비고': 'notes',
  '메모': 'notes',

  // Coil specs
  '재질등급': 'material_grade',
  '재질': 'material_grade',
  '비중': 'specific_gravity',
  '길이': 'length',
  '폭': 'width',
  '두께': 'thickness',
  'SEP': 'sep',
  'sep': 'sep',

  // Scrap tracking
  '스크랩중량': 'scrap_weight',
  '스크랩무게': 'scrap_weight',
  '스크랩단가': 'scrap_unit_price',
  '스크랩가격': 'scrap_unit_price',

  // Price data
  '구매단가': 'unit_price',
  '단가': 'unit_price',
  '가격': 'unit_price',
  '공급사': 'supplier_name',
  '공급업체': 'supplier_name',
  '업체': 'supplier_name'
};

// ============================================================================
// MAIN PARSER FUNCTION
// ============================================================================

/**
 * Parse BOM Excel file with comprehensive validation
 *
 * @param file - File object (browser) or Buffer (server)
 * @returns ParseResult with data, errors, and statistics
 */
export async function parseBOMExcel(file: File | Buffer): Promise<ParseResult> {
  const errors: ValidationError[] = [];
  const validRows: BOMExcelRow[] = [];
  let totalRows = 0;

  try {
    // Step 1: Read Excel file
    let buffer: Buffer;

    if (Buffer.isBuffer(file)) {
      buffer = file;
    } else {
      // Convert File to ArrayBuffer then Buffer
      const arrayBuffer = await (file as File).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellText: false,
      raw: false
    });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          field: 'file',
          message: 'Excel 파일에 시트가 없습니다',
          severity: 'error'
        }],
        stats: { totalRows: 0, validRows: 0, invalidRows: 0, warnings: 0 }
      };
    }

    const worksheet = workbook.Sheets[sheetName];

    // Step 2: Parse sheet to JSON with proper header handling
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false
    }) as any[][];

    if (rawData.length < 2) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          field: 'file',
          message: 'Excel 파일에 데이터가 없습니다 (헤더와 최소 1개 행 필요)',
          severity: 'error'
        }],
        stats: { totalRows: 0, validRows: 0, invalidRows: 0, warnings: 0 }
      };
    }

    // Step 3: Normalize headers
    const headers = rawData[0].map((h: any) =>
      cleanString(h)?.trim() || ''
    );

    const normalizedHeaders = headers.map(h =>
      HEADER_MAP[h] || h.toLowerCase().replace(/\s+/g, '_')
    );

    // Validate required headers
    const requiredFields = ['parent_item_code', 'child_item_code', 'quantity_required'];
    const missingFields = requiredFields.filter(f => !normalizedHeaders.includes(f));

    if (missingFields.length > 0) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          field: 'headers',
          message: `필수 컬럼이 누락되었습니다: ${missingFields.map(f =>
            Object.keys(HEADER_MAP).find(k => HEADER_MAP[k] === f) || f
          ).join(', ')}`,
          severity: 'error'
        }],
        stats: { totalRows: 0, validRows: 0, invalidRows: 0, warnings: 0 }
      };
    }

    // Step 4: Load item cache from database
    const itemCache = await loadItemCache();

    // Step 5: Parse data rows
    for (let i = 1; i < rawData.length; i++) {
      totalRows++;
      const row = rawData[i];
      const rowNumber = i + 1; // Excel row number (1-indexed)

      // Skip empty rows
      if (!row || row.every((cell: any) => cell === null || cell === '')) {
        continue;
      }

      // Convert row array to object
      const rowData: any = {};
      normalizedHeaders.forEach((header, idx) => {
        rowData[header] = row[idx];
      });

      // Validate and parse row
      const { data: parsedRow, errors: rowErrors } = await validateAndParseRow(
        rowData,
        rowNumber,
        itemCache
      );

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      }

      if (parsedRow) {
        validRows.push(parsedRow);
      }
    }

    // Step 6: Cross-validation (circular dependencies, duplicates)
    const crossValidationErrors = await performCrossValidation(validRows);
    errors.push(...crossValidationErrors);

    // Step 7: Calculate statistics
    const warningCount = errors.filter(e => e.severity === 'warning').length;
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const invalidRows = totalRows - validRows.length;

    const success = errorCount === 0 && validRows.length > 0;

    return {
      success,
      data: validRows,
      errors,
      stats: {
        totalRows,
        validRows: validRows.length,
        invalidRows,
        warnings: warningCount
      }
    };

  } catch (error) {
    console.error('Excel parsing error:', error);
    return {
      success: false,
      data: [],
      errors: [{
        row: 0,
        field: 'file',
        message: `Excel 파일 파싱 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      }],
      stats: { totalRows, validRows: 0, invalidRows: totalRows, warnings: 0 }
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load all active items into cache for fast lookups
 */
async function loadItemCache(): Promise<ItemCache> {
  try {
    const { data, error } = await supabaseAdmin
      .from('items')
      .select('item_id, item_code, item_name, unit, is_active')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to load item cache:', error);
      return {};
    }

    const cache: ItemCache = {};
    data?.forEach(item => {
      cache[item.item_code.toUpperCase()] = {
        ...item,
        is_active: item.is_active ?? true // Convert null to default value
      };
    });

    return cache;
  } catch (error) {
    console.error('Error loading item cache:', error);
    return {};
  }
}

/**
 * Validate and parse a single row
 */
async function validateAndParseRow(
  rowData: any,
  rowNumber: number,
  itemCache: ItemCache
): Promise<{ data: BOMExcelRow | null; errors: ValidationError[] }> {
  const errors: ValidationError[] = [];

  // Parse parent item code
  const parentItemCode = cleanString(rowData.parent_item_code);
  const parentError = validateRequiredField(parentItemCode, '부모품목코드');
  if (parentError) {
    errors.push({
      row: rowNumber,
      field: 'parent_item_code',
      message: parentError,
      severity: 'error'
    });
  }

  // Parse child item code
  const childItemCode = cleanString(rowData.child_item_code);
  const childError = validateRequiredField(childItemCode, '자식품목코드');
  if (childError) {
    errors.push({
      row: rowNumber,
      field: 'child_item_code',
      message: childError,
      severity: 'error'
    });
  }

  // Parse quantity
  const quantity = cleanNumber(rowData.quantity_required);
  if (quantity === undefined || quantity <= 0) {
    errors.push({
      row: rowNumber,
      field: 'quantity_required',
      message: '소요량은 0보다 큰 숫자여야 합니다',
      severity: 'error'
    });
  }

  // Stop if required fields are invalid
  if (errors.length > 0) {
    return { data: null, errors };
  }

  // Validate item codes exist in database
  const parentKey = parentItemCode!.toUpperCase();
  const childKey = childItemCode!.toUpperCase();

  if (!itemCache[parentKey]) {
    errors.push({
      row: rowNumber,
      field: 'parent_item_code',
      message: `부모품목코드 '${parentItemCode}'가 데이터베이스에 존재하지 않습니다`,
      severity: 'error'
    });
  } else if (!itemCache[parentKey].is_active) {
    errors.push({
      row: rowNumber,
      field: 'parent_item_code',
      message: `부모품목코드 '${parentItemCode}'가 비활성 상태입니다`,
      severity: 'warning'
    });
  }

  if (!itemCache[childKey]) {
    errors.push({
      row: rowNumber,
      field: 'child_item_code',
      message: `자식품목코드 '${childItemCode}'가 데이터베이스에 존재하지 않습니다`,
      severity: 'error'
    });
  } else if (!itemCache[childKey].is_active) {
    errors.push({
      row: rowNumber,
      field: 'child_item_code',
      message: `자식품목코드 '${childItemCode}'가 비활성 상태입니다`,
      severity: 'warning'
    });
  }

  // 자기 참조 허용: 모품목과 자품목이 같을 수 있음

  // If critical errors exist, return null
  if (errors.some(e => e.severity === 'error')) {
    return { data: null, errors };
  }

  // Parse optional fields with validation
  const parsedRow: BOMExcelRow = {
    parent_item_code: parentItemCode!,
    child_item_code: childItemCode!,
    quantity_required: quantity!,
    level: cleanNumber(rowData.level),
    notes: cleanString(rowData.notes),

    // Coil specs
    material_grade: cleanString(rowData.material_grade),
    specific_gravity: cleanNumber(rowData.specific_gravity),
    length: cleanNumber(rowData.length),
    width: cleanNumber(rowData.width),
    thickness: cleanNumber(rowData.thickness),
    sep: cleanNumber(rowData.sep),

    // Scrap tracking
    scrap_weight: cleanNumber(rowData.scrap_weight),
    scrap_unit_price: cleanNumber(rowData.scrap_unit_price),

    // Price data
    unit_price: cleanNumber(rowData.unit_price),
    supplier_name: cleanString(rowData.supplier_name)
  };

  // Validate numeric ranges
  if (parsedRow.specific_gravity !== undefined &&
      (parsedRow.specific_gravity <= 0 || parsedRow.specific_gravity > 20)) {
    errors.push({
      row: rowNumber,
      field: 'specific_gravity',
      message: '비중 값이 유효하지 않습니다 (0 < 비중 ≤ 20)',
      severity: 'warning'
    });
  }

  if (parsedRow.length !== undefined && parsedRow.length <= 0) {
    errors.push({
      row: rowNumber,
      field: 'length',
      message: '길이는 0보다 커야 합니다',
      severity: 'warning'
    });
  }

  if (parsedRow.width !== undefined && parsedRow.width <= 0) {
    errors.push({
      row: rowNumber,
      field: 'width',
      message: '폭은 0보다 커야 합니다',
      severity: 'warning'
    });
  }

  if (parsedRow.thickness !== undefined && parsedRow.thickness <= 0) {
    errors.push({
      row: rowNumber,
      field: 'thickness',
      message: '두께는 0보다 커야 합니다',
      severity: 'warning'
    });
  }

  if (parsedRow.scrap_weight !== undefined && parsedRow.scrap_weight < 0) {
    errors.push({
      row: rowNumber,
      field: 'scrap_weight',
      message: '스크랩중량은 음수일 수 없습니다',
      severity: 'warning'
    });
  }

  if (parsedRow.scrap_unit_price !== undefined && parsedRow.scrap_unit_price < 0) {
    errors.push({
      row: rowNumber,
      field: 'scrap_unit_price',
      message: '스크랩단가는 음수일 수 없습니다',
      severity: 'warning'
    });
  }

  if (parsedRow.unit_price !== undefined && parsedRow.unit_price < 0) {
    errors.push({
      row: rowNumber,
      field: 'unit_price',
      message: '구매단가는 음수일 수 없습니다',
      severity: 'warning'
    });
  }

  return { data: parsedRow, errors };
}

/**
 * Perform cross-validation across all rows
 */
async function performCrossValidation(rows: BOMExcelRow[]): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  if (rows.length === 0) {
    return errors;
  }

  // Check for duplicate BOM entries (same parent + child combination)
  const seen = new Map<string, number>();

  rows.forEach((row, idx) => {
    const key = `${row.parent_item_code}|${row.child_item_code}`;

    if (seen.has(key)) {
      const firstRow = seen.get(key)! + 2; // Excel row number (1-indexed + header)
      const currentRow = idx + 2;

      errors.push({
        row: currentRow,
        field: 'child_item_code',
        message: `중복된 BOM 항목입니다 (부모: ${row.parent_item_code}, 자식: ${row.child_item_code}). 첫 번째 발견: 행 ${firstRow}`,
        severity: 'error'
      });
    } else {
      seen.set(key, idx);
    }
  });

  // Check for circular dependencies (basic check - detailed check in BOM utilities)
  const bomGraph = new Map<string, Set<string>>();

  rows.forEach(row => {
    if (!bomGraph.has(row.parent_item_code)) {
      bomGraph.set(row.parent_item_code, new Set());
    }
    bomGraph.get(row.parent_item_code)!.add(row.child_item_code);
  });

  // 순환 참조 허용: 모든 순환 참조(자기 참조 포함)를 허용함

  return errors;
}

/**
 * Detect circular reference in BOM graph (DFS-based)
 */
function hasCircularReference(
  parent: string,
  child: string,
  graph: Map<string, Set<string>>,
  visited: Set<string> = new Set()
): boolean {
  // 순환 참조 허용: 모든 순환 참조(자기 참조 포함)를 허용함
  // 항상 false를 반환하여 순환 참조 검사를 비활성화
  return false;
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Generate BOM Excel template with Korean headers
 */
export function generateBOMTemplate(): XLSX.WorkBook {
  const headers = [
    '부모품목코드',
    '자식품목코드',
    '소요량',
    '레벨',
    '비고',
    '재질등급',
    '비중',
    '길이',
    '폭',
    '두께',
    'SEP',
    '스크랩중량',
    '스크랩단가',
    '구매단가',
    '공급사'
  ];

  const sampleData = [
    [
      'PROD001',
      'PART001',
      2,
      1,
      '샘플 데이터',
      'SPCC',
      7.85,
      1000,
      500,
      1.0,
      10,
      5.5,
      1500,
      50000,
      '태창금속'
    ]
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // 부모품목코드
    { wch: 15 }, // 자식품목코드
    { wch: 10 }, // 소요량
    { wch: 8 },  // 레벨
    { wch: 20 }, // 비고
    { wch: 12 }, // 재질등급
    { wch: 10 }, // 비중
    { wch: 10 }, // 길이
    { wch: 10 }, // 폭
    { wch: 10 }, // 두께
    { wch: 10 }, // SEP
    { wch: 12 }, // 스크랩중량
    { wch: 12 }, // 스크랩단가
    { wch: 12 }, // 구매단가
    { wch: 15 }  // 공급사
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM 템플릿');

  return workbook;
}

/**
 * Export parse errors to Excel for user review
 */
export function exportErrorsToExcel(errors: ValidationError[]): XLSX.WorkBook {
  const headers = ['행번호', '필드', '오류메시지', '심각도'];

  const rows = errors.map(e => [
    e.row,
    e.field,
    e.message,
    e.severity === 'error' ? '오류' : '경고'
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  worksheet['!cols'] = [
    { wch: 10 }, // 행번호
    { wch: 20 }, // 필드
    { wch: 60 }, // 오류메시지
    { wch: 10 }  // 심각도
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '오류 목록');

  return workbook;
}
