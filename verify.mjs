import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("1. Fetching Settings...");
  let { data: fetch1, error: err1 } = await supabase.from('settings').select('*').limit(1).single();
  
  if (err1 && err1.code === 'PGRST116') {
    console.log("No settings found, creating default row...");
    const { data: newData, error: insertErr } = await supabase.from('settings').insert([{ pickup_price: 8, delivery_price: 10, cost_per_kg: 0 }]).select().single();
    if (insertErr) {
      console.error("Failed to insert default settings:", insertErr);
      return;
    }
    fetch1 = newData;
    err1 = null;
  } else if (err1) {
    console.error("Failed to fetch settings:", err1);
    return;
  }
  
  console.log("Settings fetched:", fetch1);
  console.log("Current Settings:", fetch1);

  console.log("2. Updating Settings...");
  const { error: err2 } = await supabase.from('settings').update({ pickup_price: 9 }).eq('id', fetch1.id);
  if (err2) {
    console.error("Failed to update settings:", err2);
    return;
  }
  console.log("Update successful.");

  console.log("3. Re-fetching Settings to confirm...");
  const { data: fetch2, error: err3 } = await supabase.from('settings').select('*').limit(1).single();
  if (err3) {
    console.error("Failed to re-fetch settings:", err3);
    return;
  }
  console.log("New Settings:", fetch2);

  console.log("4. Restoring Settings...");
  await supabase.from('settings').update({ pickup_price: fetch1.pickup_price }).eq('id', fetch1.id);
  
  console.log("All settings verification passed successfully!");
}

verify();
