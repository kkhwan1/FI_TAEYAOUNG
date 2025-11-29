/**
 * Verification Script for BLANKING Classification
 *
 * Verifies that all items with BLANKING keywords are properly classified
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyBlankingClassification() {
  console.log('🔍 BLANKING Classification Verification Report');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Check 1: Count of items with press_process_type = 'BLANKING'
    const { data: blankingItems, error: error1 } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, press_process_type')
      .eq('is_active', true)
      .eq('press_process_type', 'BLANKING');

    if (error1) throw error1;

    console.log(`✅ Total Active Items with BLANKING: ${blankingItems?.length || 0}`);
    console.log('');

    // Check 2: Any items with BLANKING keywords but still NULL press_process_type
    const { data: missingItems, error: error2 } = await supabase
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

    if (error2) throw error2;

    console.log(`📋 Items with BLANKING keywords but NULL press_process_type: ${missingItems?.length || 0}`);
    console.log('');

    if (missingItems && missingItems.length > 0) {
      console.log('⚠️  WARNING: The following items should be classified as BLANKING:');
      missingItems.forEach((item, index) => {
        console.log(`  ${index + 1}. [${item.item_code}] ${item.item_name}`);
      });
      console.log('');
    }

    // Check 3: Display all BLANKING items
    if (blankingItems && blankingItems.length > 0) {
      console.log('📊 All Items Classified as BLANKING:');
      console.log('-'.repeat(70));
      blankingItems.forEach((item, index) => {
        console.log(`${(index + 1).toString().padStart(2, ' ')}. [${item.item_code}] ${item.item_name}`);
      });
      console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ BLANKING Items: ${blankingItems?.length || 0}`);
    console.log(`❌ Missing Classifications: ${missingItems?.length || 0}`);
    console.log(`📋 Status: ${(missingItems?.length || 0) === 0 ? '✅ Complete' : '⚠️  Incomplete'}`);
    console.log('');

  } catch (error) {
    console.error('❌ ERROR:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

verifyBlankingClassification();
