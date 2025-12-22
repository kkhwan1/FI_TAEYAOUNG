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
