const fs = require('fs');

async function run() {
  const token = 'sbp_7e3c898872d82c05d04704b1e32d69196ebda28a';
  const ref = 'aeaisolmobsvreujofwa';

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: "SELECT table_name, column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
    })
  });

  if (!res.ok) {
    console.log('Status:', res.status, await res.text());
    return;
  }
  const data = await res.json();
  fs.writeFileSync('sql/schema-dump.json', JSON.stringify(data, null, 2));

  // Pretty print by table
  const tables = {};
  for (const row of data) {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(row);
  }

  for (const [tbl, cols] of Object.entries(tables)) {
    console.log(`\n=== ${tbl} (${cols.length} columns) ===`);
    for (const c of cols) {
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
      const nullable = c.is_nullable === 'YES' ? ' NULL' : ' NOT NULL';
      console.log(`  ${c.column_name.padEnd(35)} ${c.data_type}${nullable}${def}`);
    }
  }
}

run().catch(e => console.error(e));
