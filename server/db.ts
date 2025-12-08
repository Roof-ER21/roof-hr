import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";
const { Pool: PgPool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Decide which driver to use. Neon driver is only needed for Neon-hosted URLs.
const parsedUrl = new URL(databaseUrl);
const isNeonHost = parsedUrl.hostname.endsWith('neon.tech');
const usePgDriver = process.env.USE_PG_DRIVER === 'true' || !isNeonHost;
const driverLabel = usePgDriver ? 'pg' : 'neon-serverless';

const pool = usePgDriver
  ? new PgPool({
      connectionString: databaseUrl,
      ssl: ['localhost', '127.0.0.1'].includes(parsedUrl.hostname)
        ? false
        : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : (() => {
      neonConfig.webSocketConstructor = ws;
      neonConfig.poolQueryViaFetch = true;
      return new NeonPool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    })();

// Handle pool errors
pool.on('error', (err) => {
  console.error(`[DB:${driverLabel}] Unexpected error on idle client`, err);
});

export const db = usePgDriver
  ? drizzlePg(pool as InstanceType<typeof PgPool>, { schema })
  : drizzleNeon({ client: pool as NeonPool, schema });

// Test database connection with retry logic
export async function testConnection(retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DB:${driverLabel}] Testing database connection (attempt ${i + 1}/${retries})...`);
      const client: any = await (pool as any).connect();
      await client.query('SELECT 1');
      client.release?.();
      console.log(`[DB:${driverLabel}] Database connection successful`);
      return true;
    } catch (error) {
      console.error(`[DB:${driverLabel}] Connection test failed (attempt ${i + 1}/${retries}):`, error);
      if (i < retries - 1) {
        console.log(`Retrying in ${(i + 1) * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
      }
    }
  }
  return false;
}
