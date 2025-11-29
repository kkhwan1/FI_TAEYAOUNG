/**
 * BLANKING Press Process Type Classification Script
 *
 * Purpose: Classify items with BLANKING-related keywords into press_process_type = 'BLANKING'
 *
 * Search Keywords:
 * - B/K, BK, BLK, BLANK, 블랭킹
 * - Searches in: item_name, item_code
 *
 * Conditions:
 * - is_active = true
 * - press_process_type IS NULL
 * - Contains any of the keywords (case-insensitive)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  press_process_type: string | null;
}

async function classifyBlankingItems() {
  console.log('🔍 BLANKING Press Process Type Classification');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Query items matching BLANKING keywords
    console.log('📊 Step 1: Querying items with BLANKING keywords...');
    console.log('');
    console.log('Search Criteria:');
    console.log('  - Keywords: B/K, BK, BLK, BLANK, 블랭킹');
    console.log('  - Fields: item_name, item_code');
    console.log('  - Conditions: is_active = true AND press_process_type IS NULL');
    console.log('');

    const { data: candidateItems, error: queryError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, press_process_type')
      .eq('is_active', true)
      .is('press_process_type', null)
      .or(
        'item_name.ilike.%B/K%,' +
        'item_name.ilike.%BK%,' +
        'item_name.ilike.%BLK%,' +
        'item_name.ilike.%BLANK%,' +
        'item_name.ilike.%블랭킹%,' +
        'item_code.ilike.%B/K%,' +
        'item_code.ilike.%BK%,' +
        'item_code.ilike.%BLK%,' +
        'item_code.ilike.%BLANK%,' +
        'item_code.ilike.%블랭킹%'
      );

    if (queryError) {
      console.error('❌ Query Error:', queryError.message);
      throw queryError;
    }

    console.log(`✅ Found ${candidateItems?.length || 0} candidate items`);
    console.log('');

    if (!candidateItems || candidateItems.length === 0) {
      console.log('ℹ️  No items found matching BLANKING keywords');
      console.log('');
      return;
    }

    // Step 2: Display candidate items
    console.log('📋 Step 2: Candidate Items for BLANKING Classification');
    console.log('-'.repeat(60));
    candidateItems.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. [${item.item_code}] ${item.item_name}`);
    });
    if (candidateItems.length > 10) {
      console.log(`... and ${candidateItems.length - 10} more items`);
    }
    console.log('');

    // Step 3: Execute UPDATE query
    console.log('🔄 Step 3: Updating press_process_type to BLANKING...');
    console.log('');

    const itemIds = candidateItems.map(item => item.item_id);

    const { data: updateData, error: updateError, count } = await supabase
      .from('items')
      .update({ press_process_type: 'BLANKING' })
      .in('item_id', itemIds)
      .select();

    if (updateError) {
      console.error('❌ Update Error:', updateError.message);
      throw updateError;
    }

    console.log(`✅ Successfully updated ${updateData?.length || 0} items`);
    console.log('');

    // Step 4: Verify updates
    console.log('✔️  Step 4: Verification - Updated Items');
    console.log('-'.repeat(60));

    const { data: verifiedItems, error: verifyError } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, press_process_type')
      .in('item_id', itemIds)
      .eq('press_process_type', 'BLANKING');

    if (verifyError) {
      console.error('❌ Verification Error:', verifyError.message);
      throw verifyError;
    }

    console.log(`Verified: ${verifiedItems?.length || 0} items now have press_process_type = 'BLANKING'`);
    console.log('');

    // Display sample of updated items
    if (verifiedItems && verifiedItems.length > 0) {
      console.log('Sample Updated Items:');
      verifiedItems.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. [${item.item_code}] ${item.item_name}`);
        console.log(`     → press_process_type: ${item.press_process_type}`);
      });
      if (verifiedItems.length > 5) {
        console.log(`  ... and ${verifiedItems.length - 5} more items`);
      }
    }
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Total Items Updated: ${updateData?.length || 0}`);
    console.log(`✅ Verified Items: ${verifiedItems?.length || 0}`);
    console.log(`📋 Process Type: BLANKING`);
    console.log('');
    console.log('✅ Classification completed successfully!');

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error instanceof Error ? error.message : 'Unknown error');
    console.error('');
    process.exit(1);
  }
}

// Execute the classification
classifyBlankingItems();
