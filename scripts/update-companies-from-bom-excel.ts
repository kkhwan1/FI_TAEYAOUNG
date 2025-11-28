/**
 * BOM Excel 파일에서 거래처 정보 추출 및 업데이트 스크립트
 * 
 * BOM Excel 파일의 납품처(고객사)와 구매처명(공급사)을 추출하여
 * companies 테이블에 업데이트합니다.
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
// 하드코딩된 매핑 제거 - DB에서 동적으로 조회

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Excel 파일 경로
const filePath = path.join(__dirname, '..', '.example', '(추가)BOM 종합 - ERP (1).xlsx');

interface CompanyInfo {
  company_name: string;
  company_type: '고객사' | '공급사';
  is_customer: boolean;
  is_supplier: boolean;
}

/**
 * BOM Excel 파일에서 거래처 정보 추출
 */
async function extractCompaniesFromExcel(filePath: string): Promise<Map<string, CompanyInfo>> {
  console.log(`Reading Excel file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);

  const companies = new Map<string, CompanyInfo>();

  // 각 시트 처리
  for (const sheetName of workbook.SheetNames) {
    if (sheetName === '종합') continue;

    console.log(`\nProcessing sheet: ${sheetName}`);

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(sheet, { range: 5, defval: '' });

    for (const row of data) {
      // 납품처 (고객사) 추출
      const 납품처 = String(row['납품처'] || '').trim();
      if (납품처 && 납품처 !== '') {
        if (!companies.has(납품처)) {
          companies.set(납품처, {
            company_name: 납품처,
            company_type: '고객사',
            is_customer: true,
            is_supplier: false,
          });
        } else {
          const existing = companies.get(납품처)!;
          if (!existing.is_customer) {
            existing.is_customer = true;
            // 고객사이면서 공급사인 경우 공급사로 유지 (협력사 제거)
            existing.company_type = existing.is_supplier ? '공급사' : '고객사';
          }
        }
      }

      // 구매처명 (공급사) 추출
      const 구매처명 = String(row['구매처'] || '').trim();
      if (구매처명 && 구매처명 !== '' && 구매처명 !== '사급') {
        if (!companies.has(구매처명)) {
          companies.set(구매처명, {
            company_name: 구매처명,
            company_type: '공급사',
            is_customer: false,
            is_supplier: true,
          });
        } else {
          const existing = companies.get(구매처명)!;
          if (!existing.is_supplier) {
            existing.is_supplier = true;
            // 고객사이면서 공급사인 경우 공급사로 변경 (협력사 제거)
            existing.company_type = '공급사';
          }
        }
      }
    }
  }

  return companies;
}

/**
 * company_code 생성 함수 (API route와 동일한 로직)
 */
async function generateCompanyCode(companyType: '고객사' | '공급사'): Promise<string> {
  // company_type에 따라 prefix 결정
  const prefixMap: Record<string, string> = {
    '고객사': 'CUS',
    '공급사': 'SUP'
  };

  const prefix = prefixMap[companyType] || 'SUP';

  // 같은 prefix로 시작하는 기존 코드 조회
  const { data: existingCodes, error: codeError } = await supabase
    .from('companies')
    .select('company_code')
    .like('company_code', `${prefix}%`)
    .order('company_code', { ascending: false });

  if (codeError) {
    console.warn(`Warning: Error fetching existing codes: ${codeError.message}`);
  }

  let nextNumber = 1;
  if (existingCodes && existingCodes.length > 0) {
    // 가장 큰 숫자 찾기
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

  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

/**
 * 거래처 정보를 데이터베이스에 업데이트
 */
async function updateCompanies(companies: Map<string, CompanyInfo>): Promise<void> {
  console.log(`\nUpdating ${companies.size} companies...`);

  const companiesArray = Array.from(companies.values());
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const company of companiesArray) {
    try {
      // 기존 거래처 확인
      const { data: existing, error: fetchError } = await supabase
        .from('companies')
        .select('company_id, company_name, company_type, company_code')
        .eq('company_name', company.company_name)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
        console.error(`Error fetching company ${company.company_name}:`, fetchError);
        skippedCount++;
        continue;
      }

      if (existing) {
        // 기존 거래처 업데이트
        // company_type이 변경되거나 업데이트가 필요한 경우만 업데이트
        const companyData: any = {
          is_active: true,
        };

        // company_type이 변경되는 경우만 업데이트
        if (existing.company_type !== company.company_type) {
          companyData.company_type = company.company_type;
        }

        // 업데이트할 데이터가 있는 경우만 업데이트
        if (Object.keys(companyData).length > 1) { // is_active 외에 다른 필드가 있는 경우
          const { error: updateError } = await supabase
            .from('companies')
            .update(companyData)
            .eq('company_id', existing.company_id);

          if (updateError) {
            console.error(`Error updating company ${company.company_name}:`, updateError);
            skippedCount++;
          } else {
            updatedCount++;
            console.log(`  ✓ Updated: ${company.company_name} (${company.company_type})`);
          }
        } else {
          skippedCount++;
          console.log(`  - Skipped: ${company.company_name} (already ${company.company_type})`);
        }
      } else {
        // 새 거래처 추가 - company_code 생성 필요
        const company_code = await generateCompanyCode(company.company_type);

        const companyData = {
          company_code,
          company_name: company.company_name,
          company_type: company.company_type,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from('companies')
          .insert(companyData);

        if (insertError) {
          console.error(`Error inserting company ${company.company_name}:`, insertError);
          skippedCount++;
        } else {
          insertedCount++;
          console.log(`  + Inserted: ${company.company_name} (${company.company_type}, ${company_code})`);
        }
      }
    } catch (error) {
      console.error(`Error processing company ${company.company_name}:`, error);
      skippedCount++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total companies found: ${companies.size}`);
  console.log(`Inserted: ${insertedCount}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

/**
 * 기존 DB의 '협력사' 타입을 '공급사'로 변경
 */
async function updateExistingCooperationCompanies(): Promise<void> {
  console.log('\n=== 기존 협력사 타입을 공급사로 변경 ===');
  
  const { data: cooperationCompanies, error: fetchError } = await supabase
    .from('companies')
    .select('company_id, company_name, company_type')
    .eq('company_type', '협력사');

  if (fetchError) {
    console.error('Error fetching cooperation companies:', fetchError);
    return;
  }

  if (!cooperationCompanies || cooperationCompanies.length === 0) {
    console.log('  - 변경할 협력사가 없습니다.');
    return;
  }

  console.log(`  - ${cooperationCompanies.length}개의 협력사를 공급사로 변경합니다.`);

  let updatedCount = 0;
  for (const company of cooperationCompanies) {
    const { error: updateError } = await supabase
      .from('companies')
      .update({ company_type: '공급사', updated_at: new Date().toISOString() })
      .eq('company_id', company.company_id);

    if (updateError) {
      console.error(`  ✗ Error updating ${company.company_name}:`, updateError);
    } else {
      updatedCount++;
      console.log(`  ✓ Updated: ${company.company_name} (협력사 → 공급사)`);
    }
  }

  console.log(`\n  총 ${updatedCount}개의 협력사가 공급사로 변경되었습니다.`);
}

/**
 * 메인 함수
 */
async function main() {
  try {
    console.log('=== BOM Excel에서 거래처 정보 추출 및 업데이트 ===\n');

    // 먼저 기존 DB의 '협력사' 타입을 '공급사'로 변경
    await updateExistingCooperationCompanies();

    // Excel 파일에서 거래처 정보 추출
    const companies = await extractCompaniesFromExcel(filePath);

    console.log(`\nExtracted ${companies.size} unique companies:`);
    companies.forEach((company, name) => {
      console.log(`  - ${name}: ${company.company_type}`);
    });

    // 데이터베이스 업데이트
    await updateCompanies(companies);

    console.log('\n✓ 거래처 업데이트 완료');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main();

