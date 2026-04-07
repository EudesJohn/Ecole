const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../Backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking students table schema...');
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching students:', error.message);
    if (error.message.includes('parent_id')) {
      console.log('CONFIRMED: parent_id column is missing from students table in live database.');
    }
  } else {
    console.log('Successfully fetched student row (metadata check needed).');
    // Check keys of the first row
    if (data.length > 0) {
      const keys = Object.keys(data[0]);
      if (keys.includes('parent_id')) {
        console.log('SUCCESS: parent_id column exists in database.');
      } else {
        console.log('FAILURE: parent_id column is ABSENT from returned row keys.');
      }
    } else {
      console.log('No data in students table - testing direct schema query...');
      // Try to select just the column
      const { error: colError } = await supabase.from('students').select('parent_id').limit(1);
      if (colError) {
          console.error('Error selecting parent_id:', colError.message);
      } else {
          console.log('parent_id column is accessible via select.');
      }
    }
  }
}

checkSchema();
