# 코일 자동차감 시스템 종합 가이드

**버전**: 3.0
**작성일**: 2025-12-19
**상태**: Production Ready
**대상**: 사용자 및 개발자

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [세 가지 자동차감 방식](#세-가지-자동차감-방식)
3. [상황별 사용 가이드](#상황별-사용-가이드)
4. [기술 구조](#기술-구조)
5. [실무 시나리오](#실무-시나리오)
6. [FAQ](#faq)

---

## 시스템 개요

### 목적

코일 자동차감 시스템은 제조 공정에서 원자재(코일)가 반제품(시트), 부자재, 완제품으로 변환되는 과정에서 재고를 자동으로 관리하는 시스템입니다.

### 핵심 기능

✅ **자동 재고 이동**: 공정 완료 시 투입재료 차감 및 산출제품 증가  
✅ **BOM 자동 차감**: 완제품 생산 시 원자재 자동 차감  
✅ **이중 검증**: API 레벨 + 데이터베이스 트리거 레벨 검증  
✅ **실시간 반영**: 재고 변동 즉시 반영  
✅ **감사 추적**: 모든 재고 변동 이력 기록

### 전체 제조 흐름

```
코일 (원자재)
  ↓ [공정 작업 등록 또는 간편 등록]
시트 (반제품)
  ↓ [공정 작업 등록 또는 간편 등록]
부자재
  ↓ [생산 등록]
완제품 (BOM에 따라 원자재까지 자동 차감)
```

---

## 세 가지 자동차감 방식

### 1. 공정 작업 등록 방식 (기존)

#### 개요

3단계 프로세스로 작업을 등록하고, 완료 처리 시 재고가 자동으로 이동됩니다.

#### 워크플로우

```
1단계: 공정 작업 등록 (PENDING)
  ↓
2단계: 작업 시작 (IN_PROGRESS)
  ↓
3단계: 작업 완료 (COMPLETED)
  ↓
4단계: 데이터베이스 트리거 자동 실행
  ↓
5단계: 재고 자동 이동
```

#### 사용 방법

##### 1단계: 공정 작업 등록

1. 좌측 메뉴 → **"공정 관리"** 클릭
2. **"공정 작업 등록"** 버튼 클릭
3. 모달 창에서 정보 입력:
   - **공정유형**: "Blanking 공정" 선택
   - **투입재료**: "냉연 코일 1.2T" 선택 (검색 필드에 품목코드 또는 품목명 입력)
   - **투입수량**: 100 입력
   - **산출제품**: "블랭킹 시트" 선택
   - **산출수량**: 95 입력
   - **작업자**: 선택사항
   - **비고**: 선택사항
4. **"간편 등록 모드"** 체크박스 해제 (기본값)
5. **"등록"** 버튼 클릭
6. 결과: 공정 작업이 `PENDING` 상태로 생성됨

##### 2단계: 작업 시작

1. 공정 작업 목록에서 해당 작업 찾기
2. **"작업 시작"** 버튼 클릭
3. 결과: 상태가 `IN_PROGRESS`로 변경됨

##### 3단계: 작업 완료

1. **"작업 완료"** 버튼 클릭
2. 결과:
   - 상태가 `COMPLETED`로 변경됨
   - 데이터베이스 트리거 자동 실행
   - 재고 자동 이동:
     - 코일 재고: `current_stock -= 100`
     - 시트 재고: `current_stock += 95`
   - 재고 이력 자동 기록

#### 특징

- ✅ 작업 진행 상황 추적 가능 (PENDING → IN_PROGRESS → COMPLETED)
- ✅ 작업 시작/완료 시간 기록
- ✅ 작업 수정/취소 가능
- ✅ 작업자별 생산성 분석 가능
- ❌ 등록 시간이 상대적으로 오래 걸림

---

### 2. 간편 등록 방식 (신규 추가)

#### 개요

1단계 프로세스로 작업을 등록하면 즉시 완료 처리되어 재고가 자동으로 이동됩니다.

#### 워크플로우

```
1단계: 간편 등록 모드 활성화
  ↓
2단계: 정보 입력
  ↓
3단계: 저장 버튼 클릭
  ↓
4단계: 즉시 처리 (등록 + 완료 + 재고 이동)
```

#### 사용 방법

##### 1단계: 간편 등록 모드 활성화

1. 좌측 메뉴 → **"공정 관리"** 클릭
2. **"공정 작업 등록"** 버튼 클릭
3. 화면 상단의 **"간편 등록 모드"** 체크박스 선택
   - 체크 시: 입력 즉시 재고 자동 이동
   - 체크 해제 시: 기존 방식 (3단계)

##### 2단계: 정보 입력

1. **공정유형**: "Blanking 공정" 선택
2. **투입재료**: "냉연 코일 1.2T" 선택
   - 검색 필드에 품목코드 또는 품목명의 일부 입력
   - 예: "냉연", "코일", "1.2" 등
3. **투입수량**: 100 입력
4. **산출제품**: "블랭킹 시트" 선택
5. **산출수량**: 95 입력
6. **작업자**, **비고**: 선택사항

##### 3단계: 저장

1. 버튼이 **"간편 등록 (재고 자동 이동)"**으로 표시됨
2. 클릭 시 즉시 처리:
   - 공정 작업 생성 (COMPLETED 상태)
   - 데이터베이스 트리거 자동 실행
   - 재고 자동 이동
   - 성공 메시지 표시

#### 성공 메시지 예시

```
✅ 공정이 등록되고 재고가 자동으로 이동되었습니다!

LOT: BLK-20250121-001
수율: 95.00%

투입재료 재고: 900 개
산출제품 재고: 95 개
```

#### 특징

- ✅ 빠른 등록 (1단계)
- ✅ 즉시 재고 반영
- ✅ 일일 작업량이 많은 경우 효율적
- ❌ 작업 진행 상황 추적 불가
- ❌ 작업 수정/취소 불가

---

### 3. 완제품 생산 BOM 자동 차감 (기존)

#### 개요

완제품 생산 등록 시 BOM(Bill of Materials)에 따라 원자재가 자동으로 차감됩니다.

#### 워크플로우

```
1단계: 생산 등록
  ↓
2단계: BOM 조회
  ↓
3단계: 필요 수량 계산
  ↓
4단계: 재고 검증
  ↓
5단계: 완제품 재고 증가
  ↓
6단계: 원자재 자동 차감
```

#### 사용 방법

##### 1단계: 생산 등록

1. 좌측 메뉴 → **"생산 관리"** 클릭
2. **"생산 등록"** 탭 선택
3. 정보 입력:
   - **거래일자**: 2025-01-20 선택
   - **품목**: "완제품 A" 선택
   - **수량**: 100 입력
   - **단가**: 5000 입력
   - **거래유형**: "생산입고" 선택
4. **"저장"** 버튼 클릭

#### 시스템 동작

1. **BOM 조회**: 완제품의 BOM 구성 확인
   - 예: 완제품 A = 부자재 2개 + 나사 10개 + 기타 부품 1개

2. **필요 수량 계산**:
   - 부자재: 2 × 100 = 200개 필요
   - 나사: 10 × 100 = 1,000개 필요
   - 기타 부품: 1 × 100 = 100개 필요

3. **재고 검증**: 각 원자재 재고 확인

4. **자동 차감**: 재고가 충분하면 자동 차감
   - 부자재 재고: `current_stock -= 200`
   - 나사 재고: `current_stock -= 1,000`
   - 기타 부품 재고: `current_stock -= 100`

5. **완제품 재고 증가**: `current_stock += 100`

6. **차감 로그 기록**: `bom_deduction_log` 테이블에 기록

#### 특징

- ✅ BOM 기반 자동 차감
- ✅ 재고 부족 시 경고 (에러 아님)
- ✅ 최대 생산 가능 수량 계산
- ✅ 차감 로그 자동 기록

---

## 상황별 사용 가이드

### 간편 등록 모드를 사용해야 하는 경우

#### ✅ 1. 작업이 이미 완료된 경우

**상황**: 작업이 끝난 후 나중에 시스템에 등록하는 경우

**예시**:
- 오전에 블랭킹 작업 완료 → 오후에 시스템 등록
- 전날 작업 완료 → 다음날 일괄 등록

**이유**: 작업 진행 상태 추적이 불필요하고 빠른 등록이 필요

---

#### ✅ 2. 일일 작업량이 많은 경우

**상황**: 하루에 수십 건의 작업을 등록해야 하는 경우

**예시**:
- 블랭킹 작업 30건/일
- Press 작업 20건/일

**이유**: 단계를 줄여 등록 시간을 크게 단축

---

#### ✅ 3. 재고 반영이 급한 경우

**상황**: 재고를 즉시 반영해야 하는 경우

**예시**:
- 다음 공정을 바로 시작해야 함
- 재고 현황을 실시간으로 확인해야 함

**이유**: 등록 즉시 재고가 이동되어 다음 작업에 바로 사용 가능

---

#### ✅ 4. 간단한 작업인 경우

**상황**: 복잡한 추적이 필요 없는 단순 작업

**예시**:
- 표준 블랭킹 작업
- 반복적인 Press 작업

**이유**: 상태 관리 오버헤드가 불필요

---

#### ✅ 5. 외주 작업 결과 등록

**상황**: 외부에서 완료된 작업 결과를 등록하는 경우

**예시**:
- 외주 도장 완료품 입고
- 외주 가공 완료품 입고

**이유**: 작업 시작/진행 추적이 불필요

---

### 기존 방식을 사용해야 하는 경우

#### ✅ 1. 작업 진행 상황을 추적해야 하는 경우

**상황**: 작업 시작부터 완료까지 단계별로 관리해야 하는 경우

**예시**:
- 대량 작업 (수일 소요)
- 중요한 고객사 주문
- 품질 관리가 중요한 작업

**이유**: PENDING → IN_PROGRESS → COMPLETED 상태 추적 가능

---

#### ✅ 2. 작업 일정을 관리해야 하는 경우

**상황**: 작업 시작/완료 시점을 기록해야 하는 경우

**예시**:
- 작업 시작 시간 기록
- 작업 완료 시간 기록
- 작업 소요 시간 분석

**이유**: `started_at`, `completed_at` 시간 기록

---

#### ✅ 3. 작업자별 생산성 분석이 필요한 경우

**상황**: 작업자별 작업량/수율을 분석해야 하는 경우

**예시**:
- 작업자 A: 10건/일, 수율 95%
- 작업자 B: 8건/일, 수율 98%

**이유**: 작업 시작/완료 시점과 작업자 정보 추적 가능

---

#### ✅ 4. 작업 취소/수정이 필요한 경우

**상황**: 작업 등록 후 취소하거나 수정해야 하는 경우

**예시**:
- 작업 등록 후 수량 변경
- 작업 시작 전 취소
- 작업 진행 중 중단

**이유**: PENDING 상태에서 수정/취소 가능

---

#### ✅ 5. 배치 작업 관리가 필요한 경우

**상황**: 여러 작업을 그룹으로 관리해야 하는 경우

**예시**:
- 같은 LOT의 여러 작업
- 같은 주문의 여러 작업

**이유**: 작업 상태별 필터링 및 관리 가능

---

#### ✅ 6. 품질 검사가 필요한 경우

**상황**: 작업 완료 전 품질 검사가 필요한 경우

**예시**:
- 작업 완료 후 검사 대기
- 검사 통과 후 재고 반영

**이유**: IN_PROGRESS 상태에서 검사 후 완료 처리

---

## 선택 기준 요약

| 기준 | 간편 등록 | 기존 방식 |
|------|----------|----------|
| 작업 완료 여부 | ✅ 이미 완료 | ❌ 진행 중 |
| 등록 속도 | ✅ 빠름 | ❌ 느림 |
| 진행 추적 필요 | ❌ 불필요 | ✅ 필요 |
| 시간 기록 필요 | ❌ 불필요 | ✅ 필요 |
| 수정/취소 가능 | ❌ 불가 | ✅ 가능 |
| 일일 작업량 | ✅ 많음 (20건+) | ❌ 적음 (<10건) |
| 작업 중요도 | ❌ 낮음 | ✅ 높음 |
| 품질 검사 필요 | ❌ 불필요 | ✅ 필요 |

---

## 실무 시나리오

### 시나리오 1: 일일 블랭킹 작업 등록

**상황**: 하루에 20건의 블랭킹 작업이 완료됨

**추천**: ✅ **간편 등록 모드**

**이유**:
- 작업이 이미 완료됨
- 빠른 등록 필요
- 진행 상태 추적 불필요

**사용 방법**:
1. "간편 등록 모드" 체크
2. 정보 입력 (20건 반복)
3. 저장 버튼 클릭
4. 재고 즉시 반영

---

### 시나리오 2: 대량 주문 작업 관리

**상황**: 고객사 A 주문 (1,000개, 3일 소요)

**추천**: ✅ **기존 방식**

**이유**:
- 작업 진행 상황 추적 필요
- 작업 시작/완료 시간 기록 필요
- 품질 관리 중요

**사용 방법**:
1. "간편 등록 모드" 체크 해제
2. 공정 작업 등록 (PENDING)
3. 작업 시작 시 "작업 시작" 클릭 (IN_PROGRESS)
4. 작업 완료 시 "작업 완료" 클릭 (COMPLETED)
5. 재고 자동 반영

---

### 시나리오 3: 외주 작업 결과 등록

**상황**: 외부 도장 업체에서 완료된 작업 입고

**추천**: ✅ **간편 등록 모드**

**이유**:
- 작업이 이미 완료됨
- 진행 상태 추적 불필요
- 빠른 등록 필요

**사용 방법**:
1. "간편 등록 모드" 체크
2. 정보 입력
3. 저장 버튼 클릭
4. 재고 즉시 반영

---

### 시나리오 4: 실험적 작업 관리

**상황**: 새로운 공정 방법 시험

**추천**: ✅ **기존 방식**

**이유**:
- 작업 진행 상황 추적 필요
- 작업 시작/완료 시간 기록 필요
- 수정/취소 가능성 있음

**사용 방법**:
1. "간편 등록 모드" 체크 해제
2. 공정 작업 등록
3. 작업 시작/완료 단계별 관리
4. 필요 시 수정/취소 가능

---

## 기술 구조

### 1. 데이터베이스 스키마

#### `process_operations` 테이블

```sql
CREATE TABLE process_operations (
  operation_id SERIAL PRIMARY KEY,
  operation_type VARCHAR(20) NOT NULL,  -- BLANKING | PRESS | ASSEMBLY
  input_item_id INTEGER NOT NULL REFERENCES items(item_id),
  output_item_id INTEGER NOT NULL REFERENCES items(item_id),
  input_quantity DECIMAL(15, 2) NOT NULL,
  output_quantity DECIMAL(15, 2) NOT NULL,
  efficiency DECIMAL(5, 2),  -- 수율 (%)
  operator_id INTEGER,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING | IN_PROGRESS | COMPLETED | CANCELLED
  lot_number VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### `items` 테이블

```sql
CREATE TABLE items (
  item_id SERIAL PRIMARY KEY,
  item_code VARCHAR(50) UNIQUE NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  current_stock DECIMAL(15, 2) DEFAULT 0,
  unit VARCHAR(20),
  category VARCHAR(50),
  ...
);
```

#### `stock_history` 테이블

```sql
CREATE TABLE stock_history (
  history_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(item_id),
  reference_type VARCHAR(50),  -- 'process_operation' | 'inventory_transaction'
  reference_id INTEGER,
  quantity_change DECIMAL(15, 2),
  stock_before DECIMAL(15, 2),
  stock_after DECIMAL(15, 2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

### 2. 데이터베이스 트리거

#### 자동 재고 이동 트리거

```sql
CREATE OR REPLACE FUNCTION auto_process_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    -- 투입재료 재고 차감
    UPDATE items 
    SET current_stock = current_stock - NEW.input_quantity,
        updated_at = NOW()
    WHERE item_id = NEW.input_item_id;
    
    -- 산출제품 재고 증가
    UPDATE items 
    SET current_stock = current_stock + NEW.output_quantity,
        updated_at = NOW()
    WHERE item_id = NEW.output_item_id;
    
    -- 재고 이력 기록 (투입재료)
    INSERT INTO stock_history (
      item_id, reference_type, reference_id,
      quantity_change, stock_before, stock_after
    ) VALUES (
      NEW.input_item_id, 'process_operation', NEW.operation_id,
      -NEW.input_quantity,
      (SELECT current_stock FROM items WHERE item_id = NEW.input_item_id) + NEW.input_quantity,
      (SELECT current_stock FROM items WHERE item_id = NEW.input_item_id)
    );
    
    -- 재고 이력 기록 (산출제품)
    INSERT INTO stock_history (
      item_id, reference_type, reference_id,
      quantity_change, stock_before, stock_after
    ) VALUES (
      NEW.output_item_id, 'process_operation', NEW.operation_id,
      NEW.output_quantity,
      (SELECT current_stock FROM items WHERE item_id = NEW.output_item_id) - NEW.output_quantity,
      (SELECT current_stock FROM items WHERE item_id = NEW.output_item_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_process_stock_movement
AFTER INSERT OR UPDATE ON process_operations
FOR EACH ROW
EXECUTE FUNCTION auto_process_stock_movement();
```

---

### 3. API 엔드포인트

#### 기존 방식

- **등록**: `POST /api/process-operations`
- **시작**: `PATCH /api/process-operations/[id]` (status: IN_PROGRESS)
- **완료**: `POST /api/process-operations/[id]/complete`

#### 간편 등록 방식

- **간편 등록**: `POST /api/process-operations/quick`

#### 완제품 생산

- **생산 등록**: `POST /api/inventory/production`

---

### 4. 프론트엔드 컴포넌트

#### `ProcessOperationForm.tsx`

- 공정 작업 등록 폼
- 간편 등록 모드 토글
- 기존 방식/간편 등록 방식 처리

---

## FAQ

### Q1: 간편 등록 모드에서 작업을 수정할 수 있나요?

**A**: 아니요. 간편 등록 모드는 작업을 즉시 COMPLETED 상태로 생성하므로 수정할 수 없습니다. 수정이 필요한 경우 기존 방식을 사용하세요.

---

### Q2: 재고가 부족한 경우 어떻게 되나요?

**A**: 재고가 부족하면 등록이 실패하고 오류 메시지가 표시됩니다. 재고를 확인하고 충분한 재고를 확보한 후 다시 시도하세요.

---

### Q3: 간편 등록 모드에서 작업 이력을 확인할 수 있나요?

**A**: 네, `process_operations` 테이블과 `stock_history` 테이블에 기록됩니다. 다만 작업 진행 상태(PENDING → IN_PROGRESS → COMPLETED)는 추적할 수 없습니다.

---

### Q4: BOM 자동 차감은 언제 사용하나요?

**A**: 완제품을 생산할 때 사용합니다. 생산 관리 → 생산 등록에서 완제품을 등록하면 BOM에 따라 원자재가 자동으로 차감됩니다.

---

### Q5: 두 방식을 혼용해서 사용할 수 있나요?

**A**: 네, 상황에 따라 선택해서 사용할 수 있습니다. 간편 등록 모드는 체크박스로 쉽게 전환할 수 있습니다.

---

### Q6: 작업 시작 시간과 완료 시간은 어떻게 기록되나요?

**A**: 
- **기존 방식**: `started_at`은 작업 시작 시, `completed_at`은 작업 완료 시 기록됩니다.
- **간편 등록 방식**: `started_at`과 `completed_at`이 모두 등록 시점으로 기록됩니다.

---

### Q7: 수율은 어떻게 계산되나요?

**A**: 수율 = (산출수량 ÷ 투입수량) × 100으로 자동 계산됩니다. 예: 투입 100개, 산출 95개 → 수율 95%

---

### Q8: LOT 번호는 어떻게 생성되나요?

**A**: 자동으로 생성됩니다. 형식: `[공정유형]-[날짜]-[순번]`
- 예: `BLK-20250121-001` (Blanking 공정, 2025년 1월 21일, 1번째)

---

## 권장 사용 패턴

### 일반적인 경우 (80% 이상)

✅ **간편 등록 모드 권장**

- 대부분의 작업이 완료 후 등록됨
- 빠른 등록이 효율적
- 진행 상태 추적이 불필요

### 특수한 경우 (20% 이하)

✅ **기존 방식 사용**

- 작업 진행 추적 필요
- 시간 기록 필요
- 수정/취소 가능성 있음

---

## 추가 자동화 기능 (신규)

### 1. 과거 수율 기반 자동 산출수량 계산

**기능**: 투입수량 입력 시 과거 평균 수율을 기반으로 산출수량 자동 계산 및 제안

**사용 방법**:
1. 투입재료와 산출제품 선택
2. 투입수량 입력
3. 시스템이 자동으로 과거 평균 수율 조회
4. 산출수량 필드에 제안값 표시 (회색 텍스트)
5. "적용" 버튼 클릭 또는 직접 수정

**예시**:
- 투입수량: 100 입력
- 과거 평균 수율: 95%
- 제안 산출수량: 95개 (자동 표시)

---

### 2. 코일 스펙 기반 자동 투입수량 계산

**기능**: 코일 스펙이 있는 경우 자동으로 투입수량 계산

**사용 방법**:
1. 투입재료로 코일 선택 (Blanking 공정)
2. 코일 스펙 자동 조회
3. 투입수량 필드에 제안값 표시
4. "적용" 버튼 클릭 또는 직접 수정

**예시**:
- 코일 선택: "냉연 코일 1.2T"
- 코일 스펙: EA중량 0.47kg/개
- 현재 재고: 1000kg
- 제안 투입수량: 2,128개 (자동 계산)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 3.0 | 2025-12-19 | 문서 최신화, API 경로 검증 완료 |
| 2.1 | 2025-01-21 | 자동 계산 기능 추가 (과거 수율, 코일 스펙) |
| 2.0 | 2025-01-21 | 간편 등록 모드 추가 |
| 1.0 | 2025-01-20 | 초기 문서 작성 |

---

## 참고 자료

- [Blanking Process Guide](./BLANKING_PROCESS_GUIDE.md)
- [System Architecture](./SYSTEM_ARCHITECTURE.md)
- [BOM Auto-Deduction System](./SYSTEM_ARCHITECTURE.md#51-bom-자동-차감-시스템-이중-검증)

---

**문서 작성**: Claude (Backend System Architect)
**최종 검토**: 2025-12-19
**문의**: 시스템 관리자

