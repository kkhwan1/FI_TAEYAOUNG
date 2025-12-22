-- =====================================================
-- 재고 자동 업데이트 트리거
--
-- 목적: inventory_transactions INSERT 시 items.current_stock 자동 업데이트
-- 지원 transaction_type: 입고, 출고, 생산입고, 생산출고, 조정
--
-- 생성일: 2025-12-22
-- =====================================================

-- 재고 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_stock_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- 입고: 재고 증가
  IF NEW.transaction_type = '입고' THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) + NEW.quantity,
        updated_at = NOW()
    WHERE item_id = NEW.item_id;

  -- 출고: 재고 감소
  ELSIF NEW.transaction_type = '출고' THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) - NEW.quantity,
        updated_at = NOW()
    WHERE item_id = NEW.item_id;

  -- 생산입고: 재고 증가 (완제품/반제품 생산 완료)
  ELSIF NEW.transaction_type = '생산입고' THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) + NEW.quantity,
        updated_at = NOW()
    WHERE item_id = NEW.item_id;

  -- 생산출고: 재고 감소 (원자재 사용)
  ELSIF NEW.transaction_type = '생산출고' THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) - NEW.quantity,
        updated_at = NOW()
    WHERE item_id = NEW.item_id;

  -- 조정: 수량 직접 반영 (양수면 증가, 음수면 감소)
  ELSIF NEW.transaction_type = '조정' THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) + NEW.quantity,
        updated_at = NOW()
    WHERE item_id = NEW.item_id;

  -- 이동: 재고 변동 없음 (위치만 변경)
  -- ELSIF NEW.transaction_type = '이동' THEN
  --   -- 별도 처리 필요시 추가
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (존재할 경우)
DROP TRIGGER IF EXISTS trg_update_stock_on_transaction ON inventory_transactions;

-- 트리거 생성
CREATE TRIGGER trg_update_stock_on_transaction
    AFTER INSERT ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_on_transaction();

-- 트리거 활성화 확인용 코멘트
COMMENT ON FUNCTION update_stock_on_transaction() IS
'재고 자동 업데이트 트리거 함수 - inventory_transactions INSERT 시 items.current_stock 자동 반영';

COMMENT ON TRIGGER trg_update_stock_on_transaction ON inventory_transactions IS
'입고/출고/생산/조정 거래 발생 시 items.current_stock 자동 업데이트';

-- =====================================================
-- 중량 자동 업데이트 트리거
--
-- 목적: is_weight_managed=true인 품목만 current_weight 자동 업데이트
-- =====================================================

CREATE OR REPLACE FUNCTION update_weight_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_is_weight_managed BOOLEAN;
BEGIN
  -- 품목의 중량 관리 여부 확인
  SELECT is_weight_managed INTO v_is_weight_managed
  FROM items
  WHERE item_id = NEW.item_id;

  -- 중량 관리 품목이 아니거나 weight가 없으면 스킵
  IF NOT COALESCE(v_is_weight_managed, FALSE) OR NEW.weight IS NULL THEN
    RETURN NEW;
  END IF;

  -- 입고: 중량 증가
  IF NEW.transaction_type = '입고' THEN
    UPDATE items
    SET current_weight = COALESCE(current_weight, 0) + COALESCE(NEW.weight, 0),
        updated_at = NOW()
    WHERE item_id = NEW.item_id;

  -- 출고/생산출고: 중량 감소
  ELSIF NEW.transaction_type IN ('출고', '생산출고') THEN
    UPDATE items
    SET current_weight = COALESCE(current_weight, 0) - COALESCE(NEW.weight, 0),
        updated_at = NOW()
    WHERE item_id = NEW.item_id;

  -- 생산입고: 중량 증가
  ELSIF NEW.transaction_type = '생산입고' THEN
    UPDATE items
    SET current_weight = COALESCE(current_weight, 0) + COALESCE(NEW.weight, 0),
        updated_at = NOW()
    WHERE item_id = NEW.item_id;

  -- 조정: 중량 직접 반영
  ELSIF NEW.transaction_type = '조정' THEN
    UPDATE items
    SET current_weight = COALESCE(current_weight, 0) + COALESCE(NEW.weight, 0),
        updated_at = NOW()
    WHERE item_id = NEW.item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS trg_update_weight_on_transaction ON inventory_transactions;

-- 트리거 생성
CREATE TRIGGER trg_update_weight_on_transaction
    AFTER INSERT ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_weight_on_transaction();

-- =====================================================
-- 거래 삭제 시 재고/중량 복원 트리거
-- =====================================================

CREATE OR REPLACE FUNCTION restore_stock_on_transaction_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_is_weight_managed BOOLEAN;
BEGIN
  -- 품목의 중량 관리 여부 확인
  SELECT is_weight_managed INTO v_is_weight_managed
  FROM items
  WHERE item_id = OLD.item_id;

  -- 입고 삭제: 재고/중량 감소 (복원)
  IF OLD.transaction_type = '입고' THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) - OLD.quantity,
        current_weight = CASE
          WHEN COALESCE(v_is_weight_managed, FALSE) AND OLD.weight IS NOT NULL
          THEN COALESCE(current_weight, 0) - COALESCE(OLD.weight, 0)
          ELSE current_weight
        END,
        updated_at = NOW()
    WHERE item_id = OLD.item_id;

  -- 출고/생산출고 삭제: 재고/중량 증가 (복원)
  ELSIF OLD.transaction_type IN ('출고', '생산출고') THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) + OLD.quantity,
        current_weight = CASE
          WHEN COALESCE(v_is_weight_managed, FALSE) AND OLD.weight IS NOT NULL
          THEN COALESCE(current_weight, 0) + COALESCE(OLD.weight, 0)
          ELSE current_weight
        END,
        updated_at = NOW()
    WHERE item_id = OLD.item_id;

  -- 생산입고 삭제: 재고/중량 감소 (복원)
  ELSIF OLD.transaction_type = '생산입고' THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) - OLD.quantity,
        current_weight = CASE
          WHEN COALESCE(v_is_weight_managed, FALSE) AND OLD.weight IS NOT NULL
          THEN COALESCE(current_weight, 0) - COALESCE(OLD.weight, 0)
          ELSE current_weight
        END,
        updated_at = NOW()
    WHERE item_id = OLD.item_id;

  -- 조정 삭제: 반대로 적용
  ELSIF OLD.transaction_type = '조정' THEN
    UPDATE items
    SET current_stock = COALESCE(current_stock, 0) - OLD.quantity,
        current_weight = CASE
          WHEN COALESCE(v_is_weight_managed, FALSE) AND OLD.weight IS NOT NULL
          THEN COALESCE(current_weight, 0) - COALESCE(OLD.weight, 0)
          ELSE current_weight
        END,
        updated_at = NOW()
    WHERE item_id = OLD.item_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS trg_restore_stock_on_delete ON inventory_transactions;

-- 트리거 생성
CREATE TRIGGER trg_restore_stock_on_delete
    AFTER DELETE ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION restore_stock_on_transaction_delete();
