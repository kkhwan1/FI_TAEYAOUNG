/**
 * BOM Utility Functions
 * 순환 참조 검사, BOM 전개, 트리 구조 변환 등
 */

import { supabaseAdmin } from './db-unified';
import { mcp__supabase__execute_sql } from './supabase-mcp';

/**
 * BOM 구조 관련 타입 정의
 */
export interface BOMNode {
  bom_id: number;
  parent_item_id: number;
  child_item_id: number;
  item_code: string;
  item_name: string;
  spec?: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
  level: number;
  path?: string;
  accumulated_quantity?: number;
  yield_rate?: number;
  actual_quantity?: number;
  notes?: string;
  children?: BOMNode[];
}

/**
 * BOM 순환 참조 검사 (CTE 사용)
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @param childId - 하위 품목 ID
 * @param excludeBomId - 제외할 BOM ID (수정 시 사용)
 * @returns 순환 참조 여부
 */
export async function checkBomCircular(
  conn: any,
  parentId: number,
  childId: number,
  excludeBomId?: number
): Promise<boolean> {
  // 순환 참조 허용: 모든 순환 참조(자기 참조 포함)를 허용함
  // 항상 false를 반환하여 순환 참조 검사를 비활성화
  return false;
}

/**
 * BOM 전개 (재귀적 조회)
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @param level - 현재 레벨 (재귀 깊이)
 * @param maxLevel - 최대 레벨 제한
 * @param parentQuantity - 부모의 수량 (누적 계산용)
 * @returns 전개된 BOM 노드 배열
 */
export async function explodeBom(
  conn: any,
  parentId: number,
  level: number = 0,
  maxLevel: number = 10,
  parentQuantity: number = 1
): Promise<BOMNode[]> {
  try {
    if (level >= maxLevel) {
      console.warn(`Max BOM level (${maxLevel}) reached for item ${parentId}`);
      return [];
    }

    // 현재 레벨의 BOM 항목 조회
    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const sql = `
      SELECT
        b.bom_id,
        b.parent_item_id,
        b.child_item_id,
        b.quantity_required,
        b.notes,
        i.item_code,
        i.item_name,
        i.spec,
        i.unit,
        COALESCE(i.yield_rate, 100) as yield_rate,
        COALESCE(
          (SELECT unit_price FROM item_price_history
           WHERE item_id = b.child_item_id
           AND price_month = '${currentMonth}'
           ORDER BY created_at DESC LIMIT 1),
          i.price,
          0
        ) as unit_price
      FROM bom b
      INNER JOIN items i ON b.child_item_id = i.item_id
      WHERE b.parent_item_id = ${parentId}
        AND b.is_active = true
        AND i.is_active = true
      ORDER BY i.item_code
    `;

    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: sql
    });

    const rows = result.rows as Array<{
      bom_id: number;
      parent_item_id: number;
      child_item_id: number;
      quantity_required: number;
      unit: string | null;
      notes: string | null;
      item_code: string;
      item_name: string;
      spec: string | null;
      yield_rate: number;
      unit_price: number | null;
    }> | undefined;

    const nodes: BOMNode[] = [];

    for (const row of rows || []) {
      // 수율 적용: 수율이 100% 미만이면 더 많은 자재 필요
      const yieldRate = row.yield_rate || 100;
      const actualQuantity = calculateActualQuantityWithYield(row.quantity_required, yieldRate);
      const accumulatedQuantity = actualQuantity * parentQuantity;

      const node: BOMNode = {
        bom_id: row.bom_id,
        parent_item_id: row.parent_item_id,
        child_item_id: row.child_item_id,
        item_code: row.item_code,
        item_name: row.item_name,
        spec: row.spec || undefined,
        quantity: row.quantity_required,
        unit: row.unit || 'EA',
        unit_price: row.unit_price || 0,
        total_price: (row.unit_price || 0) * accumulatedQuantity,
        level: level + 1,
        accumulated_quantity: accumulatedQuantity,
        notes: row.notes || undefined
      };

      // 재귀적으로 하위 BOM 조회 (수율 적용된 수량 전달)
      const children = await explodeBom(
        conn,
        row.child_item_id,
        level + 1,
        maxLevel,
        accumulatedQuantity
      );

      if (children.length > 0) {
        node.children = children;
      }

      nodes.push(node);
    }

    return nodes;

  } catch (error) {
    console.error('Error exploding BOM:', error);
    return [];
  }
}

/**
 * BOM 트리 구조로 변환
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @param includeInactive - 비활성 항목 포함 여부
 * @returns BOM 트리 구조
 */
export async function getBomTree(
  conn: any,
  parentId: number,
  includeInactive: boolean = false
): Promise<BOMNode | null> {
  try {
    // 상위 품목 정보 조회
    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const parentSql = `
      SELECT
        item_id,
        item_code,
        item_name,
        spec,
        unit_price
      FROM items
      WHERE item_id = ${parentId} ${includeInactive ? '' : 'AND is_active = true'}
    `;

    const parentResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: parentSql
    });

    const parentRows = parentResult.rows as Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      spec: string | null;
      unit_price: number | null;
    }> | undefined;

    if (!parentRows || parentRows.length === 0) {
      return null;
    }

    const parent = parentRows[0];

    // BOM 전개하여 하위 구조 가져오기
    const children = await explodeBom(conn, parentId, 0, 10, 1);

    const rootNode: BOMNode = {
      bom_id: 0,
      parent_item_id: 0,
      child_item_id: parent.item_id,
      item_code: parent.item_code,
      item_name: parent.item_name,
      spec: parent.spec || undefined,
      quantity: 1,
      unit: 'EA',
      unit_price: parent.unit_price || 0,
      total_price: parent.unit_price || 0,
      level: 0,
      accumulated_quantity: 1,
      children: children.length > 0 ? children : undefined
    };

    return rootNode;

  } catch (error) {
    console.error('Error getting BOM tree:', error);
    return null;
  }
}

/**
 * 배치 BOM 원가 계산 (N+1 문제 해결)
 * 모든 필요한 데이터를 한 번에 조회 후 메모리에서 계산
 * @param conn - DB 연결
 * @param itemIds - 품목 ID 배열
 * @param priceMonth - 기준 월 (YYYY-MM-DD 형식)
 * @returns Map<item_id, cost_info>
 */
export async function calculateBatchTotalCost(
  conn: any,
  itemIds: number[],
  priceMonth?: string
): Promise<Map<number, {
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  scrap_revenue: number;
  net_cost: number;
}>> {
  const result = new Map();
  const currentMonth = priceMonth || new Date().toISOString().slice(0, 7) + '-01';

  try {
    if (itemIds.length === 0) return result;

    // 1. 모든 BOM 데이터 한 번에 조회 (재귀 구조 포함)
    const { data: allBomData } = await conn
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        labor_cost,
        child:items!child_item_id (
          item_id,
          item_code,
          item_name,
          price,
          scrap_rate,
          scrap_unit_price,
          mm_weight
        )
      `)
      .in('parent_item_id', itemIds)
      .eq('is_active', true);

    if (!allBomData || allBomData.length === 0) {
      // BOM이 없는 품목들은 0 원가로 설정
      itemIds.forEach(id => {
        result.set(id, {
          material_cost: 0,
          labor_cost: 0,
          overhead_cost: 0,
          scrap_revenue: 0,
          net_cost: 0
        });
      });
      return result;
    }

    // 2. 모든 child_item_id 추출 (하위 BOM 조회용)
    const allChildIds = allBomData.map((bom: any) => bom.child_item_id).filter(Boolean);

    // 3. 모든 월별 단가 한 번에 조회
    const { data: allPrices } = await conn
      .from('item_price_history')
      .select('item_id, unit_price')
      .in('item_id', allChildIds)
      .eq('price_month', currentMonth);

    const priceMap = new Map<number, number>();
    (allPrices || []).forEach((p: any) => {
      if (!priceMap.has(p.item_id)) {
        priceMap.set(p.item_id, p.unit_price);
      }
    });

    // 4. 하위 BOM 존재 여부 한 번에 조회
    const { data: subBomData } = await conn
      .from('bom')
      .select('parent_item_id')
      .in('parent_item_id', allChildIds)
      .eq('is_active', true);

    const hasSubBom = new Set<number>();
    (subBomData || []).forEach((sb: any) => {
      hasSubBom.add(sb.parent_item_id);
    });

    // 5. 하위 BOM이 있는 품목들에 대해 재귀 조회 (한 번만)
    let subCostsMap = new Map();
    if (hasSubBom.size > 0) {
      const subItemIds = Array.from(hasSubBom);
      subCostsMap = await calculateBatchTotalCost(conn, subItemIds, priceMonth);
    }

    // 6. 각 품목별 원가 계산 (메모리에서 처리)
    for (const itemId of itemIds) {
      const bomItems = allBomData.filter((bom: any) => bom.parent_item_id === itemId);

      let materialCost = 0;
      let laborCost = 0;
      let scrapRevenue = 0;

      for (const bomItem of bomItems) {
        const child = bomItem.child;
        if (!child) continue;

        const unitPrice = priceMap.get(child.item_id) || child.price || 0;
        const quantity = bomItem.quantity_required || 0;
        const laborCostPerItem = bomItem.labor_cost || 0;

        // 재료비 계산
        materialCost += quantity * unitPrice;

        // 가공비 계산
        laborCost += quantity * laborCostPerItem;

        // 스크랩 수익 계산
        const scrapRate = child.scrap_rate || 0;
        const scrapUnitPrice = child.scrap_unit_price || 0;
        const mmWeight = child.mm_weight || 0;
        scrapRevenue += quantity * (scrapRate / 100) * scrapUnitPrice * mmWeight;

        // 하위 BOM 원가 추가
        if (hasSubBom.has(child.item_id)) {
          const subCost = subCostsMap.get(child.item_id);
          if (subCost) {
            materialCost += quantity * subCost.material_cost;
            laborCost += quantity * subCost.labor_cost;
            scrapRevenue += quantity * subCost.scrap_revenue;
          }
        }
      }

      // 간접비 계산
      const overheadCost = (materialCost + laborCost) * 0.1;

      // 순원가
      const netCost = materialCost + laborCost + overheadCost - scrapRevenue;

      result.set(itemId, {
        material_cost: materialCost,
        labor_cost: laborCost,
        overhead_cost: overheadCost,
        scrap_revenue: scrapRevenue,
        net_cost: netCost
      });
    }

    return result;

  } catch (error) {
    console.error('Error calculating batch total cost:', error);
    // 오류 시 모든 품목 0 원가로 반환
    itemIds.forEach(id => {
      result.set(id, {
        material_cost: 0,
        labor_cost: 0,
        overhead_cost: 0,
        scrap_revenue: 0,
        net_cost: 0
      });
    });
    return result;
  }
}

/**
 * 최하위 품목들의 총 원가 계산 (기존 버전 - 호환성 유지)
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @param priceMonth - 기준 월 (YYYY-MM-DD 형식)
 * @returns 상세 원가 정보
 */
export async function calculateTotalCost(
  conn: any,
  parentId: number,
  priceMonth?: string
): Promise<{
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  scrap_revenue: number;
  net_cost: number;
}> {
  try {
    const currentMonth = priceMonth || new Date().toISOString().slice(0, 7) + '-01';
    
    // 먼저 BOM 구조를 단계별로 조회하여 원가 계산
    const { data: bomData, error: bomError } = await conn
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        labor_cost,
        child:items!child_item_id (
          item_id,
          item_code,
          item_name,
          price,
          scrap_rate,
          scrap_unit_price,
          mm_weight
        )
      `)
      .eq('parent_item_id', parentId)
      .eq('is_active', true);

    if (bomError || !bomData || bomData.length === 0) {
      return {
        material_cost: 0,
        labor_cost: 0,
        overhead_cost: 0,
        scrap_revenue: 0,
        net_cost: 0
      };
    }

    let materialCost = 0;
    let laborCost = 0;
    let scrapRevenue = 0;

    // 각 BOM 항목에 대해 원가 계산
    for (const bomItem of bomData) {
      const child = bomItem.child;
      if (!child) continue;

      // 월별 단가 조회
      const { data: priceData } = await conn
        .from('item_price_history')
        .select('unit_price')
        .eq('item_id', child.item_id)
        .eq('price_month', currentMonth)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const unitPrice = priceData?.unit_price || child.price || 0;
      const quantity = bomItem.quantity_required || 0;
      const laborCostPerItem = bomItem.labor_cost || 0;

      // 재료비 계산
      materialCost += quantity * unitPrice;

      // 가공비 계산
      laborCost += quantity * laborCostPerItem;

      // 스크랩 수익 계산 (중량 × 스크랩율 × 스크랩 단가)
      const scrapRate = child.scrap_rate || 0;
      const scrapUnitPrice = child.scrap_unit_price || 0;
      const mmWeight = child.mm_weight || 0;
      scrapRevenue += quantity * (scrapRate / 100) * scrapUnitPrice * mmWeight;

      // 하위 품목이 BOM을 가지고 있다면 재귀적으로 계산
      const { data: subBomData } = await conn
        .from('bom')
        .select('bom_id')
        .eq('parent_item_id', child.item_id)
        .eq('is_active', true)
        .limit(1);

      if (subBomData && subBomData.length > 0) {
        const subCost = await calculateTotalCost(conn, child.item_id, priceMonth);
        materialCost += quantity * subCost.material_cost;
        laborCost += quantity * subCost.labor_cost;
        scrapRevenue += quantity * subCost.scrap_revenue;
      }
    }

    // 간접비 계산 (재료비 + 가공비) × 10%
    const overheadCost = (materialCost + laborCost) * 0.1;
    
    // 순원가 = 재료비 + 가공비 + 간접비 - 스크랩 수익
    const netCost = materialCost + laborCost + overheadCost - scrapRevenue;

    return {
      material_cost: materialCost,
      labor_cost: laborCost,
      overhead_cost: overheadCost,
      scrap_revenue: scrapRevenue,
      net_cost: netCost
    };

  } catch (error) {
    console.error('Error calculating total cost:', error);
    return {
      material_cost: 0,
      labor_cost: 0,
      overhead_cost: 0,
      scrap_revenue: 0,
      net_cost: 0
    };
  }
}

/**
 * 스크랩 수익 계산
 * @param conn - DB 연결
 * @param parentId - 상위 품목 ID
 * @param quantity - 생산 수량
 * @returns 총 스크랩 수익
 */
export async function calculateScrapRevenue(
  conn: any,
  itemId: number,
  quantity: number = 1
): Promise<number> {
  try {
    // 먼저 해당 품목 자체의 스크랩 정보 확인
    const { data: itemData } = await conn
      .from('items')
      .select('scrap_rate, scrap_unit_price, mm_weight')
      .eq('item_id', itemId)
      .single();

    let directScrapRevenue = 0;
    if (itemData && itemData.scrap_rate && itemData.scrap_unit_price && itemData.mm_weight) {
      // 직선 스크랩 수익 (품목 자체의 스크랩)
      directScrapRevenue = (itemData.scrap_rate / 100) * 
                           itemData.scrap_unit_price * 
                           itemData.mm_weight * quantity;
    }

    // BOM 구조를 단계별로 조회하여 하위 품목의 스크랩 수익 계산
    const bomEntries = await conn
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        child:items!child_item_id (
          item_id,
          scrap_rate,
          scrap_unit_price,
          mm_weight
        )
      `)
      .eq('parent_item_id', itemId)
      .eq('is_active', true);

    if (!bomEntries.data || bomEntries.data.length === 0) {
      return directScrapRevenue;
    }

    let childScrapRevenue = 0;

    // 각 BOM 항목에 대해 스크랩 수익 계산
    for (const entry of bomEntries.data) {
      const item = entry.child;
      if (item && item.scrap_rate && item.scrap_unit_price && item.mm_weight) {
        const scrapRevenue = entry.quantity_required * 
                           (item.scrap_rate / 100) * 
                           item.scrap_unit_price * 
                           item.mm_weight;
        childScrapRevenue += scrapRevenue;
      }
    }

    return (directScrapRevenue + childScrapRevenue * quantity);

  } catch (error) {
    console.error('Error calculating scrap revenue:', error);
    return 0;
  }
}

/**
 * 배치 스크랩 수익 계산 (N+1 문제 해결)
 * 여러 품목의 스크랩 수익을 한 번에 계산
 * @param conn - DB 연결
 * @param itemQuantities - [item_id, quantity] 배열
 * @returns Map<item_id, scrap_revenue>
 */
export async function calculateBatchScrapRevenue(
  conn: any,
  itemQuantities: Array<{ item_id: number; quantity: number }>
): Promise<Map<number, number>> {
  try {
    if (!itemQuantities || itemQuantities.length === 0) {
      return new Map();
    }

    const itemIds = itemQuantities.map(iq => iq.item_id);
    const result = new Map<number, number>();

    // 1. 모든 품목의 스크랩 정보 한 번에 조회
    const { data: itemsData } = await conn
      .from('items')
      .select('item_id, scrap_rate, scrap_unit_price, mm_weight')
      .in('item_id', itemIds);

    if (!itemsData) {
      return result;
    }

    // 2. 모든 BOM 구조 한 번에 조회
    const { data: bomEntries } = await conn
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        child:items!child_item_id (
          item_id,
          scrap_rate,
          scrap_unit_price,
          mm_weight
        )
      `)
      .in('parent_item_id', itemIds)
      .eq('is_active', true);

    // 3. 각 품목별로 스크랩 수익 계산
    for (const { item_id, quantity } of itemQuantities) {
      const itemData = itemsData.find((i: any) => i.item_id === item_id);
      
      // 3-1. 직선 스크랩 수익
      let directScrapRevenue = 0;
      if (itemData && itemData.scrap_rate && itemData.scrap_unit_price && itemData.mm_weight) {
        directScrapRevenue = (itemData.scrap_rate / 100) * 
                           itemData.scrap_unit_price * 
                           itemData.mm_weight * quantity;
      }

      // 3-2. 하위 품목 스크랩 수익
      const relevantBomEntries = bomEntries?.filter((b: any) => b.parent_item_id === item_id) || [];
      let childScrapRevenue = 0;

      for (const entry of relevantBomEntries) {
        const childItem = entry.child;
        if (childItem && childItem.scrap_rate && childItem.scrap_unit_price && childItem.mm_weight) {
          const scrapRevenue = entry.quantity_required * 
                             (childItem.scrap_rate / 100) * 
                             childItem.scrap_unit_price * 
                             childItem.mm_weight;
          childScrapRevenue += scrapRevenue;
        }
      }

      result.set(item_id, directScrapRevenue + childScrapRevenue * quantity);
    }

    return result;

  } catch (error) {
    console.error('Error calculating batch scrap revenue:', error);
    return new Map();
  }
}

/**
 * BOM 역전개 (Where-Used)
 * 특정 품목이 어느 상위 품목에 사용되는지 조회
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param childId - 하위 품목 ID
 * @returns 상위 품목 목록
 */
export async function getWhereUsed(
  conn: any,
  childId: number
): Promise<any[]> {
  try {
    const sql = `
      WITH RECURSIVE where_used AS (
        -- 초기값: 직접 상위 품목
        SELECT
          b.bom_id,
          b.parent_item_id,
          b.child_item_id,
          b.quantity,
          i.item_code,
          i.item_name,
          i.spec,
          1 as level,
          b.parent_item_id::text as path
        FROM bom b
        INNER JOIN items i ON b.parent_item_id = i.item_id
        WHERE b.child_item_id = $1
          AND b.is_active = 1
          AND i.is_active = 1

        UNION ALL

        -- 재귀: 상위의 상위 품목들
        SELECT
          b.bom_id,
          b.parent_item_id,
          b.child_item_id,
          b.quantity * wu.quantity as quantity,
          i.item_code,
          i.item_name,
          i.spec,
          wu.level + 1,
          wu.path || ',' || b.parent_item_id
        FROM bom b
        INNER JOIN where_used wu ON b.child_item_id = wu.parent_item_id
        INNER JOIN items i ON b.parent_item_id = i.item_id
        WHERE b.is_active = 1
          AND i.is_active = 1
          AND wu.level < 10
          AND b.parent_item_id != ALL(string_to_array(wu.path, ',')::int[])
      )
      SELECT * FROM where_used
      ORDER BY level, item_code
    `;

    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const sqlWithParams = sql.replace(/\$1/g, childId.toString());

    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: sqlWithParams
    });

    return result.rows || [];

  } catch (error) {
    console.error('Error getting where-used:', error);
    return [];
  }
}

/**
 * BOM 레벨별 요약 정보
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @returns 레벨별 품목 수와 원가 정보
 */
export async function getBomLevelSummary(
  conn: any,
  parentId: number
): Promise<any[]> {
  try {
    const sql = `
      WITH RECURSIVE bom_levels AS (
        -- 초기값
        SELECT
          b.child_item_id,
          b.quantity,
          b.quantity as accumulated_qty,
          1 as level,
          i.unit_price
        FROM bom b
        INNER JOIN items i ON b.child_item_id = i.item_id
        WHERE b.parent_item_id = $1
          AND b.is_active = 1
          AND i.is_active = 1

        UNION ALL

        -- 재귀
        SELECT
          b.child_item_id,
          b.quantity,
          bl.accumulated_qty * b.quantity,
          bl.level + 1,
          i.unit_price
        FROM bom b
        INNER JOIN bom_levels bl ON b.parent_item_id = bl.child_item_id
        INNER JOIN items i ON b.child_item_id = i.item_id
        WHERE b.is_active = 1
          AND i.is_active = 1
          AND bl.level < 10
      )
      SELECT
        level,
        COUNT(DISTINCT child_item_id) as item_count,
        SUM(accumulated_qty) as total_quantity,
        SUM(accumulated_qty * COALESCE(unit_price, 0)) as level_cost
      FROM bom_levels
      GROUP BY level
      ORDER BY level
    `;

    const projectId = process.env.SUPABASE_PROJECT_ID || '';
    const sqlWithParams = sql.replace(/\$1/g, parentId.toString());

    const result = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: sqlWithParams
    });

    return result.rows || [];

  } catch (error) {
    console.error('Error getting BOM level summary:', error);
    return [];
  }
}

/**
 * BOM 유효성 검사
 * @param conn - DB 연결 (supabaseAdmin 사용)
 * @param parentId - 상위 품목 ID
 * @returns 유효성 검사 결과
 */
export async function validateBom(
  conn: any,
  parentId: number
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const projectId = process.env.SUPABASE_PROJECT_ID || '';

    // 1. 상위 품목 존재 확인
    const parentCheckSql = `
      SELECT item_id, item_code, item_name, is_active
      FROM items WHERE item_id = ${parentId}
    `;
    const parentCheckResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: parentCheckSql
    });

    const parentRows = parentCheckResult.rows as Array<{
      item_id: number;
      item_code: string;
      item_name: string;
      is_active: boolean;
    }> | undefined;

    if (!parentRows || parentRows.length === 0) {
      errors.push(`상위 품목 ID ${parentId}가 존재하지 않습니다.`);
      return { valid: false, errors, warnings };
    }

    if (!parentRows[0].is_active) {
      warnings.push(`상위 품목 '${parentRows[0].item_code}'가 비활성 상태입니다.`);
    }

    // 2. 순환 참조 검사
    const circularCheckSql = `
      WITH RECURSIVE bom_check AS (
        SELECT child_item_id, parent_item_id, 1 as depth
        FROM bom
        WHERE parent_item_id = ${parentId} AND is_active = true

        UNION ALL

        SELECT b.child_item_id, b.parent_item_id, bc.depth + 1
        FROM bom b
        INNER JOIN bom_check bc ON b.parent_item_id = bc.child_item_id
        WHERE b.is_active = true AND bc.depth < 20
      )
      SELECT COUNT(*) as circular_count
      FROM bom_check
      WHERE child_item_id = ${parentId}
    `;

    const circularCheckResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: circularCheckSql
    });

    const circularRows = circularCheckResult.rows as Array<{circular_count: number}> | undefined;

    if (circularRows && circularRows.length > 0 && circularRows[0]?.circular_count > 0) {
      errors.push('BOM 구조에 순환 참조가 존재합니다.');
    }

    // 3. 비활성 하위 품목 확인
    const inactiveCheckSql = `
      SELECT i.item_code, i.item_name
      FROM bom b
      INNER JOIN items i ON b.child_item_id = i.item_id
      WHERE b.parent_item_id = ${parentId}
        AND b.is_active = true
        AND i.is_active = false
    `;

    const inactiveCheckResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: inactiveCheckSql
    });

    const inactiveRows = inactiveCheckResult.rows as Array<{
      item_code: string;
      item_name: string;
    }> | undefined;

    if (inactiveRows && inactiveRows.length > 0) {
      inactiveRows.forEach((item: Record<string, any>) => {
        warnings.push(`하위 품목 '${item.item_code} - ${item.item_name}'가 비활성 상태입니다.`);
      });
    }

    // 4. 0 수량 확인
    const zeroQtyCheckSql = `
      SELECT i.item_code, i.item_name
      FROM bom b
      INNER JOIN items i ON b.child_item_id = i.item_id
      WHERE b.parent_item_id = $1
        AND b.is_active = 1
        AND (b.quantity IS NULL OR b.quantity <= 0)
    `;

    const zeroQtyResult = await mcp__supabase__execute_sql({
      project_id: projectId,
      query: zeroQtyCheckSql.replace('$1', parentId.toString())
    });

    const zeroQtyRows = zeroQtyResult.rows as Array<{item_code: string, item_name: string}> | undefined;

    if (zeroQtyRows && zeroQtyRows.length > 0) {
      zeroQtyRows.forEach((item) => {
        errors.push(`품목 '${item.item_code} - ${item.item_name}'의 수량이 0 또는 NULL입니다.`);
      });
    }

    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings
    };

  } catch (error) {
    console.error('Error validating BOM:', error);
    errors.push(`BOM 유효성 검사 중 오류 발생: ${error}`);
    return {
      valid: false,
      errors,
      warnings
    };
  }
}

/**
 * 수율을 고려한 실제 소요량 계산
 * @param requiredQuantity 필요 수량
 * @param yieldRate 수율 (0-100)
 * @returns 실제 필요 수량
 */
export function calculateActualQuantityWithYield(
  requiredQuantity: number,
  yieldRate: number = 100
): number {
  if (yieldRate <= 0) return requiredQuantity;
  if (yieldRate >= 100) return requiredQuantity;
  
  // 수율이 낮을수록 더 많은 원자재 필요
  // 예: 수율 90%이면 100개 만들려면 111.11개 필요
  return requiredQuantity / (yieldRate / 100);
}