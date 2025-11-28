/**
 * Company Mappings
 * 고객사 및 공급사 매핑 정보
 * 
 * 이 파일은 Excel 시트명과 구매처명을 company_id로 매핑하는 정보를 제공합니다.
 * 모든 매핑은 데이터베이스에서 동적으로 조회합니다.
 * 하드코딩된 매핑은 제거되었습니다.
 */

/**
 * 데이터베이스에서 고객사 매핑을 동적으로 조회
 * @param supabase - Supabase 클라이언트
 * @returns 시트명 -> company_id 매핑
 */
export async function getCustomerMappingFromDB(supabase: any): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('company_id, company_name, company_code')
      .eq('company_type', '고객사')
      .eq('is_active', true);

    if (error || !data) {
      console.error('Failed to fetch customer mapping from DB:', error);
      throw new Error(`고객사 매핑 조회 실패: ${error?.message || 'Unknown error'}`);
    }

    const mapping: Record<string, number> = {};
    data.forEach((company: any) => {
      // company_name을 키로 사용
      mapping[company.company_name] = company.company_id;
      // 공백이 포함된 버전도 추가 (Excel 시트명 대응)
      if (company.company_name.includes('인알파코리아')) {
        mapping['인알파코리아 '] = company.company_id;
      }
    });

    return mapping;
  } catch (error) {
    console.error('Error fetching customer mapping from DB:', error);
    throw error;
  }
}

/**
 * 데이터베이스에서 공급사 매핑을 동적으로 조회
 * @param supabase - Supabase 클라이언트
 * @returns 구매처명 -> company_id 매핑
 */
export async function getSupplierMappingFromDB(supabase: any): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('company_id, company_name, company_code')
      .eq('company_type', '공급사')
      .eq('is_active', true);

    if (error || !data) {
      console.error('Failed to fetch supplier mapping from DB:', error);
      throw new Error(`공급사 매핑 조회 실패: ${error?.message || 'Unknown error'}`);
    }

    const mapping: Record<string, number> = {};
    data.forEach((company: any) => {
      mapping[company.company_name] = company.company_id;
      // 별칭 처리 (예: "대우포승 사급")
      if (company.company_name === '대우포승') {
        mapping['대우포승 사급'] = company.company_id;
      }
      if (company.company_name === '코리아신예') {
        mapping['코리아신예(무상사급)'] = company.company_id;
      }
    });

    // 고객사도 공급사 역할을 할 수 있으므로 추가
    const { data: customerData } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .eq('company_type', '고객사')
      .eq('is_active', true);

    if (customerData) {
      customerData.forEach((company: any) => {
        mapping[company.company_name] = company.company_id;
      });
    }

    return mapping;
  } catch (error) {
    console.error('Error fetching supplier mapping from DB:', error);
    throw error;
  }
}

/**
 * 구매처명을 company_id로 변환
 * @param supplierName - 구매처명
 * @param mapping - 공급사 매핑 (필수)
 * @returns company_id 또는 null
 */
export function getSupplierId(
  supplierName: string | undefined,
  mapping: Record<string, number>
): number | null {
  if (!supplierName) return null;
  const trimmed = supplierName.trim();
  
  // "하드웨어"는 제외 (매핑하지 않음)
  if (trimmed === '하드웨어') {
    return null;
  }
  
  return mapping[trimmed] || null;
}

