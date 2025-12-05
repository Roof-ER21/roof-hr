#!/usr/bin/env node

/**
 * Script to create an admin user for production deployment
 * Usage: node scripts/create-admin.js <email> <password> <firstName> <lastName>
 */

import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { users } from '../shared/schema.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
  console.log('Usage: node scripts/create-admin.js <email> <password> <firstName> <lastName>');
  console.log('Example: node scripts/create-admin.js admin@company.com MySecurePass123 John Doe');
  process.exit(1);
}

const [email, password, firstName, lastName] = args;

// Validate password length
if (password.length < 8) {
  console.error('❌ Password must be at least 8 characters long');
  process.exit(1);
}

async function createAdmin() {
  try {
    // Create database connection
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Check if user already exists
    const existingUsers = await db.select().from(users).where(eq(users.email, email));
    if (existingUsers.length > 0) {
      console.error(`❌ User with email ${email} already exists`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const newUser = {
      id: uuidv4(),
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'ADMIN',
      employmentType: 'W2',
      department: 'Management',
      position: 'Administrator',
      isActive: true,
      hireDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(users).values(newUser);

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Role: ADMIN`);
    console.log('\nYou can now log in with these credentials.');
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

// Run the script
createAdmin();