/**
 * Excel Header Mapper
 * 한글 헤더를 영문 필드명으로 매핑하는 유틸리티
 * 
 * 템플릿 다운로드는 한글 헤더를 사용하지만,
 * 업로드 API는 영문 필드명을 기대하므로 매핑이 필요합니다.
 */

export interface HeaderMapping {
  [koreanHeader: string]: string;
}

/**
 * Companies 엑셀 헤더 매핑
 */
export const companiesHeaderMapping: HeaderMapping = {
  // 한글 헤더 → 영문 필드명 (주요 매핑)
  '거래처명': 'company_name',
  '회사명': 'company_name',  // import-map.ts 호환성
  '거래처구분': 'company_type',
  '회사구분': 'company_type',  // import-map.ts 호환성
  '사업자번호': 'business_number',
  '대표자': 'representative',
  '담당자': 'representative',  // import-map.ts 호환성
  '연락처': 'phone',
  '전화번호': 'phone',  // import-map.ts 호환성
  '이메일': 'email',
  '주소': 'address',
  '메모': 'notes',
  '비고': 'notes',
  '회사코드': 'company_code',  // import-map.ts 호환성 (내보내기용)
  '활성여부': 'is_active',  // import-map.ts 호환성 (내보내기용)
  // 영문 헤더는 그대로 유지 (이미 매핑된 경우)
  'company_name': 'company_name',
  'company_type': 'company_type',
  'company_code': 'company_code',
  'business_number': 'business_number',
  'representative': 'representative',
  'contact_person': 'representative',  // import-map.ts 호환성
  'phone': 'phone',
  'email': 'email',
  'address': 'address',
  'notes': 'notes',
  'is_active': 'is_active'
};

/**
 * Items 엑셀 헤더 매핑
 */
export const itemsHeaderMapping: HeaderMapping = {
  // 한글 헤더 → 영문 필드명
  '품목코드': 'item_code',
  '품목명': 'item_name',
  '차종': 'car_model',
  '규격': 'spec',
  '타입': 'item_type',
  '품목분류': 'item_type',  // import-map.ts 호환성
  'category': 'category',  // import-map.ts 호환성
  '단위': 'unit',
  '도장상태': 'coating_status',
  '단가': 'unit_price',
  '최소재고': 'min_stock_level',
  '안전재고': 'safety_stock',  // import-map.ts 호환성
  '현재고': 'current_stock',  // import-map.ts 호환성
  '활성여부': 'is_active',  // import-map.ts 호환성
  // 영문 헤더는 그대로 유지
  'item_code': 'item_code',
  'item_name': 'item_name',
  'car_model': 'car_model',
  'spec': 'spec',
  'item_type': 'item_type',
  'unit': 'unit',
  'coating_status': 'coating_status',
  'unit_price': 'unit_price',
  'min_stock_level': 'min_stock_level',
  'safety_stock': 'safety_stock',
  'current_stock': 'current_stock',
  'is_active': 'is_active'
};

/**
 * BOM 엑셀 헤더 매핑
 */
export const bomHeaderMapping: HeaderMapping = {
  // 한글 헤더 → 영문 필드명 (기존)
  '모품목코드': 'parent_item_code',
  '부모품목코드': 'parent_item_code',
  '상위품목코드': 'parent_item_code',  // import-map.ts 호환성
  '자품목코드': 'child_item_code',
  '자식품목코드': 'child_item_code',
  '하위품목코드': 'child_item_code',  // import-map.ts 호환성
  '소요량': 'quantity_required',
  'quantity': 'quantity_required',  // import-map.ts 호환성 (quantity → quantity_required)
  '단위': 'unit',
  '레벨': 'level_no',
  '비고': 'notes',
  'remarks': 'notes',  // import-map.ts 호환성

  // Enhanced BOM template - Parent item details (Phase 3)
  '모품목명': 'parent_item_name',
  '부모품목명': 'parent_item_name',
  '모품목규격': 'parent_spec',
  '부모품목규격': 'parent_spec',
  '모품목단위': 'parent_unit',
  '부모품목단위': 'parent_unit',
  '모품목카테고리': 'parent_category',
  '부모품목카테고리': 'parent_category',
  '모품목재고타입': 'parent_inventory_type',
  '부모품목재고타입': 'parent_inventory_type',
  '모품목차종': 'parent_car_model',
  '부모품목차종': 'parent_car_model',
  '모품목위치': 'parent_location',
  '부모품목위치': 'parent_location',
  '모품목공급사': 'parent_supplier',
  '부모품목공급사': 'parent_supplier',
  // 모품목 공급사 상세 정보
  '모품목공급사명': 'parent_supplier_name',
  '부모품목공급사명': 'parent_supplier_name',
  '모품목공급사코드': 'parent_supplier_code',
  '부모품목공급사코드': 'parent_supplier_code',
  '모품목공급사사업자번호': 'parent_supplier_business_number',
  '부모품목공급사사업자번호': 'parent_supplier_business_number',
  '모품목공급사대표자': 'parent_supplier_representative',
  '부모품목공급사대표자': 'parent_supplier_representative',
  '모품목공급사전화번호': 'parent_supplier_phone',
  '부모품목공급사전화번호': 'parent_supplier_phone',
  '모품목공급사이메일': 'parent_supplier_email',
  '부모품목공급사이메일': 'parent_supplier_email',
  '모품목공급사주소': 'parent_supplier_address',
  '부모품목공급사주소': 'parent_supplier_address',
  '모품목공급사타입': 'parent_supplier_type',
  '부모품목공급사타입': 'parent_supplier_type',

  // Enhanced BOM template - Child item details (Phase 3)
  '자품목명': 'child_item_name',
  '자식품목명': 'child_item_name',
  '자품목규격': 'child_spec',
  '자식품목규격': 'child_spec',
  '자품목단위': 'child_unit',
  '자식품목단위': 'child_unit',
  '자품목카테고리': 'child_category',
  '자식품목카테고리': 'child_category',
  '자품목재고타입': 'child_inventory_type',
  '자식품목재고타입': 'child_inventory_type',
  '자품목차종': 'child_car_model',
  '자식품목차종': 'child_car_model',
  '자품목위치': 'child_location',
  '자식품목위치': 'child_location',
  '자품목공급사': 'child_supplier',
  '자식품목공급사': 'child_supplier',
  // 자품목 공급사 상세 정보
  '자품목공급사명': 'child_supplier_name',
  '자식품목공급사명': 'child_supplier_name',
  '자품목공급사코드': 'child_supplier_code',
  '자식품목공급사코드': 'child_supplier_code',
  '자품목공급사사업자번호': 'child_supplier_business_number',
  '자식품목공급사사업자번호': 'child_supplier_business_number',
  '자품목공급사대표자': 'child_supplier_representative',
  '자식품목공급사대표자': 'child_supplier_representative',
  '자품목공급사전화번호': 'child_supplier_phone',
  '자식품목공급사전화번호': 'child_supplier_phone',
  '자품목공급사이메일': 'child_supplier_email',
  '자식품목공급사이메일': 'child_supplier_email',
  '자품목공급사주소': 'child_supplier_address',
  '자식품목공급사주소': 'child_supplier_address',
  '자품목공급사타입': 'child_supplier_type',
  '자식품목공급사타입': 'child_supplier_type',
  // Monthly price information (parent)
  '모품목단가월': 'parent_price_month',
  '부모품목단가월': 'parent_price_month',
  '모품목단가': 'parent_unit_price',
  '부모품목단가': 'parent_unit_price',
  '모품목KG단가': 'parent_price_per_kg',
  '부모품목KG단가': 'parent_price_per_kg',
  '모품목단가비고': 'parent_price_note',
  '부모품목단가비고': 'parent_price_note',
  // Monthly price information (child)
  '자품목단가월': 'child_price_month',
  '자식품목단가월': 'child_price_month',
  '자품목단가': 'child_unit_price',
  '자식품목단가': 'child_unit_price',
  '자품목KG단가': 'child_price_per_kg',
  '자식품목KG단가': 'child_price_per_kg',
  '자품목단가비고': 'child_price_note',
  '자식품목단가비고': 'child_price_note',

  // 영문 헤더는 그대로 유지 (기존)
  'parent_item_code': 'parent_item_code',
  'child_item_code': 'child_item_code',
  'quantity_required': 'quantity_required',
  'level_no': 'level_no',

  // 영문 헤더는 그대로 유지 (Phase 3 추가)
  'parent_item_name': 'parent_item_name',
  'parent_spec': 'parent_spec',
  'parent_unit': 'parent_unit',
  'parent_category': 'parent_category',
  'parent_inventory_type': 'parent_inventory_type',
  'parent_supplier': 'parent_supplier',
  'parent_supplier_name': 'parent_supplier_name',
  'parent_supplier_code': 'parent_supplier_code',
  'parent_supplier_phone': 'parent_supplier_phone',
  'parent_supplier_email': 'parent_supplier_email',
  'parent_supplier_address': 'parent_supplier_address',
  'parent_supplier_type': 'parent_supplier_type',
  'child_item_name': 'child_item_name',
  'child_spec': 'child_spec',
  'child_unit': 'child_unit',
  'child_category': 'child_category',
  'child_inventory_type': 'child_inventory_type',
  'child_supplier': 'child_supplier',
  'child_supplier_name': 'child_supplier_name',
  'child_supplier_code': 'child_supplier_code',
  'child_supplier_phone': 'child_supplier_phone',
  'child_supplier_email': 'child_supplier_email',
  'child_supplier_address': 'child_supplier_address',
  'child_supplier_type': 'child_supplier_type',

  // 새로운 템플릿 구조 헤더 매핑 (태창금속 BOM.xlsx 구조)
  // 모품목 영역
  '납품처': 'parent_supplier_name',
  '마감수량': 'parent_quantity',
  '마감금액': 'parent_amount',
  // 자품목 영역
  '구매처': 'child_supplier_name',
  '업체구분': 'supplier_category',
  '협력업체 철판': 'supplier_sector',
  'U/S': 'quantity_required',
  '구매수량': 'child_quantity',
  '구매금액': 'child_amount',
  // 추가 정보 영역
  'KG단가': 'price_per_kg',
  '단품단가': 'unit_price',
  '재질': 'material',
  '두께': 'thickness',
  '폭': 'width',
  '길이': 'length',
  'SEP': 'sep',
  '비중': 'specific_gravity',
  'EA중량': 'weight_per_piece',
  '실적수량': 'actual_quantity',
  '스크랩중량': 'scrap_weight',
  '스크랩 단가': 'scrap_unit_price',
  '스크랩금액': 'scrap_amount'
};

/**
 * 재고 거래(Inventory Transaction) 엑셀 헤더 매핑
 */
export const inventoryHeaderMapping: HeaderMapping = {
  // 한글 헤더 → 영문 필드명
  '거래일자': 'transaction_date',
  '거래유형': 'transaction_type',
  '품목코드': 'item_code',
  '수량': 'quantity',
  '단위': 'unit',
  '회사코드': 'company_code',
  '참조번호': 'reference_number',
  '비고': 'remarks',
  '메모': 'remarks',
  // 영문 헤더는 그대로 유지
  'transaction_date': 'transaction_date',
  'transaction_type': 'transaction_type',
  'item_code': 'item_code',
  'quantity': 'quantity',
  'unit': 'unit',
  'company_code': 'company_code',
  'reference_number': 'reference_number',
  'remarks': 'remarks'
};

/**
 * 엑셀 데이터의 헤더를 매핑 규칙에 따라 변환
 * 
 * @param data 엑셀에서 파싱된 원본 데이터 (배열)
 * @param mapping 헤더 매핑 규칙
 * @returns 헤더가 영문 필드명으로 변환된 데이터
 */
export function mapExcelHeaders(
  data: Record<string, any>[],
  mapping: HeaderMapping
): Record<string, any>[] {
  if (!data || data.length === 0) {
    return [];
  }

  return data.map(row => {
    const mappedRow: Record<string, any> = {};

    // 각 헤더(키)를 매핑 규칙에 따라 변환
    Object.keys(row).forEach(originalHeader => {
      const mappedField = mapping[originalHeader];
      
      if (mappedField) {
        // 매핑 규칙에 있는 경우 변환된 필드명 사용
        mappedRow[mappedField] = row[originalHeader];
      } else {
        // 매핑 규칙에 없는 경우 원본 유지 (추가 필드 지원)
        mappedRow[originalHeader] = row[originalHeader];
      }
    });

    return mappedRow;
  });
}

/**
 * 엑셀 데이터의 헤더가 이미 영문인지 확인
 * (한글 헤더가 하나라도 있으면 false)
 * 
 * @param data 엑셀에서 파싱된 데이터
 * @param mapping 헤더 매핑 규칙
 * @returns 한글 헤더가 없으면 true (이미 영문), 있으면 false
 */
export function hasOnlyEnglishHeaders(
  data: Record<string, any>[],
  mapping: HeaderMapping
): boolean {
  if (!data || data.length === 0) {
    return true;
  }

  // 첫 번째 행의 키를 확인
  const headers = Object.keys(data[0]);
  
  // 한글 헤더가 하나라도 있는지 확인 (매핑 규칙에 있지만 영문 필드명과 다른 경우)
  return headers.every(header => {
    const mapped = mapping[header];
    // 매핑 규칙에 없거나, 매핑 결과가 원본과 동일하면 영문 헤더로 간주
    return !mapped || mapped === header;
  });
}

