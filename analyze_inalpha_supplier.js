const XLSX = require('xlsx');

const file = '.plan\\(추가)BOM 종합 - ERP (1) copy - 복사본.xlsx';
const wb = XLSX.readFile(file);

console.log('구매처가 "인알파코리아"인 항목들의 업체구분 분석\n');

const sheetName = '인알파코리아 ';
const ws = wb.Sheets[sheetName];
if (!ws) {
  console.log('시트를 찾을 수 없습니다.');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
const headerRow = data[5] || [];

// 컬럼 인덱스 찾기
const 구매처Idx = headerRow.findIndex(h => h && String(h).includes('구매처'));
const 업체구분Idx = headerRow.findIndex(h => h && String(h).includes('업체구분'));
const 납품처Idx = headerRow.findIndex(h => h && String(h).includes('납품처'));
const 모품번Idx = headerRow.findIndex((h, idx) => idx < 7 && h && String(h).includes('품번'));
const 자품번Idx = headerRow.findIndex((h, idx) => idx >= 7 && h && String(h).includes('품번'));
const 자품명Idx = headerRow.findIndex((h, idx) => idx >= 7 && h && String(h).includes('품명'));

console.log(`구매처 컬럼: ${구매처Idx + 1}번 (${headerRow[구매처Idx]})`);
console.log(`업체구분 컬럼: ${업체구분Idx >= 0 ? 업체구분Idx + 1 + '번 (' + headerRow[업체구분Idx] + ')' : '없음'}`);
console.log(`납품처 컬럼: ${납품처Idx + 1}번 (${headerRow[납품처Idx]})\n`);

// 구매처가 "인알파코리아"인 항목들 찾기
const inalphaRows = [];

for (let i = 6; i < data.length; i++) {
  const row = data[i] || [];
  const 구매처 = 구매처Idx >= 0 ? String(row[구매처Idx] || '').trim() : '';
  const 업체구분 = 업체구분Idx >= 0 ? String(row[업체구분Idx] || '').trim() : '';
  
  if (구매처 && 구매처.includes('인알파코리아')) {
    const 납품처 = 납품처Idx >= 0 ? String(row[납품처Idx] || '').trim() : '';
    const 모품번 = 모품번Idx >= 0 ? String(row[모품번Idx] || '').trim() : '';
    const 자품번 = 자품번Idx >= 0 ? String(row[자품번Idx] || '').trim() : '';
    const 자품명 = 자품명Idx >= 0 ? String(row[자품명Idx] || '').trim() : '';
    
    inalphaRows.push({
      rowNum: i + 1,
      납품처,
      모품번,
      구매처,
      자품번,
      자품명,
      업체구분: 업체구분 || '(없음)'
    });
  }
}

console.log(`구매처가 "인알파코리아"인 항목: ${inalphaRows.length}개\n`);

// 업체구분별로 그룹화
const byCompanyType = new Map();
inalphaRows.forEach(row => {
  const type = row.업체구분 || '(없음)';
  if (!byCompanyType.has(type)) {
    byCompanyType.set(type, []);
  }
  byCompanyType.get(type).push(row);
});

console.log('업체구분별 분포:');
Array.from(byCompanyType.entries()).sort((a, b) => b[1].length - a[1].length).forEach(([type, rows]) => {
  console.log(`  "${type}": ${rows.length}개`);
});

// 업체구분이 없는 경우 상세 정보
const noCompanyType = inalphaRows.filter(r => !r.업체구분 || r.업체구분 === '(없음)');
if (noCompanyType.length > 0) {
  console.log(`\n업체구분이 없는 항목 (처음 10개):`);
  noCompanyType.slice(0, 10).forEach(row => {
    console.log(`  행 ${row.rowNum}: 모품번=${row.모품번}, 자품번=${row.자품번}, 자품명=${row.자품명}`);
  });
}

// 납품처도 "인알파코리아"인 경우 확인
const bothInalpha = inalphaRows.filter(r => r.납품처 && r.납품처.includes('인알파코리아'));
console.log(`\n납품처도 "인알파코리아"인 항목: ${bothInalpha.length}개`);
if (bothInalpha.length > 0) {
  console.log('처음 5개 예시:');
  bothInalpha.slice(0, 5).forEach(row => {
    console.log(`  행 ${row.rowNum}: 모품번=${row.모품번}, 자품번=${row.자품번}, 업체구분=${row.업체구분}`);
  });
}

