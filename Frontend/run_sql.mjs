import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function runSQL() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const sql = fs.readFileSync("../fix_grades_duplication.sql", "utf8");

  console.log("🚀 Executing SQL Merge...");
  
  // Note: Direct SQL execution requires a custom RPC. 
  // If exec_sql is not available, we will try another approach.
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });

  if (error) {
    console.error("❌ SQL Error:", error.message);
    if (error.message.includes("does not exist")) {
      console.log("💡 Suggestion: Please copy and run the content of fix_grades_duplication.sql manually in the Supabase SQL Editor if you don't have the exec_sql RPC.");
    }
  } else {
    console.log("✅ SQL executed successfully!");
    console.log(data);
  }
}

runSQL();
