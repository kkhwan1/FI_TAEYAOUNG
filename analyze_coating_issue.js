const XLSX = require('xlsx');

const file = '.plan\\(추가)BOM 종합 - ERP (1) copy - 복사본.xlsx';
const wb = XLSX.readFile(file);

console.log('인알파코리아 시트에서 "도장" 관련 항목 분석\n');

const sheetName = '인알파코리아 ';
const ws = wb.Sheets[sheetName];
if (!ws) {
  console.log('시트를 찾을 수 없습니다.');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
const headerRow = data[5] || [];

console.log('헤더 행 (6번째 행):');
console.log(headerRow.map((h, i) => `${i + 1}. ${h || '(빈칸)'}`).join('\n'));
console.log('\n' + '='.repeat(80) + '\n');

// 도장, 출고, 협력업체 등의 키워드 찾기
console.log('도장/출고/협력업체 관련 행 검색:\n');

let coatingRows = [];
let companyTypeRows = [];

for (let i = 6; i < Math.min(data.length, 150); i++) {
  const row = data[i] || [];
  const rowStr = row.map(c => String(c || '')).join(' ');
  
  // 도장 관련
  if (/도장|coating|painting/i.test(rowStr)) {
    coatingRows.push({ rowNum: i + 1, row });
  }
  
  // 출고 관련
  if (/출고|출하|delivery|ship/i.test(rowStr)) {
    coatingRows.push({ rowNum: i + 1, row, type: '출고' });
  }
  
  // 협력업체/업체구분 관련
  if (/협력업체|업체구분|company|supplier/i.test(rowStr)) {
    companyTypeRows.push({ rowNum: i + 1, row });
  }
}

if (coatingRows.length > 0) {
  console.log(`도장/출고 관련 행 (${coatingRows.length}개):\n`);
  coatingRows.forEach(({ rowNum, row, type }) => {
    console.log(`행 ${rowNum} (${type || '일반'}):`);
    headerRow.forEach((header, idx) => {
      const value = row[idx];
      if (value !== null && value !== undefined && value !== '') {
        console.log(`  ${header || `컬럼${idx + 1}`}: ${value}`);
      }
    });
    console.log('');
  });
} else {
  console.log('도장/출고 관련 행을 찾을 수 없습니다.\n');
}

if (companyTypeRows.length > 0) {
  console.log(`\n업체구분 관련 행 (처음 10개만):\n`);
  companyTypeRows.slice(0, 10).forEach(({ rowNum, row }) => {
    console.log(`행 ${rowNum}:`);
    headerRow.forEach((header, idx) => {
      const value = row[idx];
      if (value !== null && value !== undefined && value !== '') {
        const headerStr = String(header || `컬럼${idx + 1}`);
        const valueStr = String(value);
        if (/협력업체|업체|구매처|납품처|도장|출고/i.test(headerStr) || /협력업체|도장|출고/i.test(valueStr)) {
          console.log(`  ${headerStr}: ${valueStr}`);
        }
      }
    });
    console.log('');
  });
}

// 업체구분 컬럼 찾기
const companyTypeColIdx = headerRow.findIndex(h => 
  h && String(h).includes('업체구분')
);

if (companyTypeColIdx >= 0) {
  console.log(`\n업체구분 컬럼 (${companyTypeColIdx + 1}번 컬럼: "${headerRow[companyTypeColIdx]}")의 값 분포:\n`);
  
  const values = new Map();
  for (let i = 6; i < data.length; i++) {
    const row = data[i] || [];
    const value = row[companyTypeColIdx];
    if (value !== null && value !== undefined && value !== '') {
      const valueStr = String(value).trim();
      values.set(valueStr, (values.get(valueStr) || 0) + 1);
    }
  }
  
  console.log('값별 개수:');
  Array.from(values.entries()).sort((a, b) => b[1] - a[1]).forEach(([value, count]) => {
    console.log(`  "${value}": ${count}개`);
  });
  
  // "도장"이나 "출고" 관련 값 확인
  const coatingValues = Array.from(values.keys()).filter(v => 
    /도장|출고|coating|delivery/i.test(v)
  );
  
  if (coatingValues.length > 0) {
    console.log(`\n도장/출고 관련 값:\n`);
    coatingValues.forEach(value => {
      console.log(`  "${value}": ${values.get(value)}개`);
      // 해당 값을 가진 행 예시 찾기
      for (let i = 6; i < Math.min(data.length, 50); i++) {
        const row = data[i] || [];
        if (String(row[companyTypeColIdx] || '').trim() === value) {
          const 구매처Idx = headerRow.findIndex(h => h && String(h).includes('구매처'));
          const 자품목코드Idx = headerRow.findIndex((h, idx) => idx >= 7 && h && String(h).includes('품번'));
          const 자품목명Idx = headerRow.findIndex((h, idx) => idx >= 7 && h && String(h).includes('품명'));
          
          console.log(`    예시 행 ${i + 1}:`);
          if (구매처Idx >= 0) console.log(`      구매처: ${row[구매처Idx] || '(없음)'}`);
          if (자품목코드Idx >= 0) console.log(`      자품목코드: ${row[자품목코드Idx] || '(없음)'}`);
          if (자품목명Idx >= 0) console.log(`      자품목명: ${row[자품목명Idx] || '(없음)'}`);
          break;
        }
      }
      console.log('');
    });
  }
}

