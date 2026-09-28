import { Pool, type PoolClient, type QueryResultRow } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export type Query = typeof query;

export async function withTransaction<R>(work: (tx: Query) => Promise<R>) {
  const client: PoolClient = await pool.connect();
  const tx: Query = async (text, params = []) => (await client.query(text, params)).rows;
  try {
    await client.query("begin");
    const result = await work(tx);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
