# POST Endpoint Fix - Manual Test Plan

## Fix Summary
**Issue**: Stock validation happened AFTER transaction insert, causing orphaned transactions when validation failed.

**Fix**: Reordered operations to validate stock BEFORE inserting transaction.

**File**: `src/app/api/inventory/shipping/route.ts` (lines 164-247)

---

## Test Scenarios

### Test 1: Stock Sufficient (Happy Path)
**Objective**: Verify transaction is created and stock is reduced when sufficient stock exists.

**Precondition**:
- Item exists in database with `current_stock = 10`
- User authenticated with valid `created_by` ID

**Test Steps**:
1. Send POST request to `/api/inventory/shipping`:
```json
{
  "transaction_date": "2025-01-29",
  "item_id": "{item_id}",
  "quantity": 5,
  "unit_price": 1000,
  "created_by": "{user_id}",
  "notes": "Test: Stock sufficient"
}
```

2. Verify response:
```json
{
  "success": true,
  "message": "출고가 성공적으로 등록되었습니다.",
  "data": {
    "transaction_id": "{new_id}",
    "quantity": 5,
    ...
  }
}
```

3. Check database:
   - `inventory_transactions` table: New row with `quantity = 5`
   - `items` table: `current_stock = 5` (10 - 5)

**Expected Result**: ✅ Transaction created, stock reduced to 5

---

### Test 2: Stock Insufficient (Critical Fix Verification)
**Objective**: Verify NO transaction is created when stock is insufficient.

**Precondition**:
- Item exists in database with `current_stock = 10`
- User authenticated with valid `created_by` ID

**Test Steps**:
1. Send POST request to `/api/inventory/shipping`:
```json
{
  "transaction_date": "2025-01-29",
  "item_id": "{item_id}",
  "quantity": 15,
  "unit_price": 1000,
  "created_by": "{user_id}",
  "notes": "Test: Stock insufficient"
}
```

2. Verify response:
```json
{
  "success": false,
  "error": "재고가 부족합니다.",
  "details": "현재 재고: 10, 출고 요청: 15"
}
```

3. Check database:
   - `inventory_transactions` table: **NO NEW ROW** (CRITICAL)
   - `items` table: `current_stock = 10` (unchanged)

**Expected Result**: ✅ Error response, NO transaction created, stock unchanged

**❌ OLD BUG BEHAVIOR**: Transaction would be created in database even though error was returned to user.

---

### Test 3: Stock Exactly Zero
**Objective**: Verify edge case when current stock is exactly 0.

**Precondition**:
- Item exists in database with `current_stock = 0`

**Test Steps**:
1. Send POST request with `quantity = 1`

2. Verify response:
```json
{
  "success": false,
  "error": "재고가 부족합니다.",
  "details": "현재 재고: 0, 출고 요청: 1"
}
```

3. Check database:
   - No transaction created
   - Stock remains 0

**Expected Result**: ✅ Error response, no transaction created

---

### Test 4: Stock Exactly Matches Quantity
**Objective**: Verify boundary case when stock exactly matches requested quantity.

**Precondition**:
- Item exists with `current_stock = 10`

**Test Steps**:
1. Send POST request with `quantity = 10`

2. Verify response: `success: true`

3. Check database:
   - Transaction created with `quantity = 10`
   - Stock reduced to 0

**Expected Result**: ✅ Transaction created, stock reduced to 0

---

## Database Verification Queries

### Check Transaction Created
```sql
SELECT transaction_id, item_id, quantity, transaction_type, created_at
FROM inventory_transactions
WHERE notes LIKE 'Test:%'
ORDER BY created_at DESC
LIMIT 5;
```

### Check Stock Level
```sql
SELECT item_id, item_name, current_stock
FROM items
WHERE item_id = '{item_id}';
```

### Clean Up Test Data
```sql
-- Delete test transactions
DELETE FROM inventory_transactions
WHERE notes LIKE 'Test:%';

-- Restore stock (if needed)
UPDATE items
SET current_stock = {original_value}
WHERE item_id = '{item_id}';
```

---

## Known Remaining Issues (Not Fixed Yet)

⚠️ **No Transaction Rollback**: If stock update fails after transaction insert, transaction remains but stock is unchanged. This will be fixed in a separate task.

⚠️ **Race Conditions**: Concurrent requests can still oversell. Requires atomic DB operations (future task).

---

## Test Result Summary

| Test | Status | Notes |
|------|--------|-------|
| Test 1: Stock Sufficient | ⬜ Pending | Happy path |
| Test 2: Stock Insufficient | ⬜ Pending | **CRITICAL FIX** |
| Test 3: Stock Zero | ⬜ Pending | Edge case |
| Test 4: Stock Exact Match | ⬜ Pending | Boundary case |

---

## Codex Review Results

✅ **Transaction order confirmed correct**
✅ **Validation happens before insert**
✅ **Error scenarios handled properly**

Codex confirmed:
- Scenario (재고 10, 출고 15) → Error WITHOUT creating transaction ✅
- Scenario (재고 10, 출고 5) → Success WITH transaction + stock reduced ✅
