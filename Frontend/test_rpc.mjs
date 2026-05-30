import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "api/.env" });

async function runTest() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: "SELECT 1 as val;" });
  if (error) {
    console.error("❌ RPC Error:", error.message);
  } else {
    console.log("✅ Success! RPC Output:", data);
  }
}
runTest();
