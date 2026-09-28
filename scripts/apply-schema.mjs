import fs from "node:fs";
import pg from "pg";

const sql = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const connectionString = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").pop();
const client = new pg.Client({ connectionString });
await client.connect();
await client.query(sql);
const tables = await client.query(
  `select tablename from pg_tables
   where schemaname = 'public' and tablename in ('statements', 'transactions')
   order by tablename`,
);
console.log(tables.rows.map((row) => row.tablename).join(","));
await client.end();
