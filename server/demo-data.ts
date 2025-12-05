import { storage } from './storage';
import bcrypt from 'bcrypt';
import { db } from './db';
import { toolInventory } from '../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

export async function setupDemoData() {
  try {
    // Demo users
    const demoUsers = [
      {
        email: 'admin@roof-er.com',
        password: 'admin123',
        firstName: 'John',
        lastName: 'Admin',
        role: 'ADMIN' as const,
        employmentType: 'W2' as const,
        department: 'Administration',
        position: 'System Administrator',
        hireDate: '2023-01-01',
        phone: '555-0101',
        address: '123 Admin St',
        emergencyContact: 'Jane Admin',
        emergencyPhone: '555-0102',
      },
      {
        email: 'manager@roof-er.com',
        password: 'manager123',
        firstName: 'Sarah',
        lastName: 'Manager',
        role: 'MANAGER' as const,
        employmentType: 'W2' as const,
        department: 'Operations',
        position: 'General Manager',
        hireDate: '2023-02-01',
        phone: '555-0201',
        address: '456 Manager Ave',
        emergencyContact: 'Bob Manager',
        emergencyPhone: '555-0202',
      },
      {
        email: 'employee@roof-er.com',
        password: 'employee123',
        firstName: 'Mike',
        lastName: 'Worker',
        role: 'EMPLOYEE' as const,
        employmentType: 'W2' as const,
        department: 'Field Operations',
        position: 'Field Worker',
        hireDate: '2023-03-01',
        phone: '555-0301',
        address: '789 Worker Blvd',
        emergencyContact: 'Susan Worker',
        emergencyPhone: '555-0302',
      },
      {
        email: 'contractor@roof-er.com',
        password: 'contractor123',
        firstName: 'Tom',
        lastName: 'Contractor',
        role: 'CONTRACTOR' as const,
        employmentType: 'CONTRACTOR' as const,
        department: 'Field Operations',
        position: 'Independent Contractor',
        hireDate: '2023-04-01',
        phone: '555-0401',
        address: '321 Contractor Rd',
        emergencyContact: 'Lisa Contractor',
        emergencyPhone: '555-0402',
      },
    ];

    for (const userData of demoUsers) {
      try {
        // Check if user already exists
        const existingUser = await storage.getUserByEmail(userData.email);
        if (existingUser) {
          console.log(`Demo user already exists: ${userData.email}`);
          continue;
        }

        // Create user
        const passwordHash = await bcrypt.hash(userData.password, 10);
        const user = await storage.createUser({
          ...userData,
          passwordHash,
          isActive: true,
        });
        console.log(`Created demo user: ${user.email}`);
      } catch (error) {
        console.error(`Failed to create demo user ${userData.email}:`, error);
      }
    }

    // Additional HR staff for demo purposes
    const hrStaff = [
      {
        email: 'hr1@roof-er.com',
        password: 'hr123',
        firstName: 'Alex',
        lastName: 'Recruiter',
        role: 'EMPLOYEE' as const,
        employmentType: 'W2' as const,
        department: 'Human Resources',
        position: 'Senior Recruiter',
        hireDate: '2023-05-01',
        phone: '555-0501',
        address: '111 HR St',
        emergencyContact: 'Sarah Recruiter',
        emergencyPhone: '555-0502',
      },
      {
        email: 'hr2@roof-er.com',
        password: 'hr123',
        firstName: 'Maria',
        lastName: 'Coordinator',
        role: 'EMPLOYEE' as const,
        employmentType: 'W2' as const,
        department: 'Human Resources',
        position: 'HR Coordinator',
        hireDate: '2023-06-01',
        phone: '555-0601',
        address: '222 HR Ave',
        emergencyContact: 'Carlos Coordinator',
        emergencyPhone: '555-0602',
      },
      {
        email: 'hr3@roof-er.com',
        password: 'hr123',
        firstName: 'David',
        lastName: 'Specialist',
        role: 'EMPLOYEE' as const,
        employmentType: 'W2' as const,
        department: 'Human Resources',
        position: 'HR Specialist',
        hireDate: '2023-07-01',
        phone: '555-0701',
        address: '333 HR Blvd',
        emergencyContact: 'Linda Specialist',
        emergencyPhone: '555-0702',
      },
    ];

    // Create HR staff users
    for (let i = 0; i < hrStaff.length; i++) {
      const userData = hrStaff[i];

      try {
        // Check if user exists
        let user = await storage.getUserByEmail(userData.email);
        if (!user) {
          const passwordHash = await bcrypt.hash(userData.password, 10);
          user = await storage.createUser({
            ...userData,
            passwordHash,
            isActive: true,
          });
          console.log(`Created HR staff user: ${user.email}`);
        } else {
          console.log(`Demo user already exists: ${userData.email}`);
        }
      } catch (error) {
        console.error(`Failed to create HR staff user ${userData.email}:`, error);
      }
    }

    // Setup initial tool inventory data
    console.log('Setting up demo tool inventory...');
    
    // Get admin user for createdBy field
    const adminUser = await storage.getUserByEmail('admin@roof-er.com');
    if (!adminUser) {
      console.log('Admin user not found, skipping tool inventory setup');
      return;
    }

    const demoToolInventory = [
      // Laptops
      {
        id: uuidv4(),
        name: 'Dell Latitude 5530',
        category: 'LAPTOP' as const,
        description: 'Business laptop with Intel i7, 16GB RAM, 512GB SSD',
        serialNumber: 'DL5530-001',
        model: 'Latitude 5530',
        quantity: 15,
        availableQuantity: 12,
        condition: 'NEW' as const,
        purchaseDate: new Date('2024-01-15'),
        purchasePrice: 129999, // $1299.99 in cents
        location: 'IT Department',
        notes: 'Standard issue for office staff',
        isActive: true,
        createdBy: adminUser.id
      },
      {
        id: uuidv4(),
        name: 'HP ProBook 450',
        category: 'LAPTOP' as const,
        description: 'Field laptop with Intel i5, 8GB RAM, 256GB SSD',
        serialNumber: 'HP450-001',
        model: 'ProBook 450 G9',
        quantity: 10,
        availableQuantity: 7,
        condition: 'GOOD' as const,
        purchaseDate: new Date('2023-11-20'),
        purchasePrice: 89999, // $899.99 in cents
        location: 'IT Department',
        notes: 'Rugged laptops for field workers',
        isActive: true,
        createdBy: adminUser.id
      },
      {
        id: uuidv4(),
        name: 'MacBook Pro 14"',
        category: 'LAPTOP' as const,
        description: 'Apple M3 Pro, 18GB RAM, 512GB SSD',
        serialNumber: 'MBP14-001',
        model: 'MacBook Pro 14 2024',
        quantity: 5,
        availableQuantity: 3,
        condition: 'NEW' as const,
        purchaseDate: new Date('2024-03-01'),
        purchasePrice: 219999, // $2199.99 in cents
        location: 'Executive Office',
        notes: 'For executives and design team',
        isActive: true,
        createdBy: adminUser.id
      },
      // Count Adjusters (categorized as OTHER)
      {
        id: uuidv4(),
        name: 'Tape Measure 25ft',
        category: 'OTHER' as const,
        description: 'Professional grade measuring tape with magnetic tip',
        serialNumber: 'TM25-BATCH-01',
        model: 'Stanley FatMax 25',
        quantity: 50,
        availableQuantity: 42,
        condition: 'GOOD' as const,
        purchaseDate: new Date('2024-02-01'),
        purchasePrice: 2499, // $24.99 in cents
        location: 'Tool Storage A',
        notes: 'Essential measuring tool for all field crews',
        isActive: true,
        createdBy: adminUser.id
      },
      {
        id: uuidv4(),
        name: 'Digital Laser Measure',
        category: 'OTHER' as const,
        description: 'Bosch GLM 50 laser distance measurer, 165ft range',
        serialNumber: 'DLM-001',
        model: 'Bosch GLM 50',
        quantity: 20,
        availableQuantity: 16,
        condition: 'NEW' as const,
        purchaseDate: new Date('2024-01-10'),
        purchasePrice: 11999, // $119.99 in cents
        location: 'Tool Storage A',
        notes: 'For accurate roof measurements',
        isActive: true,
        createdBy: adminUser.id
      },
      {
        id: uuidv4(),
        name: 'Pitch Gauge',
        category: 'OTHER' as const,
        description: 'Magnetic pitch gauge for roof slope measurement',
        serialNumber: 'PG-BATCH-01',
        model: 'Johnson Level 750',
        quantity: 30,
        availableQuantity: 25,
        condition: 'GOOD' as const,
        purchaseDate: new Date('2023-12-15'),
        purchasePrice: 3499, // $34.99 in cents
        location: 'Tool Storage A',
        notes: 'Essential for accurate pitch measurements',
        isActive: true,
        createdBy: adminUser.id
      },
      // Additional Tools
      {
        id: uuidv4(),
        name: 'Extension Ladder 32ft',
        category: 'LADDER' as const,
        description: 'Aluminum extension ladder, Type IA 300lb capacity',
        serialNumber: 'EL32-001',
        model: 'Werner D6232-2',
        quantity: 25,
        availableQuantity: 20,
        condition: 'GOOD' as const,
        purchaseDate: new Date('2023-10-01'),
        purchasePrice: 44999, // $449.99 in cents
        location: 'Equipment Yard',
        notes: 'Primary access equipment for roofing crews',
        isActive: true,
        createdBy: adminUser.id
      },
      {
        id: uuidv4(),
        name: 'Roofing Nail Gun',
        category: 'OTHER' as const,
        description: 'Pneumatic coil roofing nailer',
        serialNumber: 'RNG-001',
        model: 'Bostitch RN46-1',
        quantity: 35,
        availableQuantity: 28,
        condition: 'GOOD' as const,
        purchaseDate: new Date('2024-01-20'),
        purchasePrice: 29999, // $299.99 in cents
        location: 'Tool Storage B',
        notes: 'Standard roofing nailer for shingle installation',
        isActive: true,
        createdBy: adminUser.id
      },
      {
        id: uuidv4(),
        name: 'Safety Harness Kit',
        category: 'OTHER' as const,
        description: 'Full body harness with shock absorbing lanyard',
        serialNumber: 'SH-BATCH-01',
        model: '3M Protecta PRO',
        quantity: 40,
        availableQuantity: 32,
        condition: 'NEW' as const,
        purchaseDate: new Date('2024-02-15'),
        purchasePrice: 14999, // $149.99 in cents
        location: 'Safety Equipment Room',
        notes: 'OSHA compliant fall protection',
        isActive: true,
        createdBy: adminUser.id
      },
      {
        id: uuidv4(),
        name: 'Circular Saw',
        category: 'OTHER' as const,
        description: '7-1/4" circular saw with laser guide',
        serialNumber: 'CS-001',
        model: 'DeWalt DWE575SB',
        quantity: 20,
        availableQuantity: 15,
        condition: 'GOOD' as const,
        purchaseDate: new Date('2023-11-01'),
        purchasePrice: 15999, // $159.99 in cents
        location: 'Tool Storage B',
        notes: 'For cutting decking and sheathing',
        isActive: true,
        createdBy: adminUser.id
      }
    ];

    // Check and insert tool inventory
    for (const tool of demoToolInventory) {
      try {
        const [existingTool] = await db
          .select()
          .from(toolInventory)
          .where(eq(toolInventory.serialNumber, tool.serialNumber));
        
        if (!existingTool) {
          await db.insert(toolInventory).values(tool);
          console.log(`Created tool inventory item: ${tool.name}`);
        } else {
          console.log(`Tool already exists: ${tool.name}`);
        }
      } catch (error) {
        console.error(`Failed to create tool: ${tool.name}`, error);
      }
    }

    console.log('Demo data setup completed');
  } catch (error) {
    console.error('Failed to setup demo data:', error);
  }
}