# PUT Endpoint Fix - Manual Test Plan

## Fix Summary
**Issue 1**: No validation for item_id changes, leading to stock corruption risk.
**Issue 2**: Type mismatch when comparing string item_id from frontend with number from database.

**Fix**: Added item_id change validation with Number() type normalization (lines 319-328).

**File**: `src/app/api/inventory/shipping/route.ts`

---

## Test Scenarios

### Test 1: Valid Update (Quantity Change Only)
**Objective**: Verify normal updates work when item_id is not changed.

**Precondition**:
- Transaction exists with `transaction_id = 1`, `item_id = 100`, `quantity = 10`
- Item has `current_stock = 50`

**Test Steps**:
1. Send PUT request to `/api/inventory/shipping`:
```json
{
  "id": 1,
  "quantity": 15,
  "notes": "Test: Valid update"
}
```

2. Verify response:
```json
{
  "success": true,
  "message": "Shipping transaction updated successfully",
  "data": {
    "transaction_id": 1,
    "quantity": 15,
    ...
  }
}
```

3. Check database:
   - `inventory_transactions`: `quantity = 15` (updated)
   - `items`: `current_stock = 45` (50 - (15-10) = 45)

**Expected Result**: ✅ Transaction updated, stock adjusted correctly

---

### Test 2: item_id Change Attempt (Number to Number)
**Objective**: Verify item_id changes are blocked even when both are numbers.

**Precondition**:
- Transaction exists with `transaction_id = 1`, `item_id = 100`

**Test Steps**:
1. Send PUT request to `/api/inventory/shipping`:
```json
{
  "id": 1,
  "item_id": 200,
  "notes": "Test: Attempting to change item_id"
}
```

2. Verify response:
```json
{
  "success": false,
  "error": "품목 변경은 허용되지 않습니다. 기존 거래를 삭제하고 새로운 거래를 생성해주세요.",
  "details": "기존 품목 ID: 100, 요청 품목 ID: 200"
}
```

3. Check database:
   - `inventory_transactions`: `item_id = 100` (unchanged)

**Expected Result**: ✅ Error response, item_id unchanged

---

### Test 3: item_id Change Attempt (String to Number) - CRITICAL TYPE TEST
**Objective**: Verify type normalization works when frontend sends string item_id.

**Precondition**:
- Transaction exists with `transaction_id = 1`, `item_id = 100` (number in DB)

**Test Steps**:
1. Send PUT request with STRING item_id (different value):
```json
{
  "id": 1,
  "item_id": "200",
  "notes": "Test: String item_id different value"
}
```

2. Verify response:
```json
{
  "success": false,
  "error": "품목 변경은 허용되지 않습니다. 기존 거래를 삭제하고 새로운 거래를 생성해주세요.",
  "details": "기존 품목 ID: 100, 요청 품목 ID: 200"
}
```

**Expected Result**: ✅ Error response (type normalization works, '200' !== 100)

---

### Test 4: Same item_id with Type Mismatch (String equals Number) - CRITICAL TYPE TEST
**Objective**: Verify Number() normalization allows updates when string matches numeric value.

**Precondition**:
- Transaction exists with `transaction_id = 1`, `item_id = 100` (number in DB)

**Test Steps**:
1. Send PUT request with STRING item_id (SAME value as numeric):
```json
{
  "id": 1,
  "item_id": "100",
  "quantity": 12,
  "notes": "Test: String item_id same as DB numeric value"
}
```

2. Verify response:
```json
{
  "success": true,
  "message": "Shipping transaction updated successfully",
  "data": {
    "transaction_id": 1,
    "item_id": 100,
    "quantity": 12,
    ...
  }
}
```

3. Check database:
   - `inventory_transactions`: `quantity = 12` (updated successfully)
   - Item_id validation passed because Number("100") === Number(100)

**Expected Result**: ✅ Update succeeds (type normalization prevents false rejection)

**❌ OLD BUG BEHAVIOR**: Would reject update because "100" !== 100 (strict comparison without normalization)

---

### Test 5: Quantity Increase (Stock Validation)
**Objective**: Verify stock validation when increasing quantity.

**Precondition**:
- Transaction exists with `transaction_id = 1`, `item_id = 100`, `quantity = 5`
- Item has `current_stock = 3` (only 3 remaining in stock)

**Test Steps**:
1. Send PUT request to increase quantity by 5 (needs 5 more from stock):
```json
{
  "id": 1,
  "quantity": 10,
  "notes": "Test: Insufficient stock for increase"
}
```

2. Verify response:
```json
{
  "success": false,
  "error": "재고가 부족합니다.",
  "details": "현재 재고: 3, 추가 출고 요청: 5"
}
```

3. Check database:
   - `inventory_transactions`: `quantity = 5` (unchanged)
   - `items`: `current_stock = 3` (unchanged)

**Expected Result**: ✅ Error response, transaction and stock unchanged

---

### Test 6: Quantity Decrease (Stock Restoration)
**Objective**: Verify stock is restored when decreasing quantity.

**Precondition**:
- Transaction exists with `transaction_id = 1`, `item_id = 100`, `quantity = 10`
- Item has `current_stock = 20`

**Test Steps**:
1. Send PUT request to decrease quantity:
```json
{
  "id": 1,
  "quantity": 5,
  "notes": "Test: Decrease quantity"
}
```

2. Verify response:
```json
{
  "success": true,
  "message": "Shipping transaction updated successfully",
  "data": {
    "transaction_id": 1,
    "quantity": 5,
    ...
  }
}
```

3. Check database:
   - `inventory_transactions`: `quantity = 5` (decreased)
   - `items`: `current_stock = 25` (20 + (10-5) = 25, stock restored)

**Expected Result**: ✅ Transaction updated, stock increased correctly

---

## Database Verification Queries

### Check Transaction
```sql
SELECT transaction_id, item_id, quantity, transaction_type, notes, updated_at
FROM inventory_transactions
WHERE notes LIKE 'Test:%'
ORDER BY updated_at DESC
LIMIT 5;
```

### Check Stock Level
```sql
SELECT item_id, item_name, current_stock
FROM items
WHERE item_id = {item_id};
```

### Clean Up Test Data
```sql
-- Restore original transaction
UPDATE inventory_transactions
SET quantity = {original_quantity},
    item_id = {original_item_id},
    notes = NULL
WHERE transaction_id = {test_transaction_id};

-- Restore stock
UPDATE items
SET current_stock = {original_stock}
WHERE item_id = {item_id};
```

---

## Known Remaining Issues (Not Fixed Yet)

⚠️ **No Transaction Rollback**: If stock update fails after transaction update, data becomes inconsistent. This will be fixed in a separate task.

⚠️ **Race Conditions**: Concurrent PUT requests can still cause stock corruption. Requires atomic DB operations (future task).

---

## Test Result Summary

| Test | Status | Notes |
|------|--------|-------|
| Test 1: Valid Update | ⬜ Pending | Normal update path |
| Test 2: Number item_id Change | ⬜ Pending | Basic validation |
| Test 3: String item_id Change | ⬜ Pending | Type normalization test |
| Test 4: String = Number item_id | ⬜ Pending | **CRITICAL TYPE FIX** |
| Test 5: Insufficient Stock | ⬜ Pending | Stock validation |
| Test 6: Quantity Decrease | ⬜ Pending | Stock restoration |

---

## Codex Review Results

✅ **Type normalization confirmed correct**
✅ **Null/undefined handling safe**
✅ **Previous type mismatch warning resolved**
✅ **No regressions in other validations**

Codex confirmed:
- Number() normalization prevents false rejections when frontend sends string IDs
- Scenario (item_id "100" string vs 100 number) → Now treated as equal ✅
- Scenario (item_id "200" string vs 100 number) → Correctly rejected as change ✅

**Enhancement Suggestion**: Consider `Number.isSafeInteger()` for extremely large IDs (optional hardening, not critical)
