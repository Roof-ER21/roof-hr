#!/usr/bin/env tsx

import bcrypt from 'bcrypt';
import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'TRUE_ADMIN' | 'ADMIN' | 'GENERAL_MANAGER' | 'TERRITORY_SALES_MANAGER' | 'MANAGER' | 'EMPLOYEE' | 'CONTRACTOR' | 'SALES_REP' | 'FIELD_TECH';
  employmentType: 'W2' | '1099' | 'CONTRACTOR' | 'SUB_CONTRACTOR';
  department: string;
  position: string;
}

const testUsers: TestUser[] = [
  {
    email: 'ahmed.mahmoud@theroofdocs.com',
    password: 'Admin123!',
    firstName: 'Ahmed',
    lastName: 'Mahmoud',
    role: 'TRUE_ADMIN',
    employmentType: 'W2',
    department: 'Executive',
    position: 'CEO & Founder'
  },
  {
    email: 'ford.barsi@theroofdocs.com',
    password: 'Manager123!',
    firstName: 'Ford',
    lastName: 'Barsi',
    role: 'GENERAL_MANAGER',
    employmentType: 'W2',
    department: 'Management',
    position: 'General Manager'
  },
  {
    email: 'test.employee@company.com',
    password: 'Employee123!',
    firstName: 'Test',
    lastName: 'Employee',
    role: 'EMPLOYEE',
    employmentType: 'W2',
    department: 'Operations',
    position: 'Staff Member'
  },
  {
    email: 'admin@test.com',
    password: 'Admin123!',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'ADMIN',
    employmentType: 'W2',
    department: 'IT',
    position: 'System Administrator'
  }
];

async function setupTestUsers() {
  console.log('🚀 Setting up test users...\n');
  
  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUsers = await db.select().from(users).where(eq(users.email, userData.email));
      
      if (existingUsers.length > 0) {
        console.log(`✓ User ${userData.email} already exists, skipping...`);
        continue;
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 10);
      
      // Create user
      const newUser = {
        id: uuidv4(),
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        employmentType: userData.employmentType,
        department: userData.department,
        position: userData.position,
        hireDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
        isActive: true,
        mustChangePassword: false, // Test users don't need to change password
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(users).values(newUser);
      
      console.log(`✅ Created user: ${userData.email}`);
      console.log(`   Name: ${userData.firstName} ${userData.lastName}`);
      console.log(`   Role: ${userData.role}`);
      console.log(`   Password: ${userData.password}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error);
    }
  }
  
  console.log('\n🎉 Test users setup complete!');
  console.log('\nYou can now login with:');
  console.log('═══════════════════════════════════════════');
  testUsers.forEach(user => {
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Password: ${user.password}`);
    console.log(`👤 Role: ${user.role}`);
    console.log('---');
  });
  
  process.exit(0);
}

// Run the setup
setupTestUsers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});