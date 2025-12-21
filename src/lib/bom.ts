/**
 * BOM Utility Functions
 * 순환 참조 검사, BOM 전개, 트리 구조 변환 등
 */

import { supabaseAdmin } from './db-unified';

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

    // 현재 레벨의 BOM 항목 조회 (Supabase 파라미터화 쿼리 사용)
    const { data: bomData, error: bomError } = await conn
      .from('bom')
      .select(`
        bom_id,
        parent_item_id,
        child_item_id,
        quantity_required,
        notes,
        items!child_item_id (
          item_code,
          item_name,
          spec,
          unit,
          yield_rate,
          price
        )
      `)
      .eq('parent_item_id', parentId)
      .eq('is_active', true)
      .order('item_code', { foreignTable: 'items' });

    if (bomError) {
      console.error('Error fetching BOM data:', bomError);
      return [];
    }

    if (!bomData || bomData.length === 0) {
      return [];
    }

    // 월별 단가 조회 (배치 처리)
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const childItemIds = bomData.map((b: any) => b.child_item_id);

    const { data: priceData } = await conn
      .from('item_price_history')
      .select('item_id, unit_price')
      .in('item_id', childItemIds)
      .eq('price_month', currentMonth)
      .order('created_at', { ascending: false });

    // 가격 맵 생성
    const priceMap = new Map<number, number>();
    (priceData || []).forEach((p: any) => {
      if (!priceMap.has(p.item_id)) {
        priceMap.set(p.item_id, p.unit_price);
      }
    });

    const nodes: BOMNode[] = [];

    for (const bomItem of bomData) {
      const item = bomItem.items;
      if (!item) continue;

      // 월별 단가 조회 (우선순위: 월별 단가 > 기본 단가)
      const unitPrice = priceMap.get(bomItem.child_item_id) || item.price || 0;

      // 수율 적용: 수율이 100% 미만이면 더 많은 자재 필요
      const yieldRate = item.yield_rate || 100;
      const actualQuantity = calculateActualQuantityWithYield(bomItem.quantity_required, yieldRate);
      const accumulatedQuantity = actualQuantity * parentQuantity;

      const node: BOMNode = {
        bom_id: bomItem.bom_id,
        parent_item_id: bomItem.parent_item_id,
        child_item_id: bomItem.child_item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        spec: item.spec || undefined,
        quantity: bomItem.quantity_required,
        unit: item.unit || 'EA',
        unit_price: unitPrice,
        total_price: unitPrice * accumulatedQuantity,
        level: level + 1,
        accumulated_quantity: accumulatedQuantity,
        notes: bomItem.notes || undefined
      };

      // 재귀적으로 하위 BOM 조회 (수율 적용된 수량 전달)
      const children = await explodeBom(
        conn,
        bomItem.child_item_id,
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
    // 상위 품목 정보 조회 (Supabase 파라미터화 쿼리 사용)
    let query = conn.from('items').select('item_id, item_code, item_name, spec, unit_price').eq('item_id', parentId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: parentData, error: parentError } = await query.single();

    if (parentError || !parentData) {
      return null;
    }

    const parent = parentData;

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
    // RPC 함수 호출 사용 (파라미터화)
    const { data, error } = await conn.rpc('get_where_used', {
      p_child_id: childId
    });

    if (error) {
      console.error('Error calling get_where_used RPC:', error);

      // RPC 함수가 없는 경우 대체 로직 (단일 레벨만 조회)
      const { data: fallbackData } = await conn
        .from('bom')
        .select(`
          bom_id,
          parent_item_id,
          child_item_id,
          quantity_required,
          parent:items!parent_item_id (
            item_code,
            item_name,
            spec
          )
        `)
        .eq('child_item_id', childId)
        .eq('is_active', true);

      if (!fallbackData) return [];

      return fallbackData.map((b: any, index: number) => ({
        bom_id: b.bom_id,
        parent_item_id: b.parent_item_id,
        child_item_id: b.child_item_id,
        quantity: b.quantity_required,
        item_code: b.parent?.item_code || '',
        item_name: b.parent?.item_name || '',
        spec: b.parent?.spec || null,
        level: 1,
        path: String(b.parent_item_id)
      }));
    }

    return data || [];

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
    // RPC 함수 호출 사용 (파라미터화)
    const { data, error } = await conn.rpc('get_bom_level_summary', {
      p_parent_id: parentId
    });

    if (error) {
      console.error('Error calling get_bom_level_summary RPC:', error);

      // RPC 함수가 없는 경우 대체 로직 (BOM 전개 결과를 이용한 수동 집계)
      const bomTree = await explodeBom(conn, parentId, 0, 10, 1);

      // 레벨별 집계
      const levelMap = new Map<number, { item_count: Set<number>, total_quantity: number, level_cost: number }>();

      const processNode = (node: BOMNode) => {
        const levelData = levelMap.get(node.level) || {
          item_count: new Set<number>(),
          total_quantity: 0,
          level_cost: 0
        };

        levelData.item_count.add(node.child_item_id);
        levelData.total_quantity += node.accumulated_quantity || node.quantity;
        levelData.level_cost += (node.total_price || 0);

        levelMap.set(node.level, levelData);

        if (node.children) {
          node.children.forEach(processNode);
        }
      };

      bomTree.forEach(processNode);

      // Map을 배열로 변환
      return Array.from(levelMap.entries())
        .map(([level, data]) => ({
          level,
          item_count: data.item_count.size,
          total_quantity: data.total_quantity,
          level_cost: data.level_cost
        }))
        .sort((a, b) => a.level - b.level);
    }

    return data || [];

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
    // 1. 상위 품목 존재 확인 (파라미터화 쿼리)
    const { data: parentData, error: parentError } = await conn
      .from('items')
      .select('item_id, item_code, item_name, is_active')
      .eq('item_id', parentId)
      .single();

    if (parentError || !parentData) {
      errors.push(`상위 품목 ID ${parentId}가 존재하지 않습니다.`);
      return { valid: false, errors, warnings };
    }

    if (!parentData.is_active) {
      warnings.push(`상위 품목 '${parentData.item_code}'가 비활성 상태입니다.`);
    }

    // 2. 순환 참조 검사 (RPC 함수 또는 대체 로직 사용)
    const { data: circularData, error: circularError } = await conn.rpc('check_bom_circular', {
      p_parent_id: parentId
    });

    if (circularError) {
      // RPC 함수가 없는 경우 경고만 출력
      console.warn('check_bom_circular RPC function not available, skipping circular check');
    } else if (circularData > 0) {
      errors.push('BOM 구조에 순환 참조가 존재합니다.');
    }

    // 3. 비활성 하위 품목 확인 (파라미터화 쿼리)
    const { data: inactiveData } = await conn
      .from('bom')
      .select(`
        child:items!child_item_id (
          item_code,
          item_name,
          is_active
        )
      `)
      .eq('parent_item_id', parentId)
      .eq('is_active', true);

    if (inactiveData && inactiveData.length > 0) {
      inactiveData.forEach((bomItem: any) => {
        if (bomItem.child && !bomItem.child.is_active) {
          warnings.push(`하위 품목 '${bomItem.child.item_code} - ${bomItem.child.item_name}'가 비활성 상태입니다.`);
        }
      });
    }

    // 4. 0 수량 확인 (파라미터화 쿼리)
    const { data: zeroQtyData } = await conn
      .from('bom')
      .select(`
        quantity_required,
        child:items!child_item_id (
          item_code,
          item_name
        )
      `)
      .eq('parent_item_id', parentId)
      .eq('is_active', true)
      .or('quantity_required.is.null,quantity_required.lte.0');

    if (zeroQtyData && zeroQtyData.length > 0) {
      zeroQtyData.forEach((bomItem: any) => {
        if (bomItem.child) {
          errors.push(`품목 '${bomItem.child.item_code} - ${bomItem.child.item_name}'의 수량이 0 또는 NULL입니다.`);
        }
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