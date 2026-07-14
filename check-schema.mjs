
const url = process.env.VITE_SUPABASE_URL || 'https://bnmzwuxzdfrysngaagxr.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function check() {
  try {
    const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
    const data = await res.json();
    console.log("Tables found in OpenAPI spec:", Object.keys(data.definitions || {}));
  } catch(e) {
    console.error("Failed to fetch schema", e);
  }
}
check();
