import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db-unified';
import { protectRoute } from '@/lib/middleware';
import { safeMathMax } from '@/lib/api-utils';
import {
  explodeBom,
  getBomTree,
  calculateTotalCost,
  getBomLevelSummary,
  getWhereUsed,
  validateBom,
  type BOMNode
} from '@/lib/bom';

export const dynamic = 'force-dynamic';


interface TreeStats {
  totalItems: number;
  totalCost: number;
  maxLevel: number;
}

/**
 * GET /api/bom/explode
 * BOM 전개 및 관련 정보 조회
 *
 * Query Parameters:
 * - parent_item_id: 상위 품목 ID (필수)
 * - type: 조회 유형 (explode, tree, cost, summary, where-used, validate)
 * - max_level: 최대 전개 레벨 (기본값: 10)
 * - include_inactive: 비활성 항목 포함 여부 (기본값: false)
 */
export const GET = protectRoute(
  async (request: NextRequest, _user) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const parentItemId = searchParams.get('parent_item_id');
      const childItemId = searchParams.get('child_item_id');
      const type = searchParams.get('type') || 'explode';
      const maxLevel = parseInt(searchParams.get('max_level') || '10');
      const includeInactive = searchParams.get('include_inactive') === 'true';

      // WHERE-USED 조회의 경우 child_item_id 사용
      if (type === 'where-used') {
        if (!childItemId) {
          return NextResponse.json({
            success: false,
            error: 'child_item_id가 필요합니다'
          }, { status: 400 });
        }

        const whereUsedData = await getWhereUsed(null, parseInt(childItemId));

        return NextResponse.json({
          success: true,
          data: whereUsedData
        });
      }

      // 나머지 조회 유형은 parent_item_id 필요
      if (!parentItemId) {
        return NextResponse.json({
          success: false,
          error: 'parent_item_id가 필요합니다'
        }, { status: 400 });
      }

      const itemId = parseInt(parentItemId);

      switch (type) {
        case 'explode': {
          // BOM 전개 (평면 구조)
          const explodedBom = await explodeBom(null, itemId, 0, maxLevel, 1);

          // 평면 구조로 변환 (트리를 플랫하게)
          const flattenBom = (nodes: BOMNode[], result: BOMNode[] = []): BOMNode[] => {
            for (const node of nodes) {
              const { children, ...nodeData } = node;
              result.push(nodeData);
              if (children && children.length > 0) {
                flattenBom(children, result);
              }
            }
            return result;
          };

          const flatData = flattenBom(explodedBom);

          return NextResponse.json({
            success: true,
            data: flatData,
            summary: {
              total_items: flatData.length,
              max_level: safeMathMax(flatData.map(item => item.level), 0),
              total_cost: flatData.reduce((sum, item) => sum + (item.total_price || 0), 0)
            }
          });
        }

        case 'tree': {
          // BOM 트리 구조
          const bomTree = await getBomTree(null, itemId, includeInactive);

          if (!bomTree) {
            return NextResponse.json({
              success: false,
              error: '품목을 찾을 수 없거나 BOM이 존재하지 않습니다'
            }, { status: 404 });
          }

          // 트리 통계 계산
          const calculateTreeStats = (node: BOMNode): TreeStats => {
            let totalItems = 1;
            let totalCost = node.total_price || 0;
            let maxLevel = node.level || 0;

            if (node.children && node.children.length > 0) {
              for (const child of node.children) {
                const childStats = calculateTreeStats(child);
                totalItems += childStats.totalItems;
                totalCost += childStats.totalCost;
                maxLevel = Math.max(maxLevel, childStats.maxLevel);
              }
            }

            return { totalItems, totalCost, maxLevel };
          };

          const stats = calculateTreeStats(bomTree);

          return NextResponse.json({
            success: true,
            data: bomTree,
            summary: {
              total_items: stats.totalItems,
              max_level: stats.maxLevel,
              total_cost: stats.totalCost
            }
          });
        }

        case 'cost': {
          // 총 원가 계산
          const totalCost = await calculateTotalCost(null, itemId);

          // 상위 품목 정보 조회
          const { data: itemData, error: itemError } = await supabaseAdmin
            .from('items')
            .select('item_code, item_name, spec, unit_price')
            .eq('item_id', itemId)
            .single() as any;

          if (itemError || !itemData) {
            return NextResponse.json({
              success: false,
              error: '품목을 찾을 수 없습니다'
            }, { status: 404 });
          }

          return NextResponse.json({
            success: true,
            data: {
              item: itemData,
              material_cost: totalCost,
              item_price: itemData.unit_price || 0,
              margin: (itemData.unit_price || 0) - Number(totalCost || 0),
              margin_rate: (itemData.unit_price || 0) > 0
                ? (((itemData.unit_price || 0) - Number(totalCost || 0)) / (itemData.unit_price || 0) * 100).toFixed(2) + '%'
                : '0%'
            }
          });
        }

        case 'summary': {
          // 레벨별 요약
          const levelSummary = await getBomLevelSummary(null, itemId);

          const totalSummary = levelSummary.reduce((acc, level) => ({
            total_items: acc.total_items + level.item_count,
            total_quantity: acc.total_quantity + level.total_quantity,
            total_cost: acc.total_cost + level.level_cost
          }), {
            total_items: 0,
            total_quantity: 0,
            total_cost: 0
          });

          return NextResponse.json({
            success: true,
            data: {
              levels: levelSummary,
              total: totalSummary
            }
          });
        }

        case 'validate': {
          // BOM 유효성 검사
          const validation = await validateBom(null, itemId);

          return NextResponse.json({
            success: true,
            data: validation
          });
        }

        default: {
          return NextResponse.json({
            success: false,
            error: `지원하지 않는 조회 유형입니다: ${type}`
          }, { status: 400 });
        }
      }

    } catch (error) {
      console.error('Error in BOM explode:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'BOM 처리 중 오류가 발생했습니다'
        },
        { status: 500 }
      );
    }
  },
  { resource: 'production', action: 'read' }
);

/**
 * POST /api/bom/explode
 * BOM 일괄 전개 (여러 품목 동시 조회)
 */
export const POST = protectRoute(
  async (request: NextRequest, _user) => {
    try {
      const text = await request.text();
      const body = JSON.parse(text);
      const { item_ids, type = 'explode', max_level = 10 } = body;

      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'item_ids 배열이 필요합니다'
        }, { status: 400 });
      }

      const results = [];

      for (const itemId of item_ids) {
        try {
          let itemResult;

          switch (type) {
            case 'explode': {
              const explodedBom = await explodeBom(null, itemId, 0, max_level, 1);
              itemResult = {
                item_id: itemId,
                success: true,
                data: explodedBom
              };
              break;
            }

            case 'cost': {
              const totalCost = await calculateTotalCost(null, itemId);
              itemResult = {
                item_id: itemId,
                success: true,
                cost: totalCost
              };
              break;
            }

            case 'validate': {
              const validation = await validateBom(null, itemId);
              itemResult = {
                item_id: itemId,
                success: true,
                validation
              };
              break;
            }

            default: {
              itemResult = {
                item_id: itemId,
                success: false,
                error: `지원하지 않는 조회 유형: ${type}`
              };
            }
          }

          results.push(itemResult);

        } catch (error) {
          results.push({
            item_id: itemId,
            success: false,
            error: `처리 실패: ${error}`
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      return NextResponse.json({
        success: true,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        },
        data: results
      });

    } catch (error) {
      console.error('Error in batch BOM explode:', error);
      return NextResponse.json(
        {
          success: false,
          error: '일괄 BOM 처리 중 오류가 발생했습니다'
        },
        { status: 500 }
      );
    }
  },
  { resource: 'production', action: 'read' }
);