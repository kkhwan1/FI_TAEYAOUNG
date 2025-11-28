const XLSX = require('xlsx');

const copyFile = '.plan\\(추가)BOM 종합 - ERP (1) copy - 복사본.xlsx';
const updatedFile = '.example\\태창금속 BOM_업데이트.xlsx';
const outputFile = '.example\\태창금속 BOM_완전업데이트.xlsx';

console.log('모든 누락된 데이터를 완전히 추가하는 중...\n');

// 태창금속 파일 읽기
const updatedWb = XLSX.readFile(updatedFile);

// 복사본 파일 읽기
const copyWb = XLSX.readFile(copyFile);

// 시트 이름 매핑
const sheetMapping = {
  '대우당진': '대우공업',
  '대우포승': '대우공업',
  '풍기서산': '풍기산업',
  '인알파코리아 ': '인알파코리아'
};

function extractAllRowsFromCopy(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const headerRow = data[5] || [];
  
  // 모든 컬럼 인덱스 찾기
  const indices = {};
  indices.납품처 = headerRow.findIndex(h => h && String(h).includes('납품처'));
  indices.구매처 = headerRow.findIndex(h => h && String(h).includes('구매처'));
  
  // 모품목 컬럼
  for (let i = 0; i < 7; i++) {
    if (headerRow[i] && String(headerRow[i]).includes('품번')) {
      indices.모품목코드 = i;
    }
    if (headerRow[i] && String(headerRow[i]).includes('품명')) {
      indices.모품목명 = i;
    }
    if (headerRow[i] && String(headerRow[i]).includes('차종')) {
      indices.모차종 = i;
    }
    if (headerRow[i] && String(headerRow[i]).includes('단가')) {
      indices.모단가 = i;
    }
  }
  
  // 자품목 컬럼
  for (let i = 7; i < headerRow.length; i++) {
    if (headerRow[i] && String(headerRow[i]).includes('품번')) {
      indices.자품목코드 = i;
    }
    if (headerRow[i] && String(headerRow[i]).includes('품명')) {
      indices.자품목명 = i;
    }
    if (headerRow[i] && String(headerRow[i]).includes('차종')) {
      indices.자차종 = i;
    }
    if (headerRow[i] && String(headerRow[i]).includes('단가')) {
      indices.자단가 = i;
    }
    if (headerRow[i] && (String(headerRow[i]).includes('U/S') || String(headerRow[i]).includes('소요량'))) {
      indices.소요량 = i;
    }
  }
  
  // 추가 정보 컬럼
  indices.재질 = headerRow.findIndex(h => h && String(h).includes('재질'));
  indices.두께 = headerRow.findIndex(h => h && String(h).includes('두께'));
  indices.폭 = headerRow.findIndex(h => h && String(h).includes('폭'));
  indices.길이 = headerRow.findIndex(h => h && String(h).includes('길이'));
  indices.비중 = headerRow.findIndex(h => h && String(h).includes('비중'));
  indices.EA중량 = headerRow.findIndex(h => h && String(h).includes('EA중량'));
  indices.KG단가 = headerRow.findIndex(h => h && String(h).includes('KG단가'));
  indices.단품단가 = headerRow.findIndex(h => h && String(h).includes('단품단가'));
  indices.SEP = headerRow.findIndex(h => h && String(h).includes('SEP'));
  indices.비고 = headerRow.findIndex(h => h && String(h).includes('비고'));
  indices.업체구분 = headerRow.findIndex(h => h && String(h).includes('업체구분'));
  
  const rows = [];
  
  for (let i = 6; i < data.length; i++) {
    const row = data[i] || [];
    if (!row.some(c => c !== null && c !== '' && c !== undefined)) continue;
    
    const 납품처 = indices.납품처 >= 0 ? String(row[indices.납품처] || '').trim() : '';
    const 모품목코드 = indices.모품목코드 >= 0 ? String(row[indices.모품목코드] || '').trim() : '';
    const 자품목코드 = indices.자품목코드 >= 0 ? String(row[indices.자품목코드] || '').trim() : '';
    const 구매처 = indices.구매처 >= 0 ? String(row[indices.구매처] || '').trim() : '';
    const 소요량 = indices.소요량 >= 0 ? row[indices.소요량] : null;
    
    // 모품목 행에도 자품목 정보가 있을 수 있음 (복사본 파일 형식)
    if (납품처 && 모품목코드) {
      // 자품목 정보도 함께 있는지 확인
      if (구매처 && 자품목코드 && 소요량) {
        const 소요량값 = String(소요량).trim().replace(/,/g, '');
        if (소요량값 && !isNaN(parseFloat(소요량값)) && parseFloat(소요량값) > 0) {
          rows.push({
            type: 'parent_with_child',
            rowIndex: i,
            row: row,
            headerRow: headerRow,
            indices: indices,
            납품처: 납품처,
            모품목코드: 모품목코드,
            모품목명: indices.모품목명 >= 0 ? String(row[indices.모품목명] || '').trim() : '',
            모차종: indices.모차종 >= 0 ? String(row[indices.모차종] || '').trim() : '',
            모단가: indices.모단가 >= 0 ? String(row[indices.모단가] || '').trim() : '',
            구매처: 구매처,
            자품목코드: 자품목코드,
            자품목명: indices.자품목명 >= 0 ? String(row[indices.자품목명] || '').trim() : '',
            자차종: indices.자차종 >= 0 ? String(row[indices.자차종] || '').trim() : '',
            자단가: indices.자단가 >= 0 ? String(row[indices.자단가] || '').trim() : '',
            소요량: 소요량값,
            재질: indices.재질 >= 0 ? String(row[indices.재질] || '').trim() : '',
            두께: indices.두께 >= 0 ? String(row[indices.두께] || '').trim() : '',
            폭: indices.폭 >= 0 ? String(row[indices.폭] || '').trim() : '',
            길이: indices.길이 >= 0 ? String(row[indices.길이] || '').trim() : '',
            비중: indices.비중 >= 0 ? String(row[indices.비중] || '').trim() : '',
            EA중량: indices.EA중량 >= 0 ? String(row[indices.EA중량] || '').trim() : '',
            KG단가: indices.KG단가 >= 0 ? String(row[indices.KG단가] || '').trim() : '',
            단품단가: indices.단품단가 >= 0 ? String(row[indices.단품단가] || '').trim() : '',
            SEP: indices.SEP >= 0 ? String(row[indices.SEP] || '').trim() : '',
            비고: indices.비고 >= 0 ? String(row[indices.비고] || '').trim() : '',
            업체구분: indices.업체구분 >= 0 ? String(row[indices.업체구분] || '').trim() : ''
          });
          continue;
        }
      }
      
      // 모품목 행만 있는 경우
      rows.push({
        type: 'parent_only',
        rowIndex: i,
        row: row,
        headerRow: headerRow,
        indices: indices,
        납품처: 납품처,
        모품목코드: 모품목코드,
        모품목명: indices.모품목명 >= 0 ? String(row[indices.모품목명] || '').trim() : '',
        모차종: indices.모차종 >= 0 ? String(row[indices.모차종] || '').trim() : '',
        모단가: indices.모단가 >= 0 ? String(row[indices.모단가] || '').trim() : ''
      });
    } else if (구매처 && 자품목코드 && 소요량) {
      // 자품목 행만 있는 경우
      const 소요량값 = String(소요량).trim().replace(/,/g, '');
      if (소요량값 && !isNaN(parseFloat(소요량값)) && parseFloat(소요량값) > 0) {
        rows.push({
          type: 'child_only',
          rowIndex: i,
          row: row,
          headerRow: headerRow,
          indices: indices,
          구매처: 구매처,
          자품목코드: 자품목코드,
          자품목명: indices.자품목명 >= 0 ? String(row[indices.자품목명] || '').trim() : '',
          자차종: indices.자차종 >= 0 ? String(row[indices.자차종] || '').trim() : '',
          자단가: indices.자단가 >= 0 ? String(row[indices.자단가] || '').trim() : '',
          소요량: 소요량값,
          재질: indices.재질 >= 0 ? String(row[indices.재질] || '').trim() : '',
          두께: indices.두께 >= 0 ? String(row[indices.두께] || '').trim() : '',
          폭: indices.폭 >= 0 ? String(row[indices.폭] || '').trim() : '',
          길이: indices.길이 >= 0 ? String(row[indices.길이] || '').trim() : '',
          비중: indices.비중 >= 0 ? String(row[indices.비중] || '').trim() : '',
          EA중량: indices.EA중량 >= 0 ? String(row[indices.EA중량] || '').trim() : '',
          KG단가: indices.KG단가 >= 0 ? String(row[indices.KG단가] || '').trim() : '',
          단품단가: indices.단품단가 >= 0 ? String(row[indices.단품단가] || '').trim() : '',
          SEP: indices.SEP >= 0 ? String(row[indices.SEP] || '').trim() : '',
          비고: indices.비고 >= 0 ? String(row[indices.비고] || '').trim() : '',
          업체구분: indices.업체구분 >= 0 ? String(row[indices.업체구분] || '').trim() : ''
        });
      }
    }
  }
  
  return rows;
}

function findExistingEntry(updatedWs, bomEntry, headerRow, indices) {
  const data = XLSX.utils.sheet_to_json(updatedWs, { header: 1, defval: null, raw: true });
  
  for (let i = 6; i < data.length; i++) {
    const row = data[i] || [];
    const row납품처 = indices.납품처 >= 0 ? String(row[indices.납품처] || '').trim() : '';
    const row모품목코드 = indices.모품목코드 >= 0 ? String(row[indices.모품목코드] || '').trim() : '';
    const row구매처 = indices.구매처 >= 0 ? String(row[indices.구매처] || '').trim() : '';
    const row자품목코드 = indices.자품목코드 >= 0 ? String(row[indices.자품목코드] || '').trim() : '';
    const row소요량 = indices.소요량 >= 0 ? row[indices.소요량] : null;
    
    if (row납품처 === bomEntry.납품처 && 
        row모품목코드 === bomEntry.모품목코드 &&
        row구매처 === bomEntry.구매처 &&
        row자품목코드 === bomEntry.자품목코드 &&
        row소요량) {
      const row소요량값 = String(row소요량).trim().replace(/,/g, '');
      const bom소요량값 = String(bomEntry.소요량).trim().replace(/,/g, '');
      if (row소요량값 === bom소요량값 || (parseFloat(row소요량값) > 0 && parseFloat(bom소요량값) > 0)) {
        return { exists: true, rowIndex: i, row: row };
      }
    }
  }
  
  return { exists: false };
}

// 각 시트 처리
const copySheets = copyWb.SheetNames.filter(n => n !== '최신단가');
let totalAdded = 0;

copySheets.forEach(copySheet => {
  const mappedSheet = sheetMapping[copySheet] || copySheet;
  if (!updatedWb.Sheets[mappedSheet]) {
    console.log(`시트 "${mappedSheet}"가 업데이트 파일에 없습니다.`);
    return;
  }
  
  console.log(`\n${mappedSheet} 시트 처리 중...`);
  
  const copyRows = extractAllRowsFromCopy(copyWb, copySheet);
  const updatedWs = updatedWb.Sheets[mappedSheet];
  const updatedData = XLSX.utils.sheet_to_json(updatedWs, { header: 1, defval: null, raw: true });
  const updatedHeader = updatedData[5] || [];
  
  // 업데이트 파일의 컬럼 인덱스
  const updatedIndices = {};
  updatedIndices.납품처 = updatedHeader.findIndex(h => h && String(h).includes('납품처'));
  updatedIndices.구매처 = updatedHeader.findIndex(h => h && String(h).includes('구매처'));
  
  for (let i = 0; i < 7; i++) {
    if (updatedHeader[i] && String(updatedHeader[i]).includes('품번')) {
      updatedIndices.모품목코드 = i;
    }
    if (updatedHeader[i] && String(updatedHeader[i]).includes('품명')) {
      updatedIndices.모품목명 = i;
    }
    if (updatedHeader[i] && String(updatedHeader[i]).includes('차종')) {
      updatedIndices.모차종 = i;
    }
    if (updatedHeader[i] && String(updatedHeader[i]).includes('단가')) {
      updatedIndices.모단가 = i;
    }
  }
  
  for (let i = 7; i < updatedHeader.length; i++) {
    if (updatedHeader[i] && String(updatedHeader[i]).includes('품번')) {
      updatedIndices.자품목코드 = i;
    }
    if (updatedHeader[i] && String(updatedHeader[i]).includes('품명')) {
      updatedIndices.자품목명 = i;
    }
    if (updatedHeader[i] && String(updatedHeader[i]).includes('차종')) {
      updatedIndices.자차종 = i;
    }
    if (updatedHeader[i] && String(updatedHeader[i]).includes('단가')) {
      updatedIndices.자단가 = i;
    }
    if (updatedHeader[i] && (String(updatedHeader[i]).includes('U/S') || String(updatedHeader[i]).includes('소요량'))) {
      updatedIndices.소요량 = i;
    }
  }
  
  updatedIndices.재질 = updatedHeader.findIndex(h => h && String(h).includes('재질'));
  updatedIndices.두께 = updatedHeader.findIndex(h => h && String(h).includes('두께'));
  updatedIndices.폭 = updatedHeader.findIndex(h => h && String(h).includes('폭'));
  updatedIndices.길이 = updatedHeader.findIndex(h => h && String(h).includes('길이'));
  updatedIndices.비중 = updatedHeader.findIndex(h => h && String(h).includes('비중'));
  updatedIndices.EA중량 = updatedHeader.findIndex(h => h && String(h).includes('EA중량'));
  updatedIndices.KG단가 = updatedHeader.findIndex(h => h && String(h).includes('KG단가'));
  updatedIndices.단품단가 = updatedHeader.findIndex(h => h && String(h).includes('단품단가'));
  updatedIndices.SEP = updatedHeader.findIndex(h => h && String(h).includes('SEP'));
  updatedIndices.비고 = updatedHeader.findIndex(h => h && String(h).includes('비고'));
  updatedIndices.업체구분 = updatedHeader.findIndex(h => h && String(h).includes('업체구분'));
  
  let currentParent = null;
  let addedCount = 0;
  const rowsToAdd = [];
  
  // 복사본 파일의 행들을 순회하면서 처리
  for (const copyRow of copyRows) {
    if (copyRow.type === 'parent_only') {
      currentParent = copyRow;
    } else if (copyRow.type === 'child_only' && currentParent) {
      // 자품목 행 처리
      const bomEntry = {
        ...copyRow,
        납품처: currentParent.납품처,
        모품목코드: currentParent.모품목코드,
        모품목명: currentParent.모품목명,
        모차종: currentParent.모차종,
        모단가: currentParent.모단가
      };
      
      const existing = findExistingEntry(updatedWs, bomEntry, updatedHeader, updatedIndices);
      
      if (!existing.exists) {
        // 추가할 행 생성
        const newRow = new Array(updatedHeader.length).fill(null);
        
        // 모품목 정보가 이미 있는지 확인
        let parentRowExists = false;
        for (let i = 6; i < updatedData.length; i++) {
          const row = updatedData[i] || [];
          const row납품처 = updatedIndices.납품처 >= 0 ? String(row[updatedIndices.납품처] || '').trim() : '';
          const row모품목코드 = updatedIndices.모품목코드 >= 0 ? String(row[updatedIndices.모품목코드] || '').trim() : '';
          
          if (row납품처 === bomEntry.납품처 && row모품목코드 === bomEntry.모품목코드) {
            parentRowExists = true;
            break;
          }
        }
        
        // 모품목 행이 없으면 추가
        if (!parentRowExists) {
          const parentRow = new Array(updatedHeader.length).fill(null);
          if (updatedIndices.납품처 >= 0) parentRow[updatedIndices.납품처] = bomEntry.납품처;
          if (updatedIndices.모품목코드 >= 0) parentRow[updatedIndices.모품목코드] = bomEntry.모품목코드;
          if (updatedIndices.모품목명 >= 0) parentRow[updatedIndices.모품목명] = bomEntry.모품목명;
          if (updatedIndices.모차종 >= 0) parentRow[updatedIndices.모차종] = bomEntry.모차종;
          if (updatedIndices.모단가 >= 0) parentRow[updatedIndices.모단가] = bomEntry.모단가;
          rowsToAdd.push({ type: 'parent', row: parentRow });
        }
        
        // 자품목 행 추가
        if (updatedIndices.구매처 >= 0) newRow[updatedIndices.구매처] = bomEntry.구매처;
        if (updatedIndices.자품목코드 >= 0) newRow[updatedIndices.자품목코드] = bomEntry.자품목코드;
        if (updatedIndices.자품목명 >= 0) newRow[updatedIndices.자품목명] = bomEntry.자품목명;
        if (updatedIndices.자차종 >= 0) newRow[updatedIndices.자차종] = bomEntry.자차종;
        if (updatedIndices.자단가 >= 0) newRow[updatedIndices.자단가] = bomEntry.자단가;
        if (updatedIndices.소요량 >= 0) newRow[updatedIndices.소요량] = bomEntry.소요량;
        if (updatedIndices.재질 >= 0) newRow[updatedIndices.재질] = bomEntry.재질;
        if (updatedIndices.두께 >= 0) newRow[updatedIndices.두께] = bomEntry.두께;
        if (updatedIndices.폭 >= 0) newRow[updatedIndices.폭] = bomEntry.폭;
        if (updatedIndices.길이 >= 0) newRow[updatedIndices.길이] = bomEntry.길이;
        if (updatedIndices.비중 >= 0) newRow[updatedIndices.비중] = bomEntry.비중;
        if (updatedIndices.EA중량 >= 0) newRow[updatedIndices.EA중량] = bomEntry.EA중량;
        if (updatedIndices.KG단가 >= 0) newRow[updatedIndices.KG단가] = bomEntry.KG단가;
        if (updatedIndices.단품단가 >= 0) newRow[updatedIndices.단품단가] = bomEntry.단품단가;
        if (updatedIndices.SEP >= 0) newRow[updatedIndices.SEP] = bomEntry.SEP;
        if (updatedIndices.비고 >= 0) newRow[updatedIndices.비고] = bomEntry.비고;
        if (updatedIndices.업체구분 >= 0) newRow[updatedIndices.업체구분] = bomEntry.업체구분;
        
        rowsToAdd.push({ type: 'child', row: newRow });
        addedCount++;
      } else {
        // 기존 행에 상세 정보 업데이트
        const existingRow = existing.row;
        let updated = false;
        
        if (updatedIndices.재질 >= 0 && copyRow.재질 && !existingRow[updatedIndices.재질]) {
          existingRow[updatedIndices.재질] = copyRow.재질;
          updated = true;
        }
        if (updatedIndices.두께 >= 0 && copyRow.두께 && !existingRow[updatedIndices.두께]) {
          existingRow[updatedIndices.두께] = copyRow.두께;
          updated = true;
        }
        if (updatedIndices.폭 >= 0 && copyRow.폭 && !existingRow[updatedIndices.폭]) {
          existingRow[updatedIndices.폭] = copyRow.폭;
          updated = true;
        }
        if (updatedIndices.길이 >= 0 && copyRow.길이 && !existingRow[updatedIndices.길이]) {
          existingRow[updatedIndices.길이] = copyRow.길이;
          updated = true;
        }
        if (updatedIndices.비중 >= 0 && copyRow.비중 && !existingRow[updatedIndices.비중]) {
          existingRow[updatedIndices.비중] = copyRow.비중;
          updated = true;
        }
        if (updatedIndices.EA중량 >= 0 && copyRow.EA중량 && !existingRow[updatedIndices.EA중량]) {
          existingRow[updatedIndices.EA중량] = copyRow.EA중량;
          updated = true;
        }
      }
    } else if (copyRow.type === 'parent_with_child') {
      // 모품목과 자품목이 함께 있는 행
      const bomEntry = copyRow;
      const existing = findExistingEntry(updatedWs, bomEntry, updatedHeader, updatedIndices);
      
      if (!existing.exists) {
        // 모품목 행 추가
        const parentRow = new Array(updatedHeader.length).fill(null);
        if (updatedIndices.납품처 >= 0) parentRow[updatedIndices.납품처] = bomEntry.납품처;
        if (updatedIndices.모품목코드 >= 0) parentRow[updatedIndices.모품목코드] = bomEntry.모품목코드;
        if (updatedIndices.모품목명 >= 0) parentRow[updatedIndices.모품목명] = bomEntry.모품목명;
        if (updatedIndices.모차종 >= 0) parentRow[updatedIndices.모차종] = bomEntry.모차종;
        if (updatedIndices.모단가 >= 0) parentRow[updatedIndices.모단가] = bomEntry.모단가;
        rowsToAdd.push({ type: 'parent', row: parentRow });
        
        // 자품목 행 추가
        const childRow = new Array(updatedHeader.length).fill(null);
        if (updatedIndices.구매처 >= 0) childRow[updatedIndices.구매처] = bomEntry.구매처;
        if (updatedIndices.자품목코드 >= 0) childRow[updatedIndices.자품목코드] = bomEntry.자품목코드;
        if (updatedIndices.자품목명 >= 0) childRow[updatedIndices.자품목명] = bomEntry.자품목명;
        if (updatedIndices.자차종 >= 0) childRow[updatedIndices.자차종] = bomEntry.자차종;
        if (updatedIndices.자단가 >= 0) childRow[updatedIndices.자단가] = bomEntry.자단가;
        if (updatedIndices.소요량 >= 0) childRow[updatedIndices.소요량] = bomEntry.소요량;
        if (updatedIndices.재질 >= 0) childRow[updatedIndices.재질] = bomEntry.재질;
        if (updatedIndices.두께 >= 0) childRow[updatedIndices.두께] = bomEntry.두께;
        if (updatedIndices.폭 >= 0) childRow[updatedIndices.폭] = bomEntry.폭;
        if (updatedIndices.길이 >= 0) childRow[updatedIndices.길이] = bomEntry.길이;
        if (updatedIndices.비중 >= 0) childRow[updatedIndices.비중] = bomEntry.비중;
        if (updatedIndices.EA중량 >= 0) childRow[updatedIndices.EA중량] = bomEntry.EA중량;
        if (updatedIndices.KG단가 >= 0) childRow[updatedIndices.KG단가] = bomEntry.KG단가;
        if (updatedIndices.단품단가 >= 0) childRow[updatedIndices.단품단가] = bomEntry.단품단가;
        if (updatedIndices.SEP >= 0) childRow[updatedIndices.SEP] = bomEntry.SEP;
        if (updatedIndices.비고 >= 0) childRow[updatedIndices.비고] = bomEntry.비고;
        if (updatedIndices.업체구분 >= 0) childRow[updatedIndices.업체구분] = bomEntry.업체구분;
        
        rowsToAdd.push({ type: 'child', row: childRow });
        addedCount++;
      }
    }
  }
  
  // 행들을 데이터에 추가
  rowsToAdd.forEach(({ row }) => {
    updatedData.push(row);
  });
  
  // 워크시트 업데이트
  const newRange = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: updatedHeader.length - 1, r: updatedData.length - 1 }
  });
  
  const newWs = XLSX.utils.aoa_to_sheet(updatedData);
  newWs['!ref'] = newRange;
  
  updatedWb.Sheets[mappedSheet] = newWs;
  totalAdded += addedCount;
  console.log(`  ${addedCount}개 항목 추가`);
});

// 파일 저장
XLSX.writeFile(updatedWb, outputFile);
console.log(`\n완전 업데이트 완료: ${totalAdded}개 항목 추가`);
console.log(`파일 저장: ${outputFile}`);

