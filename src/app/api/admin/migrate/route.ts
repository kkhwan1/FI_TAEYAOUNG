import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/db-unified';
import { parseKoreanRequest } from '@/lib/parse-korean-request';

export const dynamic = 'force-dynamic';


/**
 * POST /api/admin/migrate
 *
 * Execute database migrations directly
 * WARNING: Admin endpoint - should be protected in production
 */
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { sql } = await parseKoreanRequest<{ sql: string }>(request as any);

    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'SQL statement required' },
        { status: 400 }
      );
    }

    // Execute raw SQL using admin client
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Migration error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Migration executed successfully',
      data
    });
  } catch (error) {
    console.error('Migration execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed'
      },
      { status: 500 }
    );
  }
}
