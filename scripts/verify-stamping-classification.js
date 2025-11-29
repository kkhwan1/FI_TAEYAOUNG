const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    // Check STAMPING items
    const { data: stampingItems, error: e1 } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, press_process_type')
      .eq('press_process_type', 'STAMPING')
      .eq('is_active', true);

    console.log('\n✅ Total STAMPING items:', stampingItems?.length || 0);
    console.log('\n📋 STAMPING classified items:');
    console.log('='.repeat(80));
    if (stampingItems && stampingItems.length > 0) {
      stampingItems.forEach((item, i) => {
        console.log(`${i+1}. [${item.item_code}] ${item.item_name}`);
      });
    }

    // Check for items with STAMPING keywords but different classification
    const { data: existingType, error: e2 } = await supabase
      .from('items')
      .select('item_id, item_code, item_name, press_process_type')
      .eq('is_active', true)
      .not('press_process_type', 'is', null)
      .neq('press_process_type', 'STAMPING')
      .or(
        'item_name.ilike.% DR %,' +
        'item_name.ilike.%-DR%,' +
        'item_name.ilike.%DRAW%,' +
        'item_name.ilike.%FORM%,' +
        'item_name.ilike.%F/M%,' +
        'item_name.ilike.%성형%,' +
        'item_name.ilike.%STAMP%'
      );

    console.log('\n\n📊 Items with STAMPING keywords but different classification:');
    console.log('='.repeat(80));
    if (existingType && existingType.length > 0) {
      existingType.forEach((item, i) => {
        console.log(`${i+1}. [${item.item_code}] ${item.item_name}`);
        console.log(`   → Current Type: ${item.press_process_type}`);
      });
    } else {
      console.log('None found - all matching items are classified as STAMPING');
    }

    // Overall statistics
    const { data: stats, error: e3 } = await supabase
      .from('items')
      .select('press_process_type')
      .eq('is_active', true);

    const typeCounts = {};
    stats?.forEach(item => {
      const type = item.press_process_type || 'NULL';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    console.log('\n\n📈 Overall Press Process Type Distribution:');
    console.log('='.repeat(80));
    Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      const percentage = ((count / stats.length) * 100).toFixed(1);
      console.log(`  ${type.padEnd(20)}: ${count.toString().padStart(5)} items (${percentage}%)`);
    });
    console.log(`\nTotal Active Items: ${stats?.length || 0}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
