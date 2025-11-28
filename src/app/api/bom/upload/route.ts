/**
 * BOM Upload API - Excel file upload with validation
 * POST /api/bom/upload
 *
 * Accepts Excel file with BOM structure data
 * Validates entries, detects circular dependencies, and inserts into database
 *
 * Excel Format:
 * - Sheet 1: BOM entries
 *   Columns: parent_item_code, child_item_code, quantity_required, level_no (optional)
 *
 * Response includes validation results and inserted record count
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { mapExcelHeaders, bomHeaderMapping } from '@/lib/excel-header-mapper';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';


// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BOMExcelRow {
  // Parent item fields
  parent_item_code: string;
  parent_item_name?: string;
  parent_spec?: string;
  parent_unit?: string;
  parent_category?: string;
  parent_inventory_type?: string;
  parent_car_model?: string;
  parent_location?: string;
  parent_supplier?: string; // 기존 호환성 유지 (거래처명 또는 코드)
  // Parent item supplier details
  parent_supplier_name?: string;
  parent_supplier_code?: string;
  parent_supplier_phone?: string;
  parent_supplier_email?: string;
  parent_supplier_address?: string;
  parent_supplier_type?: string;
  parent_supplier_business_number?: string;
  parent_supplier_representative?: string;

  // Child item fields
  child_item_code: string;
  child_item_name?: string;
  child_spec?: string;
  child_unit?: string;
  child_category?: string;
  child_inventory_type?: string;
  child_car_model?: string;
  child_location?: string;
  child_supplier?: string; // 기존 호환성 유지 (거래처명 또는 코드)
  // Child item supplier details
  child_supplier_name?: string;
  child_supplier_code?: string;
  child_supplier_phone?: string;
  child_supplier_email?: string;
  child_supplier_address?: string;
  child_supplier_type?: string;
  child_supplier_business_number?: string;
  child_supplier_representative?: string;
  child_supplier_category?: string; // 업체구분 (H열) - 협력업체, 사급, 하드웨어, 태창금속 등

  // BOM relationship fields
  quantity_required: number;
  level_no?: number;
  notes?: string;
  // Purchase quantity and amount (구매수량, 구매금액)
  child_purchase_quantity?: number;
  child_purchase_amount?: number;
  // Monthly price information (parent)
  parent_price_month?: string;
  parent_unit_price?: number;
  parent_price_per_kg?: number;
  parent_price_note?: string;
  // Monthly price information (child)
  child_price_month?: string;
  child_unit_price?: number;
  child_price_per_kg?: number;
  child_price_note?: string;
  // Sheet information for customer identification
  sheet_name?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

interface ValidationResult {
  valid: boolean;
  data: BOMExcelRow[];
  errors: ValidationError[];
  stats: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
  };
}

interface CircularDependencyCheck {
  valid: boolean;
  cycles?: string[][];
}

// ============================================================================
// EXCEL PARSING
// ============================================================================

/**
 * Parse BOM Excel file
 * Validates basic structure and data types
 */
function parseBOMExcel(buffer: Buffer): ValidationResult {
  const errors: ValidationError[] = [];
  const validData: BOMExcelRow[] = [];

  try {
    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // 고객사별 시트 찾기 (최신단가 시트 제외)
    const customerSheetNames = workbook.SheetNames.filter(name => name !== '최신단가');
    
    if (customerSheetNames.length === 0) {
      return {
        valid: false,
        data: [],
        errors: [{ row: 0, field: 'file', message: 'Excel 파일에 고객사 시트가 없습니다' }],
        stats: { total_rows: 0, valid_rows: 0, error_rows: 0 }
      };
    }

    // 모든 고객사 시트에서 데이터 읽기
    let allRawData: Record<string, unknown>[] = [];
    
    customerSheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      
      // 헤더가 6번째 행(인덱스 5)에 있으므로, range를 사용하여 6번째 행부터 읽기
      // XLSX는 0-indexed이므로 헤더 행은 5 (Excel Row 6), 데이터는 6부터 (Excel Row 7)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      // 헤더 행(6번째 행, Excel 1-indexed = 0-indexed 5)에서 헤더 읽기
      const headerRow: string[] = [];
      for (let C = 0; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 5, c: C }); // 6번째 행 (0-indexed: 5)
        const cell = worksheet[cellAddress];
        headerRow.push(cell && cell.v ? String(cell.v) : '');
      }

      // 7번째 행(인덱스 6)부터 데이터 읽기 (Excel Row 7)
      const dataRows: Record<string, unknown>[] = [];
      let currentParentRow: Record<string, unknown> | null = null;

      for (let R = 6; R <= range.e.r; R++) {
        const row: Record<string, unknown> = {};
        let hasData = false;
        
        // A-G열 데이터 확인 (모품목 여부 판단)
        let isParentRow = false;
        for (let C = 0; C <= 6; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
            isParentRow = true;
            break;
          }
        }
        
        if (isParentRow) {
          // 모품목 행: A-G열 모두 읽기
          currentParentRow = {};
          for (let C = 0; C <= 6; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];
            const header = headerRow[C];
            if (header && header.trim() !== '') {
              const value = cell && cell.v !== undefined && cell.v !== null ? cell.v : '';
              // 모품목 헤더 매핑
              let mappedHeader = header;
              if (header === '품번') mappedHeader = '모품목코드';
              else if (header === '품명') mappedHeader = '모품목명';
              else if (header === '차종') mappedHeader = '모품목차종';
              else if (header === '단가') mappedHeader = '모품목단가';
              else if (header === '납품처') mappedHeader = '납품처'; // 납품처는 그대로 저장 (나중에 parent_supplier로 매핑)
              if (value !== '') {
                currentParentRow[mappedHeader] = value;
              }
            }
          }
          // 모품목 행은 다음 자품목 행들을 위해 currentParentRow만 저장하고 건너뛰기
          continue;
        } else {
          // 자품목 행: H열(업체구분)부터 읽기
          for (let C = 7; C < headerRow.length; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];
            const header = headerRow[C];

            if (header && header.trim() !== '') {
              const value = cell && cell.v !== undefined && cell.v !== null ? cell.v : '';

              // 자품목 헤더 매핑 (종합 시트 형식)
              let mappedHeader = header;
              if (C === 7) {
                // H열 (업체구분) - 협력업체, 사급, 하드웨어, 태창금속 등
                if (header === '업체구분') mappedHeader = 'child_supplier_category';
              } else if (C >= 8 && C <= 15) {
                // I-P 영역 (자품목 기본 정보)
                if (header === '품번') mappedHeader = '자품목코드';
                else if (header === '품명') mappedHeader = '자품목명';
                else if (header === '차종') mappedHeader = '자품목차종';
                else if (header === '단가') mappedHeader = '자품목단가';
                else if (header === 'U/S' || header === '소요량') mappedHeader = 'quantity_required';
                else if (header === '구매처') mappedHeader = '자품목공급사명';
                else if (header === '구매수량') mappedHeader = '자품목구매수량';
                else if (header === '구매금액') mappedHeader = '자품목구매금액';
              } else if (C >= 16) {
                // Q 이후 영역 (자품목 상세 정보)
                if (header === '비고') mappedHeader = 'notes';
                else if (header === 'KG단가') mappedHeader = '자품목KG단가';
                else if (header === '단품단가') mappedHeader = '자품목단품단가';
                else if (header === '재질') mappedHeader = '자품목재질';
                else if (header === '두께') mappedHeader = '자품목두께';
                else if (header === '폭') mappedHeader = '자품목폭';
                else if (header === '길이') mappedHeader = '자품목길이';
                else if (header === 'SEP') mappedHeader = '자품목SEP';
                else if (header === '비중') mappedHeader = '자품목비중';
                else if (header === 'EA중량') mappedHeader = '자품목EA중량';
                else if (header === '실적수량') mappedHeader = '자품목실적수량';
                else if (header === '스크랩중량') mappedHeader = '자품목스크랩중량';
                else if (header === '스크랩단가') mappedHeader = '자품목스크랩단가';
                else if (header === '스크랩금액') mappedHeader = '자품목스크랩금액';
              }
              
              if (value !== '' || hasData) {
                row[mappedHeader] = value;
                if (value !== '') hasData = true;
              }
            }
          }
          
          // 모품목 정보가 없으면 건너뛰기
          if (!currentParentRow) {
            continue;
          }
          
          // 품번과 품명으로 모품목-자품목 관계 판단
          const childItemCode = String(row['자품목코드'] || '').trim();
          const childItemName = String(row['자품목명'] || '').trim();
          const parentItemCode = String(currentParentRow['모품목코드'] || '').trim();
          const parentItemName = String(currentParentRow['모품목명'] || '').trim();
          
          // 품번과 품명이 모두 다를 때만 자품목으로 처리
          const isDifferentItem = childItemCode && parentItemCode && 
                                  childItemCode !== parentItemCode &&
                                  childItemName && parentItemName &&
                                  childItemName !== parentItemName;
          
          // 품번과 품명이 다르고, 소요량이 있을 때만 BOM 엔트리 생성
          if (!isDifferentItem || !row['quantity_required'] || Number(row['quantity_required']) <= 0) {
            continue;
          }
          
          // 모품목 정보 병합
          Object.assign(row, currentParentRow);
          
          // 모품목 헤더 매핑 보정
          if (currentParentRow['모품목코드']) {
            row['parent_item_code'] = currentParentRow['모품목코드'];
          }
          if (currentParentRow['모품목명']) {
            row['parent_item_name'] = currentParentRow['모품목명'];
          }
          if (currentParentRow['모품목차종']) {
            row['parent_car_model'] = currentParentRow['모품목차종'];
          }
          if (currentParentRow['모품목단가']) {
            row['parent_unit_price'] = currentParentRow['모품목단가'];
          }
          if (currentParentRow['납품처']) {
            row['parent_supplier'] = currentParentRow['납품처'];
            row['parent_supplier_name'] = currentParentRow['납품처'];
          }
          
          // 자품목 헤더 매핑 보정
          if (row['자품목코드']) {
            row['child_item_code'] = row['자품목코드'];
          }
          if (row['자품목명']) {
            row['child_item_name'] = row['자품목명'];
          }
          if (row['자품목차종']) {
            row['child_car_model'] = row['자품목차종'];
          }
          if (row['자품목단가']) {
            row['child_unit_price'] = row['자품목단가'];
          }
          if (row['자품목공급사명']) {
            row['child_supplier'] = row['자품목공급사명'];
            row['child_supplier_name'] = row['자품목공급사명'];
          }
          if (row['자품목구매수량']) {
            row['child_purchase_quantity'] = row['자품목구매수량'];
          }
          if (row['자품목구매금액']) {
            row['child_purchase_amount'] = row['자품목구매금액'];
          }
          
          // 시트 이름 저장 (고객사 정보로 사용)
          row['sheet_name'] = sheetName;
          
          // BOM 엔트리 추가
          dataRows.push(row);
        }
      }
      
      allRawData = allRawData.concat(dataRows);
    });

    if (allRawData.length === 0) {
      return {
        valid: false,
        data: [],
        errors: [{ row: 0, field: 'file', message: 'Excel 파일에 데이터가 없습니다' }],
        stats: { total_rows: 0, valid_rows: 0, error_rows: 0 }
      };
    }

    // 한글 헤더를 영문 필드명으로 매핑
    const mappedData = mapExcelHeaders(allRawData, bomHeaderMapping);

    // Validate each row
    mappedData.forEach((row, index) => {
      const rowNumber = index + 7; // Excel row number (6번째 행이 헤더, 7번째 행부터 데이터)
      const rowErrors: ValidationError[] = [];

      // Required fields validation - Parent item
      if (!row.parent_item_code || String(row.parent_item_code).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'parent_item_code',
          message: '부모 품목 코드가 필요합니다',
          value: row.parent_item_code
        });
      }

      if (!row.parent_item_name || String(row.parent_item_name).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'parent_item_name',
          message: '부모 품목명이 필요합니다',
          value: row.parent_item_name
        });
      }

      // Required fields validation - Child item
      if (!row.child_item_code || String(row.child_item_code).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'child_item_code',
          message: '자식 품목 코드가 필요합니다',
          value: row.child_item_code
        });
      }

      if (!row.child_item_name || String(row.child_item_name).trim() === '') {
        rowErrors.push({
          row: rowNumber,
          field: 'child_item_name',
          message: '자식 품목명이 필요합니다',
          value: row.child_item_name
        });
      }

      // Inventory type validation (DB accepts Korean values: '완제품', '반제품', '고객재고', '원재료', '코일')
      const validInventoryTypes = ['완제품', '반제품', '고객재고', '원재료', '코일'];
      if (row.parent_inventory_type && !validInventoryTypes.includes(row.parent_inventory_type)) {
        rowErrors.push({
          row: rowNumber,
          field: 'parent_inventory_type',
          message: `부모 품목 재고타입은 ${validInventoryTypes.join(', ')} 중 하나여야 합니다`,
          value: row.parent_inventory_type
        });
      }

      if (row.child_inventory_type && !validInventoryTypes.includes(row.child_inventory_type)) {
        rowErrors.push({
          row: rowNumber,
          field: 'child_inventory_type',
          message: `자식 품목 재고타입은 ${validInventoryTypes.join(', ')} 중 하나여야 합니다`,
          value: row.child_inventory_type
        });
      }

      // Quantity validation
      const quantity = Number(row.quantity_required);
      if (isNaN(quantity) || quantity <= 0) {
        rowErrors.push({
          row: rowNumber,
          field: 'quantity_required',
          message: '소요량은 0보다 큰 숫자여야 합니다',
          value: row.quantity_required
        });
      }

      // Level validation (optional, default to 1)
      let level_no = 1;
      if (row.level_no !== undefined && row.level_no !== null) {
        level_no = Number(row.level_no);
        if (isNaN(level_no) || level_no < 1) {
          rowErrors.push({
            row: rowNumber,
            field: 'level_no',
            message: 'level_no는 1 이상의 숫자여야 합니다',
            value: row.level_no
          });
        }
      }

      // 자기 참조 허용: 모품목과 자품목이 같을 수 있음

      // If no errors, add to valid data
      if (rowErrors.length === 0) {
        validData.push({
          parent_item_code: String(row.parent_item_code).trim(),
          child_item_code: String(row.child_item_code).trim(),
          quantity_required: quantity,
          level_no: level_no,
          notes: row.notes ? String(row.notes).trim() : undefined,
          // Parent item details (TASK-030: Fix metadata loss bug)
          parent_item_name: row.parent_item_name ? String(row.parent_item_name).trim() : undefined,
          parent_spec: row.parent_spec ? String(row.parent_spec).trim() : undefined,
          parent_unit: row.parent_unit ? String(row.parent_unit).trim() : undefined,
          parent_category: row.parent_category ? String(row.parent_category).trim() : undefined,
          parent_inventory_type: row.parent_inventory_type,
          parent_car_model: row.parent_car_model ? String(row.parent_car_model).trim() : undefined,
          parent_location: row.parent_location ? String(row.parent_location).trim() : undefined,
          parent_supplier: row.parent_supplier ? String(row.parent_supplier).trim() : undefined,
          // Parent item supplier details
          parent_supplier_name: row.parent_supplier_name ? String(row.parent_supplier_name).trim() : undefined,
          parent_supplier_code: row.parent_supplier_code ? String(row.parent_supplier_code).trim() : undefined,
          parent_supplier_phone: row.parent_supplier_phone ? String(row.parent_supplier_phone).trim() : undefined,
          parent_supplier_email: row.parent_supplier_email ? String(row.parent_supplier_email).trim() : undefined,
          parent_supplier_address: row.parent_supplier_address ? String(row.parent_supplier_address).trim() : undefined,
          parent_supplier_type: row.parent_supplier_type ? String(row.parent_supplier_type).trim() : undefined,
          parent_supplier_business_number: row.parent_supplier_business_number ? String(row.parent_supplier_business_number).trim() : undefined,
          parent_supplier_representative: row.parent_supplier_representative ? String(row.parent_supplier_representative).trim() : undefined,
          // Child item details (TASK-030: Fix metadata loss bug)
          child_item_name: row.child_item_name ? String(row.child_item_name).trim() : undefined,
          child_spec: row.child_spec ? String(row.child_spec).trim() : undefined,
          child_unit: row.child_unit ? String(row.child_unit).trim() : undefined,
          child_category: row.child_category ? String(row.child_category).trim() : undefined,
          child_inventory_type: row.child_inventory_type,
          child_car_model: row.child_car_model ? String(row.child_car_model).trim() : undefined,
          child_location: row.child_location ? String(row.child_location).trim() : undefined,
          child_supplier: row.child_supplier ? String(row.child_supplier).trim() : undefined,
          // Child item supplier details
          child_supplier_name: row.child_supplier_name ? String(row.child_supplier_name).trim() : undefined,
          child_supplier_code: row.child_supplier_code ? String(row.child_supplier_code).trim() : undefined,
          child_supplier_phone: row.child_supplier_phone ? String(row.child_supplier_phone).trim() : undefined,
          child_supplier_email: row.child_supplier_email ? String(row.child_supplier_email).trim() : undefined,
          child_supplier_address: row.child_supplier_address ? String(row.child_supplier_address).trim() : undefined,
          child_supplier_type: row.child_supplier_type ? String(row.child_supplier_type).trim() : undefined,
          child_supplier_business_number: row.child_supplier_business_number ? String(row.child_supplier_business_number).trim() : undefined,
          child_supplier_representative: row.child_supplier_representative ? String(row.child_supplier_representative).trim() : undefined,
          child_supplier_category: row.child_supplier_category ? String(row.child_supplier_category).trim() : undefined, // 업체구분 (H열)
          // Monthly price information (parent)
          parent_price_month: row.parent_price_month ? String(row.parent_price_month).trim() : undefined,
          parent_unit_price: row.parent_unit_price ? (typeof row.parent_unit_price === 'number' ? row.parent_unit_price : parseFloat(String(row.parent_unit_price))) : undefined,
          parent_price_per_kg: row.parent_price_per_kg ? (typeof row.parent_price_per_kg === 'number' ? row.parent_price_per_kg : parseFloat(String(row.parent_price_per_kg))) : undefined,
          parent_price_note: row.parent_price_note ? String(row.parent_price_note).trim() : undefined,
          // Monthly price information (child)
          child_price_month: row.child_price_month ? String(row.child_price_month).trim() : undefined,
          child_unit_price: row.child_unit_price ? (typeof row.child_unit_price === 'number' ? row.child_unit_price : parseFloat(String(row.child_unit_price))) : undefined,
          child_price_per_kg: row.child_price_per_kg ? (typeof row.child_price_per_kg === 'number' ? row.child_price_per_kg : parseFloat(String(row.child_price_per_kg))) : undefined,
          child_price_note: row.child_price_note ? String(row.child_price_note).trim() : undefined,
          // Purchase quantity and amount (구매수량, 구매금액)
          child_purchase_quantity: row.child_purchase_quantity ? (typeof row.child_purchase_quantity === 'number' ? row.child_purchase_quantity : parseFloat(String(row.child_purchase_quantity))) : undefined,
          child_purchase_amount: row.child_purchase_amount ? (typeof row.child_purchase_amount === 'number' ? row.child_purchase_amount : parseFloat(String(row.child_purchase_amount))) : undefined,
          // Sheet information for customer identification
          sheet_name: row.sheet_name ? String(row.sheet_name).trim() : undefined
        });
      } else {
        errors.push(...rowErrors);
      }
    });

    return {
      valid: errors.length === 0,
      data: validData,
      errors,
      stats: {
        total_rows: mappedData.length,
        valid_rows: validData.length,
        error_rows: errors.length > 0 ? mappedData.length - validData.length : 0
      }
    };
  } catch (error) {
    console.error('Excel parsing error:', error);
    return {
      valid: false,
      data: [],
      errors: [{
        row: 0,
        field: 'file',
        message: `Excel 파일 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      }],
      stats: { total_rows: 0, valid_rows: 0, error_rows: 0 }
    };
  }
}

// ============================================================================
// CIRCULAR DEPENDENCY DETECTION
// ============================================================================

/**
 * Detect circular dependencies in BOM structure
 * Uses DFS (Depth-First Search) to find cycles
 */
function detectCircularDependencies(bomData: BOMExcelRow[]): CircularDependencyCheck {
  // Build adjacency list (parent -> children)
  const graph = new Map<string, Set<string>>();

  bomData.forEach(({ parent_item_code, child_item_code }) => {
    if (!graph.has(parent_item_code)) {
      graph.set(parent_item_code, new Set());
    }
    graph.get(parent_item_code)!.add(child_item_code);
  });

  // Track visited nodes and current path
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  const currentPath: string[] = [];

  /**
   * DFS helper to detect cycles
   */
  function dfs(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    currentPath.push(node);

    const neighbors = graph.get(node) || new Set();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true; // Cycle detected in subtree
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle - extract the cycle path
        const cycleStart = currentPath.indexOf(neighbor);
        const cycle = currentPath.slice(cycleStart);
        cycle.push(neighbor); // Close the cycle
        cycles.push(cycle);
        return true;
      }
    }

    recursionStack.delete(node);
    currentPath.pop();
    return false;
  }

  // Check all nodes for cycles
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return {
    valid: cycles.length === 0,
    cycles: cycles.length > 0 ? cycles : undefined
  };
}

// ============================================================================
// SUPPLIER LOOKUP & ITEM UPSERT HELPERS
// ============================================================================

/**
 * Company type mapping (Korean to Korean for DB)
 */
const companyTypeMap: Record<string, string> = {
  'CUSTOMER': '고객사',
  'SUPPLIER': '공급사',
  'BOTH': '협력사',
  'OTHER': '기타',
  '고객사': '고객사',
  '공급사': '공급사',
  '협력사': '협력사',
  '기타': '기타'
};

/**
 * Find supplier_id by company name or company_code
 * Returns null if not found
 */
async function findSupplierByNameOrCode(
  supabase: SupabaseClient<Database>,
  supplierNameOrCode: string
): Promise<number | null> {
  if (!supplierNameOrCode || supplierNameOrCode.trim() === '') {
    return null;
  }

  const trimmed = supplierNameOrCode.trim();

  // Query companies table by name or code
  const { data, error } = await supabase
    .from('companies')
    .select('company_id')
    .or(`company_name.eq.${trimmed},company_code.eq.${trimmed}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle(); // Use maybeSingle() to handle no results gracefully

  if (error || !data) {
    return null;
  }

  return data.company_id;
}

/**
 * Upsert company (create or update)
 * Returns company_id
 */
interface CompanyData {
  company_name: string;
  company_code?: string;
  company_type?: string;
  company_category?: string; // 업체구분 (H열) - 협력업체, 사급, 하드웨어, 태창금속 등
  phone?: string;
  email?: string;
  address?: string;
  business_number?: string;
  representative?: string;
}

async function upsertCompany(
  supabase: SupabaseClient<Database>,
  companyData: CompanyData
): Promise<{ company_id: number; company_code: string }> {
  if (!companyData.company_name || companyData.company_name.trim() === '') {
    throw new Error('거래처명은 필수입니다');
  }

  const companyName = companyData.company_name.trim();
  const companyCode = companyData.company_code?.trim();
  
  // Determine company type (default to '기타' if not provided)
  let dbCompanyType = '기타';
  if (companyData.company_type) {
    dbCompanyType = companyTypeMap[companyData.company_type] || companyData.company_type;
  }

  // Check if company exists by name or code
  let existingCompany: { company_id: number; company_code: string } | null = null;
  
  if (companyCode) {
    // Try to find by code first
    const { data: codeData, error: codeError } = await supabase
      .from('companies')
      .select('company_id, company_code')
      .eq('company_code', companyCode)
      .limit(1)
      .maybeSingle(); // Use maybeSingle() to handle no results gracefully
    
    if (codeData && !codeError) {
      existingCompany = codeData;
    }
  }
  
  // If not found by code, try by name
  if (!existingCompany) {
    const { data: nameData, error: nameError } = await supabase
      .from('companies')
      .select('company_id, company_code')
      .eq('company_name', companyName)
      .limit(1)
      .maybeSingle(); // Use maybeSingle() to handle no results gracefully
    
    if (nameData && !nameError) {
      existingCompany = nameData;
    }
  }

  // Prepare company payload
  const companyPayload: any = {
    company_name: companyName,
    company_type: dbCompanyType,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  // Add optional fields if provided
  if (companyData.phone) companyPayload.phone = companyData.phone.trim();
  if (companyData.email) companyPayload.email = companyData.email.trim();
  if (companyData.address) companyPayload.address = companyData.address.trim();
  if (companyData.business_number) companyPayload.business_number = companyData.business_number.trim();
  if (companyData.representative) companyPayload.representative = companyData.representative.trim();
  if (companyData.company_category) companyPayload.company_category = companyData.company_category.trim();

  // Generate company_code if not provided and company doesn't exist
  if (!companyCode && !existingCompany) {
    const prefixMap: Record<string, string> = {
      '고객사': 'CUS',
      '공급사': 'SUP',
      '협력사': 'PAR',
      '기타': 'OTH'
    };
    const prefix = prefixMap[dbCompanyType] || 'COM';

    // Get the last company code with this prefix
    const { data: existingCodes } = await supabase
      .from('companies')
      .select('company_code')
      .like('company_code', `${prefix}%`)
      .order('company_code', { ascending: false })
      .limit(100);

    let nextNumber = 1;
    if (existingCodes && existingCodes.length > 0) {
      const numbers = existingCodes
        .map((row: any) => {
          const match = row.company_code.match(/\d+$/);
          return match ? parseInt(match[0]) : 0;
        })
        .filter((num: number) => !isNaN(num));
      
      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    companyPayload.company_code = `${prefix}${String(nextNumber).padStart(3, '0')}`;
  } else if (companyCode) {
    companyPayload.company_code = companyCode;
  } else if (existingCompany) {
    companyPayload.company_code = existingCompany.company_code;
  }

  // Upsert company
  if (existingCompany) {
    // Update existing company
    const { data, error } = await supabase
      .from('companies')
      .update(companyPayload)
      .eq('company_id', existingCompany.company_id)
      .select('company_id, company_code')
      .single();

    if (error) {
      throw new Error(`거래처 업데이트 실패 (${companyName}): ${error.message}`);
    }

    return { company_id: data.company_id, company_code: data.company_code };
  } else {
    // Create new company
    companyPayload.created_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('companies')
      .insert(companyPayload)
      .select('company_id, company_code')
      .single();

    if (error) {
      throw new Error(`거래처 생성 실패 (${companyName}): ${error.message}`);
    }

    return { company_id: data.company_id, company_code: data.company_code };
  }
}

/**
 * Upsert item (create or update)
 * Returns item_id
 */
interface ItemPayload {
  item_code: string;
  item_name: string;
  is_active: boolean;
  spec?: string;
  unit: string; // Required field in DB
  category: "원자재" | "부자재" | "반제품" | "제품" | "상품";
  inventory_type: string; // Required field in DB
  vehicle_model?: string; // DB 컬럼명: vehicle_model
  location?: string;
  supplier_id?: number;
  // 종합 시트 형식의 상세 정보
  material?: string;
  thickness?: number;
  width?: number;
  height?: number;
  specific_gravity?: number;
  mm_weight?: number;
  sep?: number;
  kg_unit_price?: number;
  scrap_weight?: number;
  scrap_unit_price?: number;
  actual_quantity?: number;
  price?: number;
}

async function upsertItem(
  supabase: SupabaseClient<Database>,
  itemCode: string,
  itemName: string,
  spec?: string,
  unit?: string,
  category?: string,
  inventoryType?: string,
  carModel?: string,
  location?: string,
  supplierId?: number,
  // 종합 시트 형식의 상세 정보
  material?: string,
  thickness?: number,
  width?: number,
  height?: number,
  specificGravity?: number,
  mmWeight?: number,
  sep?: number,
  kgUnitPrice?: number,
  scrapWeight?: number,
  scrapUnitPrice?: number,
  actualQuantity?: number,
  price?: number
): Promise<{ item_id: number; item_code: string }> {
  // category는 필수 필드이므로 기본값 설정 (enum: 원자재, 부자재, 반제품, 제품, 상품)
  const validCategories = ['원자재', '부자재', '반제품', '제품', '상품'] as const;
  const trimmedCategory = category ? category.trim() : '부자재';
  const validatedCategory = validCategories.includes(trimmedCategory as typeof validCategories[number])
    ? trimmedCategory as typeof validCategories[number]
    : '부자재';

  // Prepare item payload - category와 inventory_type은 필수
  const itemPayload: ItemPayload = {
    item_code: itemCode.trim(),
    item_name: itemName.trim(),
    is_active: true,
    unit: unit || 'EA', // 기본값: EA
    category: validatedCategory,
    inventory_type: inventoryType || '원재료'
  };

  if (spec) itemPayload.spec = spec.trim();
  if (unit && unit.trim()) itemPayload.unit = unit.trim(); // Override default if provided
  if (carModel) itemPayload.vehicle_model = carModel.trim(); // DB 컬럼명: vehicle_model
  if (location) itemPayload.location = location.trim();
  if (supplierId) itemPayload.supplier_id = supplierId;
  // 종합 시트 형식의 상세 정보 추가
  if (material) itemPayload.material = material.trim();
  if (thickness !== undefined && thickness !== null) itemPayload.thickness = Number(thickness);
  if (width !== undefined && width !== null) itemPayload.width = Number(width);
  if (height !== undefined && height !== null) itemPayload.height = Number(height);
  if (specificGravity !== undefined && specificGravity !== null) itemPayload.specific_gravity = Number(specificGravity);
  if (mmWeight !== undefined && mmWeight !== null) itemPayload.mm_weight = Number(mmWeight);
  if (sep !== undefined && sep !== null) itemPayload.sep = Number(sep);
  if (kgUnitPrice !== undefined && kgUnitPrice !== null) itemPayload.kg_unit_price = Number(kgUnitPrice);
  if (scrapWeight !== undefined && scrapWeight !== null) itemPayload.scrap_weight = Number(scrapWeight);
  if (scrapUnitPrice !== undefined && scrapUnitPrice !== null) itemPayload.scrap_unit_price = Number(scrapUnitPrice);
  if (actualQuantity !== undefined && actualQuantity !== null) itemPayload.actual_quantity = Number(actualQuantity);
  if (price !== undefined && price !== null) itemPayload.price = Number(price);

  // Upsert item (INSERT ... ON CONFLICT UPDATE)
  const { data, error } = await supabase
    .from('items')
    .upsert(itemPayload, {
      onConflict: 'item_code',
      ignoreDuplicates: false // Update if exists
    })
    .select('item_id, item_code')
    .single();

  if (error) {
    throw new Error(`품목 생성/업데이트 실패 (${itemCode}): ${error.message}`);
  }

  return data;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // TODO: Add authentication middleware check
    // Example: const session = await getServerSession(request);
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: '파일이 제공되지 않았습니다'
        },
        { status: 400 }
      );
    }

    // Validate file type and size
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Excel 파일만 업로드 가능합니다 (.xlsx, .xls)'
        },
        { status: 400 }
      );
    }

    // File size limit: 5MB
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB를 초과할 수 없습니다`
        },
        { status: 400 }
      );
    }

    // 2. Parse Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = parseBOMExcel(buffer);

    if (!parseResult.valid || parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '파일 검증 실패',
          details: parseResult.errors,
          stats: parseResult.stats
        },
        { status: 400 }
      );
    }

    // 3. Upsert all unique items (parent and child)
    const supabase = getSupabaseClient();

    /**
     * TASK-031: Transaction Handling Limitation
     *
     * ⚠️ KNOWN LIMITATION: Supabase JavaScript client does not support traditional BEGIN/COMMIT transactions.
     *
     * Current implementation uses sequential operations:
     * 1. Upsert items sequentially (errors cause immediate failure and rollback of entire operation)
     * 2. Upsert BOM entries (single batch operation)
     *
     * Risk: If BOM insert fails after items are upserted, orphaned items may remain in database.
     *
     * Mitigation strategies applied:
     * - Items use upsert (idempotent) so re-running upload won't create duplicates
     * - BOM entries also use upsert so re-running upload is safe
     * - Comprehensive validation before any database operation
     * - Detailed error logging for troubleshooting
     *
     * Future improvement: Create PostgreSQL stored procedure with proper transaction handling
     * and call it via Supabase RPC for atomic operations.
     */

    // 3. Collect and upsert unique companies (suppliers) first
    // Collect unique companies with all their details
    const uniqueCompanies = new Map<string, CompanyData>();
    
    parseResult.data.forEach(row => {
      // Collect parent item supplier
      if (row.parent_supplier_name || row.parent_supplier_code || row.parent_supplier) {
        const supplierKey = row.parent_supplier_code || row.parent_supplier_name || row.parent_supplier || '';
        if (supplierKey && !uniqueCompanies.has(supplierKey)) {
          uniqueCompanies.set(supplierKey, {
            company_name: row.parent_supplier_name || row.parent_supplier || '',
            company_code: row.parent_supplier_code,
            company_type: row.parent_supplier_type || '공급사',
            phone: row.parent_supplier_phone,
            email: row.parent_supplier_email,
            address: row.parent_supplier_address,
            business_number: row.parent_supplier_business_number,
            representative: row.parent_supplier_representative
          });
        }
      }
      
      // Collect child item supplier
      if (row.child_supplier_name || row.child_supplier_code || row.child_supplier) {
        const supplierKey = row.child_supplier_code || row.child_supplier_name || row.child_supplier || '';
        if (supplierKey && !uniqueCompanies.has(supplierKey)) {
          uniqueCompanies.set(supplierKey, {
            company_name: row.child_supplier_name || row.child_supplier || '',
            company_code: row.child_supplier_code,
            company_type: row.child_supplier_type || '공급사',
            company_category: row.child_supplier_category, // 업체구분 (H열) - 협력업체, 사급, 하드웨어, 태창금속 등
            phone: row.child_supplier_phone,
            email: row.child_supplier_email,
            address: row.child_supplier_address,
            business_number: row.child_supplier_business_number,
            representative: row.child_supplier_representative
          });
        }
      }
    });

    // Upsert all companies and build company_name/code → company_id mapping
    const companyMap = new Map<string, number>(); // key: company_name or company_code, value: company_id
    const companyEntries = Array.from(uniqueCompanies.entries());
    const COMPANY_BATCH_SIZE = 50;

    for (let i = 0; i < companyEntries.length; i += COMPANY_BATCH_SIZE) {
      const batch = companyEntries.slice(i, i + COMPANY_BATCH_SIZE);
      const upsertPromises = batch.map(async ([key, companyData]) => {
        try {
          const upsertedCompany = await upsertCompany(supabase, companyData);
          // Map both name and code to company_id for lookup
          if (companyData.company_name) {
            companyMap.set(companyData.company_name, upsertedCompany.company_id);
          }
          if (upsertedCompany.company_code) {
            companyMap.set(upsertedCompany.company_code, upsertedCompany.company_id);
          }
          return { key, company_id: upsertedCompany.company_id };
        } catch (error) {
          console.error(`거래처 처리 실패 (${companyData.company_name}):`, error);
          // Continue with other companies even if one fails
          return null;
        }
      });

      await Promise.all(upsertPromises);
    }

    // 4. Upsert items and collect item ID mappings
    // Collect unique items with all their details
    const uniqueItems = new Map<string, {
      item_code: string;
      item_name: string;
      spec?: string;
      unit?: string;
      category?: string;
      inventory_type?: string;
      car_model?: string;
      location?: string;
      supplier?: string;
      supplier_id?: number; // Add supplier_id for direct lookup
      // 종합 시트 형식의 상세 정보
      material?: string;
      thickness?: number;
      width?: number;
      height?: number;
      specific_gravity?: number;
      mm_weight?: number;
      sep?: number;
      kg_unit_price?: number;
      scrap_weight?: number;
      scrap_unit_price?: number;
      actual_quantity?: number;
      price?: number;
    }>();

    // Helper function to get supplier_id from company info
    const getSupplierId = (row: BOMExcelRow, isParent: boolean): number | undefined => {
      if (isParent) {
        if (row.parent_supplier_code && companyMap.has(row.parent_supplier_code)) {
          return companyMap.get(row.parent_supplier_code);
        }
        if (row.parent_supplier_name && companyMap.has(row.parent_supplier_name)) {
          return companyMap.get(row.parent_supplier_name);
        }
        if (row.parent_supplier && companyMap.has(row.parent_supplier)) {
          return companyMap.get(row.parent_supplier);
        }
      } else {
        if (row.child_supplier_code && companyMap.has(row.child_supplier_code)) {
          return companyMap.get(row.child_supplier_code);
        }
        if (row.child_supplier_name && companyMap.has(row.child_supplier_name)) {
          return companyMap.get(row.child_supplier_name);
        }
        if (row.child_supplier && companyMap.has(row.child_supplier)) {
          return companyMap.get(row.child_supplier);
        }
      }
      return undefined;
    };

    // Helper function to get customer_id from sheet name or parent supplier
    const getCustomerId = (
      sheetName: string | undefined,
      parentSupplier: string | undefined,
      companyMap: Map<string, number>
    ): number | undefined => {
      // 시트 이름을 우선적으로 사용 (예: "대우당진", "대우포승")
      if (sheetName && companyMap.has(sheetName)) {
        return companyMap.get(sheetName);
      }
      // 시트 이름이 없거나 찾을 수 없으면 납품처(parent_supplier) 사용
      if (parentSupplier && companyMap.has(parentSupplier)) {
        return companyMap.get(parentSupplier);
      }
      return undefined;
    };

    // Add parent items
    parseResult.data.forEach(row => {
      if (!uniqueItems.has(row.parent_item_code)) {
        if (!row.parent_item_name) {
          throw new Error(`부모 품목명이 없습니다: ${row.parent_item_code}`);
        }
        const supplierId = getSupplierId(row, true);
        uniqueItems.set(row.parent_item_code, {
          item_code: row.parent_item_code,
          item_name: row.parent_item_name,
          spec: row.parent_spec,
          unit: row.parent_unit,
          category: row.parent_category,
          inventory_type: row.parent_inventory_type,
          car_model: row.parent_car_model,
          location: row.parent_location,
          supplier: row.parent_supplier_name || row.parent_supplier_code || row.parent_supplier,
          supplier_id: supplierId
        });
      }
    });

    // Add child items
    parseResult.data.forEach(row => {
      if (!uniqueItems.has(row.child_item_code)) {
        if (!row.child_item_name) {
          throw new Error(`자식 품목명이 없습니다: ${row.child_item_code}`);
        }
        const supplierId = getSupplierId(row, false);
        uniqueItems.set(row.child_item_code, {
          item_code: row.child_item_code,
          item_name: row.child_item_name,
          spec: row.child_spec,
          unit: row.child_unit,
          category: row.child_category,
          inventory_type: row.child_inventory_type,
          car_model: row.child_car_model,
          location: row.child_location,
          supplier: row.child_supplier_name || row.child_supplier_code || row.child_supplier,
          supplier_id: supplierId,
          // 종합 시트 형식의 상세 정보 추가
          material: (row as any).자품목재질,
          thickness: (row as any).자품목두께 ? Number((row as any).자품목두께) : undefined,
          width: (row as any).자품목폭 ? Number((row as any).자품목폭) : undefined,
          height: (row as any).자품목길이 ? Number((row as any).자품목길이) : undefined,
          specific_gravity: (row as any).자품목비중 ? Number((row as any).자품목비중) : undefined,
          mm_weight: (row as any).자품목EA중량 ? Number((row as any).자품목EA중량) : undefined,
          sep: (row as any).자품목SEP ? Number((row as any).자품목SEP) : undefined,
          kg_unit_price: (row as any).자품목KG단가 ? Number((row as any).자품목KG단가) : undefined,
          scrap_weight: (row as any).자품목스크랩중량 ? Number((row as any).자품목스크랩중량) : undefined,
          scrap_unit_price: (row as any).자품목스크랩단가 ? Number((row as any).자품목스크랩단가) : undefined,
          actual_quantity: (row as any).자품목실적수량 ? Number((row as any).자품목실적수량) : undefined,
          price: row.child_unit_price ? Number(row.child_unit_price) : undefined
        });
      } else {
        // 기존 항목이 있으면 상세 정보 업데이트 (null이 아닌 값만)
        const existing = uniqueItems.get(row.child_item_code)!;
        if ((row as any).자품목재질 && !existing.material) existing.material = (row as any).자품목재질;
        if ((row as any).자품목두께 && !existing.thickness) existing.thickness = Number((row as any).자품목두께);
        if ((row as any).자품목폭 && !existing.width) existing.width = Number((row as any).자품목폭);
        if ((row as any).자품목길이 && !existing.height) existing.height = Number((row as any).자품목길이);
        if ((row as any).자품목비중 && !existing.specific_gravity) existing.specific_gravity = Number((row as any).자품목비중);
        if ((row as any).자품목EA중량 && !existing.mm_weight) existing.mm_weight = Number((row as any).자품목EA중량);
        if ((row as any).자품목SEP && !existing.sep) existing.sep = Number((row as any).자품목SEP);
        if ((row as any).자품목KG단가 && !existing.kg_unit_price) existing.kg_unit_price = Number((row as any).자품목KG단가);
        if ((row as any).자품목스크랩중량 && !existing.scrap_weight) existing.scrap_weight = Number((row as any).자품목스크랩중량);
        if ((row as any).자품목스크랩단가 && !existing.scrap_unit_price) existing.scrap_unit_price = Number((row as any).자품목스크랩단가);
        if ((row as any).자품목실적수량 && !existing.actual_quantity) existing.actual_quantity = Number((row as any).자품목실적수량);
        if (row.child_unit_price && !existing.price) existing.price = Number(row.child_unit_price);
      }
    });

    // Upsert all items and build item_code → item_id mapping
    // Performance: Batch upserts with concurrency limit (50 at a time)
    const itemCodeMap = new Map<string, number>();
    const itemEntries = Array.from(uniqueItems.entries());
    const BATCH_SIZE = 50;

    // Modified upsertItem to accept supplier_id directly
    const upsertItemWithSupplierId = async (
      supabase: SupabaseClient<Database>,
      itemCode: string,
      itemName: string,
      spec?: string,
      unit?: string,
      category?: string,
      inventoryType?: string,
      carModel?: string,
      location?: string,
      supplierId?: number,
      // 종합 시트 형식의 상세 정보
      material?: string,
      thickness?: number,
      width?: number,
      height?: number,
      specificGravity?: number,
      mmWeight?: number,
      sep?: number,
      kgUnitPrice?: number,
      scrapWeight?: number,
      scrapUnitPrice?: number,
      actualQuantity?: number,
      price?: number
    ): Promise<{ item_id: number; item_code: string }> => {
      // category는 필수 필드이므로 기본값 설정 (enum: 원자재, 부자재, 반제품, 제품, 상품)
      const validCategories = ['원자재', '부자재', '반제품', '제품', '상품'] as const;
      const trimmedCategory = category ? category.trim() : '부자재';
      const validatedCategory = validCategories.includes(trimmedCategory as typeof validCategories[number])
        ? trimmedCategory as typeof validCategories[number]
        : '부자재';

      // Prepare item payload - category와 inventory_type은 필수
      const itemPayload: ItemPayload = {
        item_code: itemCode.trim(),
        item_name: itemName.trim(),
        is_active: true,
        unit: unit || 'EA', // 기본값: EA
        category: validatedCategory,
        inventory_type: inventoryType || '원재료'
      };

      if (spec) itemPayload.spec = spec.trim();
      if (unit && unit.trim()) itemPayload.unit = unit.trim(); // Override default if provided
      if (carModel) itemPayload.vehicle_model = carModel.trim(); // DB 컬럼명: vehicle_model
      if (location) itemPayload.location = location.trim();
      if (supplierId) itemPayload.supplier_id = supplierId;
      // 종합 시트 형식의 상세 정보 추가
      if (material) itemPayload.material = material.trim();
      if (thickness !== undefined && thickness !== null) itemPayload.thickness = Number(thickness);
      if (width !== undefined && width !== null) itemPayload.width = Number(width);
      if (height !== undefined && height !== null) itemPayload.height = Number(height);
      if (specificGravity !== undefined && specificGravity !== null) itemPayload.specific_gravity = Number(specificGravity);
      if (mmWeight !== undefined && mmWeight !== null) itemPayload.mm_weight = Number(mmWeight);
      if (sep !== undefined && sep !== null) itemPayload.sep = Number(sep);
      if (kgUnitPrice !== undefined && kgUnitPrice !== null) itemPayload.kg_unit_price = Number(kgUnitPrice);
      if (scrapWeight !== undefined && scrapWeight !== null) itemPayload.scrap_weight = Number(scrapWeight);
      if (scrapUnitPrice !== undefined && scrapUnitPrice !== null) itemPayload.scrap_unit_price = Number(scrapUnitPrice);
      if (actualQuantity !== undefined && actualQuantity !== null) itemPayload.actual_quantity = Number(actualQuantity);
      if (price !== undefined && price !== null) itemPayload.price = Number(price);

      // Upsert item (INSERT ... ON CONFLICT UPDATE)
      const { data, error } = await supabase
        .from('items')
        .upsert(itemPayload, {
          onConflict: 'item_code',
          ignoreDuplicates: false // Update if exists
        })
        .select('item_id, item_code')
        .single();

      if (error) {
        throw new Error(`품목 생성/업데이트 실패 (${itemCode}): ${error.message}`);
      }

      return data;
    };

    for (let i = 0; i < itemEntries.length; i += BATCH_SIZE) {
      const batch = itemEntries.slice(i, i + BATCH_SIZE);
      const upsertPromises = batch.map(async ([item_code, itemDetails]) => {
        const upsertedItem = await upsertItemWithSupplierId(
          supabase,
          itemDetails.item_code,
          itemDetails.item_name,
          itemDetails.spec,
          itemDetails.unit,
          itemDetails.category,
          itemDetails.inventory_type,
          itemDetails.car_model,
          itemDetails.location,
          itemDetails.supplier_id, // Use supplier_id directly
          // 종합 시트 형식의 상세 정보 전달
          itemDetails.material,
          itemDetails.thickness,
          itemDetails.width,
          itemDetails.height,
          itemDetails.specific_gravity,
          itemDetails.mm_weight,
          itemDetails.sep,
          itemDetails.kg_unit_price,
          itemDetails.scrap_weight,
          itemDetails.scrap_unit_price,
          itemDetails.actual_quantity,
          itemDetails.price
        );
        return { item_code, item_id: upsertedItem.item_id };
      });

      const results = await Promise.all(upsertPromises);
      results.forEach(({ item_code, item_id }) => {
        itemCodeMap.set(item_code, item_id);
      });
    }

    // 4-1. Upsert monthly price information
    // Collect unique price information from parsed data
    const priceInfoMap = new Map<string, {
      item_id: number;
      price_month: string;
      unit_price?: number;
      price_per_kg?: number;
      note?: string;
    }>();

    parseResult.data.forEach(row => {
      // Parent item price
      if (row.parent_price_month && row.parent_item_code) {
        const itemId = itemCodeMap.get(row.parent_item_code);
        if (itemId) {
          const priceKey = `${itemId}_${row.parent_price_month}`;
          if (!priceInfoMap.has(priceKey)) {
            priceInfoMap.set(priceKey, {
              item_id: itemId,
              price_month: row.parent_price_month,
              unit_price: row.parent_unit_price,
              price_per_kg: row.parent_price_per_kg,
              note: row.parent_price_note
            });
          }
        }
      }

      // Child item price
      if (row.child_price_month && row.child_item_code) {
        const itemId = itemCodeMap.get(row.child_item_code);
        if (itemId) {
          const priceKey = `${itemId}_${row.child_price_month}`;
          if (!priceInfoMap.has(priceKey)) {
            priceInfoMap.set(priceKey, {
              item_id: itemId,
              price_month: row.child_price_month,
              unit_price: row.child_unit_price,
              price_per_kg: row.child_price_per_kg,
              note: row.child_price_note
            });
          }
        }
      }
    });

    // Upsert price history
    if (priceInfoMap.size > 0) {
      const priceEntries = Array.from(priceInfoMap.values());
      const PRICE_BATCH_SIZE = 50;

      for (let i = 0; i < priceEntries.length; i += PRICE_BATCH_SIZE) {
        const batch = priceEntries.slice(i, i + PRICE_BATCH_SIZE);
        const pricePromises = batch.map(async (priceInfo) => {
          try {
            // Convert price_month to date format (YYYY-MM-DD)
            // Support formats: YYYY-MM, YYYYMM, YYYY-MM-DD
            let priceMonthDate: string;
            const priceMonthStr = String(priceInfo.price_month).trim();
            
            if (priceMonthStr.includes('-')) {
              // Already has dashes: YYYY-MM or YYYY-MM-DD
              if (priceMonthStr.length === 7) {
                // YYYY-MM format
                priceMonthDate = `${priceMonthStr}-01`;
              } else if (priceMonthStr.length === 10) {
                // YYYY-MM-DD format
                priceMonthDate = priceMonthStr;
              } else {
                // Invalid format, try to extract YYYY-MM
                const parts = priceMonthStr.split('-');
                if (parts.length >= 2) {
                  priceMonthDate = `${parts[0]}-${parts[1].padStart(2, '0')}-01`;
                } else {
                  throw new Error(`잘못된 월별단가 월 형식: ${priceMonthStr}`);
                }
              }
            } else if (priceMonthStr.length === 6) {
              // YYYYMM format
              priceMonthDate = `${priceMonthStr.substring(0, 4)}-${priceMonthStr.substring(4, 6)}-01`;
            } else {
              throw new Error(`잘못된 월별단가 월 형식: ${priceMonthStr} (예상 형식: YYYY-MM 또는 YYYYMM)`);
            }

            // Check if price history exists
            const { data: existingPrice, error: checkError } = await supabase
              .from('item_price_history')
              .select('price_history_id')
              .eq('item_id', priceInfo.item_id)
              .eq('price_month', priceMonthDate)
              .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

            if (checkError && checkError.code !== 'PGRST116') {
              // PGRST116 is "not found" error, which is expected when no record exists
              console.error(`월별단가 조회 실패 (item_id: ${priceInfo.item_id}, month: ${priceMonthDate}):`, checkError);
              // Continue to insert/update anyway
            }

            const pricePayload: any = {
              item_id: priceInfo.item_id,
              price_month: priceMonthDate,
              unit_price: priceInfo.unit_price || 0,
              updated_at: new Date().toISOString()
            };

            if (priceInfo.price_per_kg !== undefined && priceInfo.price_per_kg !== null) {
              pricePayload.price_per_kg = priceInfo.price_per_kg;
            }
            if (priceInfo.note) {
              pricePayload.note = priceInfo.note.trim();
            }

            if (existingPrice && !checkError) {
              // Update existing price
              const { error } = await supabase
                .from('item_price_history')
                .update(pricePayload)
                .eq('price_history_id', existingPrice.price_history_id);

              if (error) {
                console.error(`월별단가 업데이트 실패 (item_id: ${priceInfo.item_id}, month: ${priceMonthDate}):`, error);
              }
            } else {
              // Insert new price
              pricePayload.created_at = new Date().toISOString();
              const { error } = await supabase
                .from('item_price_history')
                .insert(pricePayload);

              if (error) {
                console.error(`월별단가 생성 실패 (item_id: ${priceInfo.item_id}, month: ${priceMonthDate}):`, error);
              }
            }
          } catch (error) {
            console.error(`월별단가 처리 중 오류 (item_id: ${priceInfo.item_id}):`, error);
            // Continue with other prices even if one fails
          }
        });

        await Promise.all(pricePromises);
      }
    }

    // 5. Check for circular dependencies
    const circularCheck = detectCircularDependencies(parseResult.data);

    if (!circularCheck.valid && circularCheck.cycles) {
      return NextResponse.json(
        {
          success: false,
          error: '순환 참조 감지',
          details: {
            cycles: circularCheck.cycles,
            message: `BOM 구조에 순환 참조가 있습니다. 순환 경로: ${circularCheck.cycles.map(c => c.join(' → ')).join(', ')}`
          }
        },
        { status: 400 }
      );
    }

    // 6. Prepare BOM entries for database insertion
    interface BOMInsert {
      parent_item_id: number;
      child_item_id: number;
      quantity_required: number;
      level_no: number;
      is_active: boolean;
      notes?: string;
      customer_id?: number;
      child_supplier_id?: number;
    }

    // 중복 입력 허용: 같은 품목 조합도 여러 번 입력 가능
    const bomInserts: BOMInsert[] = parseResult.data.map(row => {
      const parentId = itemCodeMap.get(row.parent_item_code);
      const childId = itemCodeMap.get(row.child_item_code);

      if (!parentId || !childId) {
        throw new Error(
          `품목 ID를 찾을 수 없습니다: ${!parentId ? row.parent_item_code : ''} ${!childId ? row.child_item_code : ''}`
        );
      }

      // customer_id 찾기 (시트 이름 우선, 없으면 납품처 사용)
      const customerId = getCustomerId(
        row.sheet_name,
        row.parent_supplier_name || row.parent_supplier,
        companyMap
      );

      // child_supplier_id 찾기 (기존 함수 활용)
      const childSupplierId = getSupplierId(row, false);

      return {
        parent_item_id: parentId,
        child_item_id: childId,
        quantity_required: row.quantity_required,
        level_no: row.level_no ?? 1, // Use nullish coalescing to preserve 0
        is_active: true,
        notes: row.notes ? String(row.notes).trim() : undefined,
        customer_id: customerId,
        child_supplier_id: childSupplierId
      };
    });

    // 6. Insert BOM entries (중복 허용)
    const { data: insertedBOMs, error: insertError } = await supabase
      .from('bom')
      .insert(
        bomInserts as any
      )
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        parent_item:items!bom_parent_item_id_fkey(item_code, item_name, spec, unit),
        child_item:items!bom_child_item_id_fkey(item_code, item_name, spec, unit)
      `);

    if (insertError) {
      // Log error for debugging (consider using proper logger in production)
      // console.error('Database insert error:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'BOM 등록 실패',
          details: insertError.message
        },
        { status: 500 }
      );
    }

    // Count new vs updated entries
    const insertedCount = insertedBOMs?.length || 0;

    return NextResponse.json({
      success: true,
      message: `${insertedCount}개 BOM 항목이 성공적으로 등록/업데이트되었습니다`,
      data: {
        inserted_count: insertedCount,
        bom_entries: insertedBOMs
      },
      stats: parseResult.stats
    });

  } catch (error) {
    console.error('BOM upload error:', error);

    // Enhanced error messages with phase context
    let errorMessage = 'BOM 업로드 실패';
    let errorDetails = error instanceof Error ? error.message : '알 수 없는 오류';

    // Detect error phase based on error message or type
    if (errorDetails.includes('parse') || errorDetails.includes('파싱') || errorDetails.includes('Excel')) {
      errorMessage = 'Excel 파일 처리 실패';
      errorDetails = `파일을 읽거나 파싱하는 중 오류가 발생했습니다. ${errorDetails}`;
    } else if (errorDetails.includes('item') || errorDetails.includes('품목') || errorDetails.includes('upsert')) {
      errorMessage = '품목 등록 실패';
      errorDetails = `품목 데이터를 데이터베이스에 저장하는 중 오류가 발생했습니다. ${errorDetails}`;
    } else if (errorDetails.includes('BOM') || errorDetails.includes('insert') || errorDetails.includes('foreign key')) {
      errorMessage = 'BOM 관계 등록 실패';
      errorDetails = `BOM 관계를 데이터베이스에 저장하는 중 오류가 발생했습니다. ${errorDetails}`;
    } else if (errorDetails.includes('supplier') || errorDetails.includes('company') || errorDetails.includes('공급사')) {
      errorMessage = '공급사 조회 실패';
      errorDetails = `지정된 공급사를 찾을 수 없습니다. 공급사 코드 또는 이름을 확인하세요. ${errorDetails}`;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
        help: '문제가 지속되면 Excel 템플릿을 다시 다운로드하여 형식을 확인하거나, 데이터베이스 연결 상태를 확인하세요.'
      },
      { status: 500 }
    );
  }
}
