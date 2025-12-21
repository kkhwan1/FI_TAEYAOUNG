import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

type CompanyOption = {
  company_id: number;
  company_name: string;
  company_code: string | null;
};

/**
 * GET /api/companies/options
 *
 * 거래처 필터링용 옵션 목록 조회
 * Returns company list for dropdown filtering with caching
 *
 * 성능 최적화:
 * - ETag 기반 캐싱 (304 Not Modified)
 * - Cache-Control 헤더 (5분 캐싱, 10분 stale-while-revalidate)
 * - 필요한 필드만 선택 (company_id, company_name, company_code)
 */
export async function GET(request: Request) {
  try {
    // type 파라미터 읽기 (CUSTOMER, SUPPLIER)
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    let query = supabaseAdmin
      .from('companies')
      .select('company_id, company_name, company_code, company_type')
      .eq('is_active', true);

    // type에 따라 필터링 추가
    // CUSTOMER: BOM 테이블의 customer_id로 연결된 회사들을 고객사로 인식
    // (DB의 company_type이 '공급사'로 되어 있어도 BOM에서 고객사로 사용 중인 경우)
    if (type === 'CUSTOMER') {
      // BOM 테이블에서 customer_id로 사용되는 회사들 조회
      const { data: customerData, error: customerError } = await supabaseAdmin
        .from('bom')
        .select('customer_id')
        .not('customer_id', 'is', null);

      if (customerError) throw customerError;

      // 중복 제거하여 customer_id 목록 생성 (null 제외)
      const customerIds = [...new Set(
        (customerData || [])
          .map(b => b.customer_id)
          .filter((id): id is number => id !== null && id !== undefined)
      )];

      if (customerIds.length > 0) {
        query = query.in('company_id', customerIds);
      } else {
        // 고객사가 없는 경우 빈 배열 반환
        return NextResponse.json({
          success: true,
          data: []
        });
      }
    } else if (type === 'SUPPLIER') {
      query = query.in('company_type', ['공급사', '협력사']);
    }

    const { data, error } = await query.order('company_name', { ascending: true });

    if (error) throw error;

    // Null-safe 데이터 매핑
    const companies = (data || []).map((company: CompanyOption) => ({
      company_id: company.company_id,
      company_name: company.company_name ?? '미등록 거래처',
      company_code: company.company_code ?? null,
      label: `${company.company_name ?? '미등록 거래처'} (${company.company_code ?? '코드 없음'})`
    }));

    // ETag 생성 (데이터 해시 기반)
    const dataString = JSON.stringify(companies);
    const etag = `"${crypto.createHash('md5').update(dataString).digest('hex')}"`;

    // ETag 비교 (304 Not Modified 응답)
    const clientEtag = request.headers.get('If-None-Match');
    if (clientEtag === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Cache-Control': 'max-age=300, stale-while-revalidate=600',
          'ETag': etag
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: companies
    }, {
      headers: {
        // 5분 캐싱, 10분 동안 stale content 허용
        'Cache-Control': 'max-age=300, stale-while-revalidate=600',
        'ETag': etag,
        // CORS 헤더 (필터 컴포넌트 접근 허용)
        'Access-Control-Expose-Headers': 'ETag'
      }
    });
  } catch (error) {
    console.error('거래처 목록 조회 실패:', error);
    return NextResponse.json({
      success: false,
      error: '거래처 목록을 불러오지 못했습니다.'
    }, { status: 500 });
  }
}
