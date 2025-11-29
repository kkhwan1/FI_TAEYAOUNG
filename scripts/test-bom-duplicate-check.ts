/**
 * BOM 중복 체크 테스트 스크립트
 * 호원오토 관련 BOM 데이터를 찾아 동일한 데이터를 입력하여 중복 체크가 작동하는지 확인
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// 환경 변수 로드
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBomDuplicateCheck() {
  try {
    console.log('=== BOM 중복 체크 테스트 시작 ===\n');

    // 1. 호원오토 회사 ID 찾기
    console.log('1. 호원오토 회사 ID 찾기...');
    const { data: hoWonCompany, error: companyError } = await supabase
      .from('companies')
      .select('company_id, company_name')
      .ilike('company_name', '%호원오토%')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (companyError || !hoWonCompany) {
      console.error('호원오토 회사를 찾을 수 없습니다:', companyError);
      return;
    }

    console.log(`   발견: ${hoWonCompany.company_name} (ID: ${hoWonCompany.company_id})\n`);

    // 2. 호원오토 관련 BOM 데이터 찾기
    console.log('2. 호원오토 관련 BOM 데이터 찾기...');
    const { data: bomEntries, error: bomError } = await supabase
      .from('bom')
      .select('bom_id, parent_item_id, child_item_id, quantity_required, customer_id, child_supplier_id, level_no')
      .eq('customer_id', hoWonCompany.company_id)
      .eq('is_active', true)
      .limit(1);

    if (bomError || !bomEntries || bomEntries.length === 0) {
      console.error('호원오토 관련 BOM 데이터를 찾을 수 없습니다:', bomError);
      return;
    }

    const testBom = bomEntries[0];
    console.log(`   발견: BOM ID ${testBom.bom_id}`);
    console.log(`   - 부모 품목 ID: ${testBom.parent_item_id}`);
    console.log(`   - 자식 품목 ID: ${testBom.child_item_id}`);
    console.log(`   - 수량: ${testBom.quantity_required}`);
    console.log(`   - 납품처 ID: ${testBom.customer_id}`);
    console.log(`   - 공급처 ID: ${testBom.child_supplier_id || 'null'}`);
    console.log(`   - 레벨: ${testBom.level_no}\n`);

    // 3. 동일한 데이터로 중복 입력 시도
    console.log('3. 동일한 BOM 데이터로 중복 입력 시도...');
    const duplicateBomData = {
      parent_item_id: testBom.parent_item_id,
      child_item_id: testBom.child_item_id,
      quantity_required: testBom.quantity_required,
      customer_id: testBom.customer_id,
      child_supplier_id: testBom.child_supplier_id || null,
      level_no: testBom.level_no
    };

    // API 엔드포인트로 직접 호출 (로컬 서버가 실행 중인 경우)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const response = await fetch(`${apiUrl}/api/bom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(duplicateBomData),
    });

    const result = await response.json();

    if (response.status === 409) {
      console.log('   ✅ 중복 체크 성공!');
      console.log(`   에러 메시지: ${result.error}`);
      if (result.duplicate_bom_id) {
        console.log(`   중복된 BOM ID: ${result.duplicate_bom_id}`);
      }
    } else if (response.status === 200 || response.status === 201) {
      console.log('   ❌ 중복 체크 실패! 동일한 데이터가 추가되었습니다.');
      console.log(`   응답: ${JSON.stringify(result, null, 2)}`);
      
      // 추가된 데이터 삭제 (정리)
      if (result.data && result.data.bom_id) {
        console.log(`\n4. 테스트 데이터 정리 중... (BOM ID: ${result.data.bom_id})`);
        await supabase
          .from('bom')
          .update({ is_active: false })
          .eq('bom_id', result.data.bom_id);
        console.log('   정리 완료');
      }
    } else {
      console.log('   ⚠️ 예상치 못한 응답');
      console.log(`   상태 코드: ${response.status}`);
      console.log(`   응답: ${JSON.stringify(result, null, 2)}`);
    }

    console.log('\n=== 테스트 완료 ===');

  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  }
}

// 스크립트 실행
testBomDuplicateCheck();

