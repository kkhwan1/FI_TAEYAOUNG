-- =====================================================
-- BOM 자동 원자재 차감 트리거 마이그레이션
--
-- 작성일: 2025-11-24
-- 목적: 생산입고 시 BOM 기반 원자재 자동 차감
--
-- 기능:
--   1. 생산입고 거래 발생 시 BOM 조회
--   2. 자품목(원자재) 재고 자동 차감
--   3. bom_deduction_log에 차감 이력 기록
--   4. 다단계 BOM 지원 (재귀적 차감)
-- =====================================================

-- =====================================================
-- 1. BOM 원자재 자동 차감 함수
-- =====================================================

CREATE OR REPLACE FUNCTION auto_deduct_bom_materials()
RETURNS TRIGGER AS $$
DECLARE
    v_bom_record RECORD;
    v_deduct_qty NUMERIC;
    v_stock_before NUMERIC;
    v_stock_after NUMERIC;
    v_production_qty NUMERIC;
    v_parent_item_id INTEGER;
BEGIN
    -- 생산입고(생산완료) 거래만 처리
    IF NEW.transaction_type != '생산입고' THEN
        RETURN NEW;
    END IF;

    -- 생산 수량 및 생산된 품목 ID 추출
    v_production_qty := COALESCE(NEW.quantity, 0);
    v_parent_item_id := NEW.item_id;

    -- 생산 수량이 0 이하면 처리 안함
    IF v_production_qty <= 0 THEN
        RETURN NEW;
    END IF;

    -- BOM에서 해당 모품목의 자품목 목록 조회 (레벨 1만 - 직접 자품목)
    FOR v_bom_record IN
        SELECT
            b.bom_id,
            b.parent_item_id,
            b.child_item_id,
            b.quantity_required,
            b.level_no,
            i.current_stock,
            i.item_code,
            i.item_name
        FROM bom b
        INNER JOIN items i ON b.child_item_id = i.item_id
        WHERE b.parent_item_id = v_parent_item_id
          AND i.is_active = true
        ORDER BY b.level_no, b.child_item_id
    LOOP
        -- 차감 수량 계산: 소요량 × 생산수량
        v_deduct_qty := v_bom_record.quantity_required * v_production_qty;

        -- 현재 재고 저장
        v_stock_before := v_bom_record.current_stock;

        -- 재고 차감 (음수 방지는 하지 않음 - 실제 차감을 정확히 기록)
        v_stock_after := v_stock_before - v_deduct_qty;

        -- 자품목 재고 업데이트
        UPDATE items
        SET
            current_stock = current_stock - v_deduct_qty,
            updated_at = NOW()
        WHERE item_id = v_bom_record.child_item_id;

        -- 차감 이력 기록
        INSERT INTO bom_deduction_log (
            transaction_id,
            parent_item_id,
            child_item_id,
            bom_level,
            quantity_required,
            parent_quantity,
            usage_rate,
            deducted_quantity,
            stock_before,
            stock_after,
            created_at
        ) VALUES (
            NEW.transaction_id,
            v_parent_item_id,
            v_bom_record.child_item_id,
            v_bom_record.level_no,
            v_bom_record.quantity_required,
            v_production_qty,
            v_bom_record.quantity_required, -- usage_rate = quantity_required (1:1 비율)
            v_deduct_qty,
            v_stock_before,
            v_stock_after,
            NOW()
        );

        -- 로그 출력 (디버깅용)
        RAISE NOTICE '[BOM 차감] 거래ID: %, 모품목: %, 자품목: % (%), 차감량: %, 재고: % → %',
            NEW.transaction_id,
            v_parent_item_id,
            v_bom_record.child_item_id,
            v_bom_record.item_code,
            v_deduct_qty,
            v_stock_before,
            v_stock_after;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_deduct_bom_materials() IS
'생산입고 거래 발생 시 BOM 기반으로 자품목(원자재) 재고를 자동 차감합니다.
- 트리거 조건: inventory_transactions INSERT with transaction_type = ''생산입고''
- 처리 흐름:
  1. 생산된 모품목의 BOM 조회
  2. 각 자품목별 차감량 계산 (소요량 × 생산수량)
  3. items.current_stock 차감
  4. bom_deduction_log에 이력 기록
- 다단계 BOM의 경우 Level 1 자품목만 직접 차감 (반제품은 별도 생산입고로 처리)';


-- =====================================================
-- 2. 트리거 생성
-- =====================================================

-- 기존 트리거 삭제 (있을 경우)
DROP TRIGGER IF EXISTS trg_auto_deduct_bom ON inventory_transactions;

-- 새 트리거 생성: 생산입고 INSERT 후 실행
CREATE TRIGGER trg_auto_deduct_bom
    AFTER INSERT ON inventory_transactions
    FOR EACH ROW
    WHEN (NEW.transaction_type = '생산입고')
    EXECUTE FUNCTION auto_deduct_bom_materials();

COMMENT ON TRIGGER trg_auto_deduct_bom ON inventory_transactions IS
'생산입고 거래 INSERT 시 BOM 기반 원자재 자동 차감 트리거.
자품목 재고를 자동 차감하고 bom_deduction_log에 이력을 기록합니다.';


-- =====================================================
-- 3. 다단계 BOM 차감 함수 (선택적 - 재귀적 차감)
-- =====================================================

CREATE OR REPLACE FUNCTION auto_deduct_bom_materials_recursive()
RETURNS TRIGGER AS $$
DECLARE
    v_production_qty NUMERIC;
    v_parent_item_id INTEGER;
BEGIN
    -- 생산입고(생산완료) 거래만 처리
    IF NEW.transaction_type != '생산입고' THEN
        RETURN NEW;
    END IF;

    v_production_qty := COALESCE(NEW.quantity, 0);
    v_parent_item_id := NEW.item_id;

    IF v_production_qty <= 0 THEN
        RETURN NEW;
    END IF;

    -- 재귀 CTE를 사용한 다단계 BOM 차감
    WITH RECURSIVE bom_tree AS (
        -- 기본 케이스: Level 1 자품목
        SELECT
            b.bom_id,
            b.parent_item_id,
            b.child_item_id,
            b.quantity_required,
            b.level_no,
            b.quantity_required AS cumulative_qty,
            1 AS tree_level
        FROM bom b
        WHERE b.parent_item_id = v_parent_item_id

        UNION ALL

        -- 재귀 케이스: 하위 레벨 자품목
        SELECT
            b2.bom_id,
            b2.parent_item_id,
            b2.child_item_id,
            b2.quantity_required,
            b2.level_no,
            bt.cumulative_qty * b2.quantity_required AS cumulative_qty,
            bt.tree_level + 1
        FROM bom b2
        INNER JOIN bom_tree bt ON b2.parent_item_id = bt.child_item_id
        WHERE bt.tree_level < 10  -- 무한 루프 방지 (최대 10단계)
    ),
    deductions AS (
        SELECT
            bt.child_item_id,
            SUM(bt.cumulative_qty * v_production_qty) AS total_deduct
        FROM bom_tree bt
        INNER JOIN items i ON bt.child_item_id = i.item_id
        WHERE i.is_active = true
          -- 최하위 품목만 차감 (자품목이 없는 품목)
          AND NOT EXISTS (
              SELECT 1 FROM bom b WHERE b.parent_item_id = bt.child_item_id
          )
        GROUP BY bt.child_item_id
    )
    UPDATE items i
    SET
        current_stock = current_stock - d.total_deduct,
        updated_at = NOW()
    FROM deductions d
    WHERE i.item_id = d.child_item_id;

    -- 이력 기록은 단순화 (Level 1만 기록)
    INSERT INTO bom_deduction_log (
        transaction_id,
        parent_item_id,
        child_item_id,
        bom_level,
        quantity_required,
        parent_quantity,
        usage_rate,
        deducted_quantity,
        stock_before,
        stock_after,
        created_at
    )
    SELECT
        NEW.transaction_id,
        v_parent_item_id,
        b.child_item_id,
        b.level_no,
        b.quantity_required,
        v_production_qty,
        b.quantity_required,
        b.quantity_required * v_production_qty,
        i.current_stock + (b.quantity_required * v_production_qty), -- 차감 전 재고
        i.current_stock, -- 차감 후 재고 (이미 업데이트됨)
        NOW()
    FROM bom b
    INNER JOIN items i ON b.child_item_id = i.item_id
    WHERE b.parent_item_id = v_parent_item_id
      AND i.is_active = true;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_deduct_bom_materials_recursive() IS
'다단계 BOM을 재귀적으로 탐색하여 최하위 원자재까지 자동 차감합니다.
- 재귀 CTE 사용 (최대 10단계)
- 최하위 품목(더 이상 자품목이 없는 품목)만 재고 차감
- 중간 반제품은 차감하지 않음 (별도 생산 공정으로 관리)
참고: 현재 기본 트리거는 Level 1만 차감합니다.
다단계 차감이 필요한 경우 이 함수로 트리거를 교체하세요.';


-- =====================================================
-- 4. 검증 쿼리
-- =====================================================

-- 트리거 상태 확인
-- SELECT
--     tgname AS trigger_name,
--     CASE tgenabled
--         WHEN 'O' THEN '✅ 활성화 (Origin)'
--         WHEN 'D' THEN '❌ 비활성화'
--         WHEN 'R' THEN '✅ 활성화 (Replica)'
--         WHEN 'A' THEN '✅ 활성화 (Always)'
--     END AS status,
--     tgrelid::regclass AS table_name
-- FROM pg_trigger
-- WHERE tgname = 'trg_auto_deduct_bom';

-- 함수 확인
-- SELECT
--     proname AS function_name,
--     prosrc AS source_code
-- FROM pg_proc
-- WHERE proname = 'auto_deduct_bom_materials';

-- BOM 차감 로그 확인
-- SELECT
--     l.log_id,
--     l.transaction_id,
--     pi.item_code AS parent_code,
--     pi.item_name AS parent_name,
--     ci.item_code AS child_code,
--     ci.item_name AS child_name,
--     l.quantity_required,
--     l.parent_quantity,
--     l.deducted_quantity,
--     l.stock_before,
--     l.stock_after,
--     l.created_at
-- FROM bom_deduction_log l
-- JOIN items pi ON l.parent_item_id = pi.item_id
-- JOIN items ci ON l.child_item_id = ci.item_id
-- ORDER BY l.created_at DESC
-- LIMIT 20;


-- =====================================================
-- 5. 테스트 시나리오 (주석 처리)
-- =====================================================

-- 테스트 1: 생산입고 거래 INSERT
-- INSERT INTO inventory_transactions (
--     item_id,
--     transaction_type,
--     quantity,
--     transaction_date,
--     reference_no,
--     notes
-- ) VALUES (
--     100,  -- 생산될 모품목 ID
--     '생산입고',
--     10,   -- 생산 수량
--     CURRENT_DATE,
--     'PROD-TEST-001',
--     'BOM 자동 차감 테스트'
-- );

-- 테스트 2: 차감 결과 확인
-- SELECT * FROM bom_deduction_log WHERE transaction_id = (
--     SELECT MAX(transaction_id) FROM inventory_transactions WHERE reference_no = 'PROD-TEST-001'
-- );


-- =====================================================
-- 6. 롤백 스크립트 (필요시)
-- =====================================================

-- DROP TRIGGER IF EXISTS trg_auto_deduct_bom ON inventory_transactions;
-- DROP FUNCTION IF EXISTS auto_deduct_bom_materials();
-- DROP FUNCTION IF EXISTS auto_deduct_bom_materials_recursive();
