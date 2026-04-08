const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "Frontend/.env" });

async function check() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log("Checking grades for duplicates...");
  
  const { data, error } = await supabase
    .from("grades")
    .select("id, student_id, matiere_id, trimestre, evaluation_type, school_year, created_at");

  if (error) {
    console.error("❌ Error fetching grades:", error);
    return;
  }

  const counts = {};
  const duplicates = [];

  data.forEach(g => {
    const key = `${g.student_id}-${g.matiere_id}-${g.trimestre}-${g.evaluation_type}-${g.school_year}`;
    if (!counts[key]) {
      counts[key] = [];
    }
    counts[key].push(g);
  });

  for (const key in counts) {
    if (counts[key].length > 1) {
      duplicates.push({
        key,
        count: counts[key].length,
        items: counts[key]
      });
    }
  }

  console.log(`Found ${duplicates.length} duplicate sets.`);
  if (duplicates.length > 0) {
    console.log("Example duplicates:");
    console.log(JSON.stringify(duplicates.slice(0, 3), null, 2));
  }
}

check();
