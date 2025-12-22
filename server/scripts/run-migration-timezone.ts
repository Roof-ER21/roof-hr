/**
 * Migration script to add timezone field to users table
 * Run this with: tsx server/scripts/run-migration-timezone.ts
 */

import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('[Migration] Starting timezone field migration...');

  try {
    // Add timezone column to users table
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York'
    `);
    console.log('[Migration] ✅ Added timezone column to users table');

    // Add comment to the column
    await db.execute(sql`
      COMMENT ON COLUMN users.timezone IS 'User''s timezone for interviews and calendar events (IANA timezone format)'
    `);
    console.log('[Migration] ✅ Added comment to timezone column');

    // Create index for faster timezone lookups
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone)
    `);
    console.log('[Migration] ✅ Created index on timezone column');

    console.log('[Migration] 🎉 Migration completed successfully!');
    console.log('[Migration] All users now have timezone field with default value "America/New_York"');
    console.log('[Migration] Users can update their timezone in Settings > Personal Settings');

    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
