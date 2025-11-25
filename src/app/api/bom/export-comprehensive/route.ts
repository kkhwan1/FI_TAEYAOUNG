/**
 * BOM 종합 내보내기 API - 새로운 Excel 형식(종합 시트)으로 내보내기
 * GET /api/bom/export-comprehensive
 * 
 * 새로운 Excel 형식:
 * - 종합 시트: 모품목과 자품목을 같은 형식으로 표시
 * - 모품목 컬럼: 납품처, 차종, 품번, 품명, 단가, 마감수량, 마감금액
 * - 자품목 컬럼: 구매처, 차종, 품번, 품명, U/S, 단가, 구매수량, 구매금액, 비고, KG단가, 단품단가, 재질, 두께, 폭, 길이, SEP, 비중, EA중량, 실적수량, 스크랩중량, 스크랩단가, 스크랩금액
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

interface ComprehensiveBOMRow {
  // 모품목 정보 (A~G)
  납품처?: string;
  차종?: string;
  품번?: string;
  품명?: string;
  단가?: number;
  마감수량?: number;
  마감금액?: number;
  
  // 자품목 정보 (I~Z)
  구매처?: string;
  자품목차종?: string;
  자품목품번?: string;
  자품목품명?: string;
  'U/S'?: number;
  자품목단가?: number;
  구매수량?: number;
  구매금액?: number;
  비고?: string;
  KG단가?: number;
  단품단가?: number;
  재질?: string;
  두께?: number;
  폭?: number;
  길이?: number;
  SEP?: number;
  비중?: number;
  EA중량?: number;
  실적수량?: number;
  스크랩중량?: number;
  스크랩단가?: number;
  스크랩금액?: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const parentItemId = searchParams.get('parent_item_id');
    
    // BOM 데이터 조회
    let query = supabase
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        level_no,
        is_active,
        parent_item:items!bom_parent_item_id_fkey(
          item_id,
          item_code,
          item_name,
          vehicle_model,
          price,
          material,
          thickness,
          width,
          height,
          specific_gravity,
          mm_weight,
          sep,
          kg_unit_price,
          scrap_weight,
          scrap_unit_price,
          actual_quantity,
          supplier_id,
          companies:companies!items_supplier_id_fkey(company_name, company_type)
        ),
        child_item:items!bom_child_item_id_fkey(
          item_id,
          item_code,
          item_name,
          vehicle_model,
          price,
          material,
          thickness,
          width,
          height,
          specific_gravity,
          mm_weight,
          sep,
          kg_unit_price,
          scrap_weight,
          scrap_unit_price,
          actual_quantity,
          supplier_id,
          companies:companies!items_supplier_id_fkey(company_name, company_type)
        )
      `)
      .eq('is_active', true)
      .order('parent_item_id', { ascending: true })
      .order('bom_id', { ascending: true });
    
    if (parentItemId) {
      query = query.eq('parent_item_id', parseInt(parentItemId));
    }
    
    const { data: bomData, error } = await query;
    
    if (error) {
      console.error('BOM 데이터 조회 오류:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    if (!bomData || bomData.length === 0) {
      return NextResponse.json(
        { success: false, error: '내보낼 BOM 데이터가 없습니다.' },
        { status: 404 }
      );
    }
    
    // 모품목별로 그룹화
    const parentGroups = new Map<number, any[]>();
    for (const bom of bomData) {
      if (!bom.parent_item || !bom.child_item) continue;
      
      const parentId = bom.parent_item_id;
      if (!parentGroups.has(parentId)) {
        parentGroups.set(parentId, []);
      }
      parentGroups.get(parentId)!.push(bom);
    }
    
    // 종합 시트 형식으로 변환
    const comprehensiveRows: ComprehensiveBOMRow[] = [];
    
    for (const [parentId, childBoms] of parentGroups) {
      const firstBom = childBoms[0];
      const parentItem = firstBom.parent_item;
      
      // 모품목 행 추가
      const parentRow: ComprehensiveBOMRow = {
        납품처: (parentItem.companies as any)?.company_name || '',
        차종: parentItem.vehicle_model || '',
        품번: parentItem.item_code,
        품명: parentItem.item_name,
        단가: parentItem.price || 0,
        마감수량: 0, // 실제 데이터가 없으면 0
        마감금액: 0
      };
      comprehensiveRows.push(parentRow);
      
      // 자품목 행들 추가
      for (const bom of childBoms) {
        const childItem = bom.child_item;
        const supplier = (childItem.companies as any);
        
        // 스크랩 금액 계산
        const scrapAmount = (childItem.actual_quantity || 0) * 
                          (childItem.scrap_weight || 0) * 
                          (childItem.scrap_unit_price || 0);
        
        const childRow: ComprehensiveBOMRow = {
          구매처: supplier?.company_name || '',
          자품목차종: childItem.vehicle_model || '',
          자품목품번: childItem.item_code,
          자품목품명: childItem.item_name,
          'U/S': bom.quantity_required || 1,
          자품목단가: childItem.price || 0,
          구매수량: 0, // 실제 데이터가 없으면 0
          구매금액: 0,
          비고: '',
          KG단가: childItem.kg_unit_price || 0,
          단품단가: childItem.price || 0,
          재질: childItem.material || '',
          두께: childItem.thickness || 0,
          폭: childItem.width || 0,
          길이: childItem.height || 0,
          SEP: childItem.sep || 1,
          비중: childItem.specific_gravity || 7.85,
          EA중량: childItem.mm_weight || 0,
          실적수량: childItem.actual_quantity || 0,
          스크랩중량: childItem.scrap_weight || 0,
          스크랩단가: childItem.scrap_unit_price || 0,
          스크랩금액: scrapAmount
        };
        comprehensiveRows.push(childRow);
      }
    }
    
    // Excel 워크북 생성
    const workbook = XLSX.utils.book_new();
    
    // 헤더 행 생성 (6행)
    const headerRow = [
      // 모품목 헤더 (A~G)
      '납품처', '차종', '품번', '품명', '단가', '마감수량', '마감금액', '',
      // 자품목 헤더 (I~Z)
      '구매처', '차종', '품번', '품명', 'U/S', '단가', '구매수량', '구매금액', '비고', 
      'KG단가', '단품단가', '재질', '두께', '폭', '길이', 'SEP', '비중', 'EA중량', 
      '실적수량', '스크랩중량', '스크랩단가', '스크랩금액'
    ];
    
    // 데이터 행 변환
    const excelData: any[][] = [];
    excelData.push([]); // 빈 행
    excelData.push([]); // 빈 행
    excelData.push([]); // 빈 행
    excelData.push([]); // 빈 행
    excelData.push([]); // 빈 행
    excelData.push(headerRow); // 헤더 행 (6행)
    
    // 데이터 행 추가
    for (const row of comprehensiveRows) {
      const dataRow: any[] = [
        // 모품목 컬럼 (A~G)
        row.납품처 || '',
        row.차종 || '',
        row.품번 || '',
        row.품명 || '',
        row.단가 || 0,
        row.마감수량 || 0,
        row.마감금액 || 0,
        '', // 빈 컬럼 (H)
        // 자품목 컬럼 (I~Z)
        row.구매처 || '',
        row.자품목차종 || '',
        row.자품목품번 || '',
        row.자품목품명 || '',
        row['U/S'] || 0,
        row.자품목단가 || 0,
        row.구매수량 || 0,
        row.구매금액 || 0,
        row.비고 || '',
        row.KG단가 || 0,
        row.단품단가 || 0,
        row.재질 || '',
        row.두께 || 0,
        row.폭 || 0,
        row.길이 || 0,
        row.SEP || 1,
        row.비중 || 7.85,
        row.EA중량 || 0,
        row.실적수량 || 0,
        row.스크랩중량 || 0,
        row.스크랩단가 || 0,
        row.스크랩금액 || 0
      ];
      excelData.push(dataRow);
    }
    
    // 시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    
    // 컬럼 너비 설정
    worksheet['!cols'] = [
      { wch: 15 }, // A: 납품처
      { wch: 10 }, // B: 차종
      { wch: 15 }, // C: 품번
      { wch: 30 }, // D: 품명
      { wch: 12 }, // E: 단가
      { wch: 12 }, // F: 마감수량
      { wch: 12 }, // G: 마감금액
      { wch: 2 },  // H: 빈 컬럼
      { wch: 15 }, // I: 구매처
      { wch: 10 }, // J: 차종
      { wch: 15 }, // K: 품번
      { wch: 30 }, // L: 품명
      { wch: 8 },  // M: U/S
      { wch: 12 }, // N: 단가
      { wch: 12 }, // O: 구매수량
      { wch: 12 }, // P: 구매금액
      { wch: 20 }, // Q: 비고
      { wch: 12 }, // R: KG단가
      { wch: 12 }, // S: 단품단가
      { wch: 10 }, // T: 재질
      { wch: 8 },  // U: 두께
      { wch: 8 },  // V: 폭
      { wch: 8 },  // W: 길이
      { wch: 6 },  // X: SEP
      { wch: 8 },  // Y: 비중
      { wch: 10 }, // Z: EA중량
      { wch: 12 }, // AA: 실적수량
      { wch: 12 }, // AB: 스크랩중량
      { wch: 12 }, // AC: 스크랩단가
      { wch: 12 }  // AD: 스크랩금액
    ];
    
    // 워크북에 시트 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, '종합');
    
    // 내보내기 정보 시트 추가
    const now = new Date();
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ['BOM 종합 내보내기 정보', ''],
      ['내보낸 날짜', now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })],
      ['총 모품목 수', parentGroups.size],
      ['총 BOM 관계 수', bomData.length],
      ['', ''],
      ['시스템 정보', ''],
      ['시스템명', '태창 ERP 시스템'],
      ['버전', '1.0.0'],
      ['내보내기 형식', 'Excel (XLSX) - 종합 시트 형식']
    ]);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, '내보내기 정보');
    
    // Excel 파일 생성
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });
    
    // 파일명 생성
    const today = new Date().toISOString().split('T')[0];
    const fileName = `BOM_전체_${today}.xlsx`;
    
    // 응답 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    headers.set('Content-Length', excelBuffer.length.toString());
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers
    });
    
  } catch (error: any) {
    console.error('BOM 종합 내보내기 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '내보내기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

