import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching sales_entries date range...");
  const { data, error } = await supabase
    .from('sales_entries')
    .select('*')
    .gte('date', '2026-07-01')
    .lte('date', '2026-07-31');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Data count:", data.length);
  }
}

test();
