import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users } from '../shared/schema.ts';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

const newEmployeeData = [
  { name: 'Adam Schianodicola', title: 'Sales Rep', phone: '(703) 239-3101', email: 'adam.schianodicola@theroofdocs.com', start_year: 2024 },
  { name: 'Ahmed Mahmoud', title: 'Admin', phone: '(703) 239-3629', email: 'ahmed.mahmoud@theroofdocs.com', start_year: 2022 },
  { name: 'Alex Ortega', title: 'Ops Manager', phone: '(617) 780-1666', email: 'alex.ortega@theroofdocs.com', start_year: 2022 },
  { name: 'Andre Mealy', title: 'Team Lead', phone: '(703) 239-3371', email: 'andre.mealy@theroofdocs.com', start_year: 2022 },
  { name: 'Basel Halim', title: 'Sales Rep', phone: '(703) 239-3618', email: 'basel.halim@theroofdocs.com', start_year: 2024 },
  { name: 'Benjamin Kosa', title: 'Sales Manager', phone: '(703) 239-3738', email: 'ben.kosa@theroofdocs.com', start_year: 2022 },
  { name: 'Benjamin Salgado', title: 'Sales Rep', phone: '(703) 239-3134', email: 'ben.salgado@theroofdocs.com', start_year: 2024 },
  { name: 'Brandon Havens', title: 'Sales Rep', phone: '(484) 206-5192', email: 'brandon.havens@theroofdocs.com', start_year: 2024 },
  { name: 'Brandon Pernot', title: 'Ops Manager', phone: '(703) 239-3705', email: 'brandon.pernot@theroofdocs.com', start_year: 2022 },
  { name: 'Brandon Romberger', title: 'Sales Rep', phone: '(267) 217-3063', email: 'brandon.r@theroofdocs.com', start_year: 2024 },
  { name: 'Brett McCrane', title: 'Sales Rep', phone: '(703) 239-3738', email: 'brett.m@theroofdocs.com', start_year: 2024 },
  { name: 'Bruno Nacipucha', title: 'Sales Rep', phone: '(703) 239-3738', email: 'bruno.n@theroofdocs.com', start_year: 2022 },
  { name: 'Cadell Barnes', title: 'Project Manager', phone: '(804) 393-0634', email: 'cadell.barnes@theroofdocs.com', start_year: 2022 },
  { name: 'Carlos Davila', title: 'Sales Rep', phone: '(703) 239-3173', email: 'carlos.davila@theroofdocs.com', start_year: 2024 },
  { name: 'Chris Aycock', title: 'Sales Rep', phone: '(703) 239-3034', email: 'chris.aycock@theroofdocs.com', start_year: 2024 },
  { name: 'Christian Bratton', title: 'Sales Rep', phone: '(703) 239-3738', email: 'christian.bratton@theroofdocs.com', start_year: 2024 },
  { name: 'Conor Sullivan', title: 'Sales Rep', phone: '(703) 239-3003', email: 'Conor.Sullivan@theroofdocs.com', start_year: 2024 },
  { name: 'Daniel Alonso', title: 'Sales Rep', phone: '(703) 239-3362', email: 'daniel.alonso@theroofdocs.com', start_year: 2024 },
  { name: 'Danny Ticktin', title: 'Estimator', phone: '(703) 239-3095', email: 'danny.ticktin@theroofdocs.com', start_year: 2022 },
  { name: 'Devin Fraser', title: 'Sales Rep', phone: '(703) 239-3419', email: 'devin.fraser@theroofdocs.com', start_year: 2024 },
  { name: 'Dylan Gill', title: 'Sales Rep', phone: '(703) 239-4737', email: 'dylan.gill@theroofdocs.com', start_year: 2024 },
  { name: 'Edmund O\'Brien', title: 'Project Coordinator', phone: '(270) 839-4971', email: 'edmund.obrien@theroofdocs.com', start_year: 2022 },
  { name: 'Elijah Hicks', title: 'Sales Rep', phone: '(703) 239-3686', email: 'elijah.hicks@theroofdocs.com', start_year: 2024 },
  { name: 'Eric Philippeau', title: 'Sales Rep', phone: '(267) 217-3202', email: 'eric.p@theroofdocs.com', start_year: 2024 },
  { name: 'Eric Rickel', title: 'Sales Rep', phone: '(484) 206-5130', email: 'eric.rickel@theroofdocs.com', start_year: 2024 },
  { name: 'Amber Couch', title: 'Lead Estimator', phone: '(703) 239-3014', email: 'estimates@theroofdocs.com', start_year: 2022 },
  { name: 'Fernando Martinez', title: 'Project Coordinator', phone: '(703) 239-3403', email: 'fernando@theroofdocs.com', start_year: 2022 },
  { name: 'Ford Barsi', title: 'Admin', phone: '(240) 354-6718', email: 'ford.barsi@theroofdocs.com', start_year: 2022 },
  { name: 'Francisco Toro', title: 'Field Tech', phone: '(703) 712-2019', email: 'francisco.toro@theroofdocs.com', start_year: 2022 },
  { name: 'Freddy Zellers', title: 'Sales Rep', phone: '(703) 239-3170', email: 'freddy.zellers@theroofdocs.com', start_year: 2024 },
  { name: 'Greg Campbell', title: 'Production Manager', phone: '(703) 232-9169', email: 'greg.campbell@theroofdocs.com', start_year: 2022 },
  { name: 'Hugo Manrique-Pinell', title: 'Sales Rep', phone: '(703) 239-3110', email: 'hugo.manrique-pinell@theroofdocs.com', start_year: 2022 },
  { name: 'Humberto Berrio', title: 'Sales Rep', phone: '(703) 239-4478', email: 'humberto.berrio@theroofdocs.com', start_year: 2024 },
  { name: 'Hunter Hall', title: 'Sales Rep', phone: '(703) 239-3058', email: 'hunter.hall@theroofdocs.com', start_year: 2024 },
  { name: 'Ian Thrash', title: 'Sales Rep', phone: '(703) 239-3398', email: 'ian.thrash@theroofdocs.com', start_year: 2024 },
  { name: 'Ibrahim Sohail', title: 'Sales Rep', phone: '(703) 493-0138', email: 'ibrahim.s@theroofdocs.com', start_year: 2024 },
  { name: 'Info TheRoofDocs', title: 'Admin', phone: '(703) 786-5789', email: 'info@theroofdocs.com', start_year: 2022 },
  { name: 'Ismael Coreas', title: 'Field Tech', phone: '(703) 559-1443', email: 'ismael.coreas@theroofdocs.com', start_year: 2022 },
  { name: 'Jacob Hinojos', title: 'Sales Rep', phone: '(703) 239-3545', email: 'jacob.hinojos@theroofdocs.com', start_year: 2024 },
  { name: 'Jalen Simms', title: 'Sales Rep', phone: '(703) 239-3106', email: 'jalen.s@theroofdocs.com', start_year: 2024 },
  { name: 'James Armel', title: 'Sales Rep', phone: '(703) 239-3468', email: 'james.armel@theroofdocs.com', start_year: 2024 },
  { name: 'Jason Brown', title: 'Team Lead', phone: '(703) 239-3279', email: 'jason.brown@theroofdocs.com', start_year: 2022 },
  { name: 'Jennifer Lopez', title: 'Sales Rep', phone: '(703) 239-3175', email: 'jennifer.l@theroofdocs.com', start_year: 2024 },
  { name: 'Jimmy Brown', title: 'Sales Rep', phone: '(703) 239-3480', email: 'jimmy.brown@theroofdocs.com', start_year: 2024 },
  { name: 'Tim Danelle', title: 'HR Director', phone: '(703) 239-3097', email: 'jobs@theroofdocs.com', start_year: 2022 },
  { name: 'John Floyd', title: 'Sales Rep', phone: '(703) 239-3179', email: 'john.floyd@theroofdocs.com', start_year: 2024 },
  { name: 'Jonathan Alquijay', title: 'Sales Rep', phone: '(703) 239-3071', email: 'jonathan.alquijay@theroofdocs.com', start_year: 2022 },
  { name: 'Jose Rodriguez', title: 'Project Manager', phone: '(703) 249-9824', email: 'jose@theroofdocs.com', start_year: 2022 },
  { name: 'Joseph Ammendola', title: 'Sales Rep', phone: '(484) 206-5019', email: 'joseph.ammendola@theroofdocs.com', start_year: 2024 },
  { name: 'Joseph Boyd', title: 'Sales Rep', phone: '(804) 223-2167', email: 'joseph.boyd@theroofdocs.com', start_year: 2024 },
  { name: 'Joseph Marcella', title: 'Sales Rep', phone: '(484) 020-6502', email: 'joseph.marcella@theroofdocs.com', start_year: 2024 },
  { name: 'Justin Newman', title: 'Sales Rep', phone: '(804) 223-0238', email: 'justin.n@theroofdocs.com', start_year: 2024 },
  { name: 'Keith Ziemba', title: 'Ops Manager', phone: '(703) 239-3809', email: 'keith.ziemba@theroofdocs.com', start_year: 2022 },
  { name: 'Kyler Wiest', title: 'Sales Rep', phone: '(703) 239-3286', email: 'kyler.wiest@theroofdocs.com', start_year: 2024 },
  { name: 'Kyree Kenney', title: 'Sales Rep', phone: '(703) 239-3129', email: 'kyree.kenney@theroofdocs.com', start_year: 2024 },
  { name: 'Larry Hale', title: 'Sales Rep', phone: '(703) 239-4762', email: 'larry.hale@theroofdocs.com', start_year: 2024 },
  { name: 'Liam Cunningham', title: 'Sales Rep', phone: '(267) 217-3139', email: 'liam.c@theroofdocs.com', start_year: 2022 },
  { name: 'Luis Esteves', title: 'Team Lead', phone: '(703) 594-6802', email: 'luis.esteves@theroofdocs.com', start_year: 2022 },
  { name: 'Marcus Vernon', title: 'Sales Rep', phone: '(804) 223-2673', email: 'marcus.vernon@theroofdocs.com', start_year: 2024 },
  { name: 'Matthew Bothner', title: 'Project Coordinator', phone: '(703) 261-4195', email: 'matt.bothner@theroofdocs.com', start_year: 2022 },
  { name: 'Matt Fletcher', title: 'Project Manager', phone: '(703) 249-9652', email: 'matt.fletcher@theroofdocs.com', start_year: 2022 },
  { name: 'Matt Lamoreaux', title: 'Sales Rep', phone: '(703) 239-3738', email: 'matt.lamoreaux@theroofdocs.com', start_year: 2024 },
  { name: 'Matt Ray', title: 'Project Coordinator', phone: '(703) 239-4589', email: 'matt.ray@theroofdocs.com', start_year: 2022 },
  { name: 'Mattias Kasparian', title: 'Sales Rep', phone: '(703) 239-3615', email: 'mattias.kasparian@theroofdocs.com', start_year: 2022 },
  { name: 'Micah Sanzo', title: 'Sales Rep', phone: '(703) 239-3035', email: 'micah.sanzo@theroofdocs.com', start_year: 2022 },
  { name: 'Michael Murtha', title: 'Field Tech', phone: '(610) 479-2464', email: 'michael.murtha@theroofdocs.com', start_year: 2022 },
  { name: 'Michael Ricardo', title: 'Sales Rep', phone: '(703) 239-3738', email: 'michael.ricardo@theroofdocs.com', start_year: 2024 },
  { name: 'Michael Swearingen', title: 'Team Lead', phone: '(703) 239-3019', email: 'michael.swearingen@theroofdocs.com', start_year: 2022 },
  { name: 'Miguel Ocampo', title: 'Sales Rep', phone: '(571) 210-1424', email: 'miguel.ocampo@theroofdocs.com', start_year: 2024 },
  { name: 'Mike Rafter', title: 'Admin', phone: '(703) 239-3769', email: 'mike.rafter@theroofdocs.com', start_year: 2022 },
  { name: 'Mike Smith', title: 'Sales Rep', phone: '(484) 206-5187', email: 'mike.smith@theroofdocs.com', start_year: 2022 },
  { name: 'Mitchell St. Louis', title: 'Project Coordinator', phone: '(267) 217-3432', email: 'mitchell@theroofdocs.com', start_year: 2022 },
  { name: 'Mohamad Fouladi', title: 'Sales Rep', phone: '(703) 239-3616', email: 'mohamad.fouladi@theroofdocs.com', start_year: 2024 },
  { name: 'Muhammad Shahid', title: 'Sales Rep', phone: '(703) 239-3570', email: 'muhammad.shahid@theroofdocs.com', start_year: 2024 },
  { name: 'Navid Javid', title: 'Team Lead', phone: '(703) 239-3197', email: 'navid.javid@theroofdocs.com', start_year: 2022 },
  { name: 'Nick Bourdin', title: 'Team Lead', phone: '(703) 239-3132', email: 'nick.bourdin@theroofdocs.com', start_year: 2022 },
  { name: 'Oliver Brown', title: 'Admin', phone: '(703) 375-9618', email: 'oliver.brown@theroofdocs.com', start_year: 2022 },
  { name: 'Rajiv Bandodkar', title: 'Sales Rep', phone: '(484) 206-5172', email: 'rajiv.bandodkar@theroofdocs.com', start_year: 2024 },
  { name: 'Ramon Mastrogiuseppe', title: 'Project Coordinator', phone: '(703) 239-4496', email: 'ramon@theroofdocs.com', start_year: 2022 },
  { name: 'Ray Ren', title: 'Sales Rep', phone: '(703) 239-3231', email: 'Ray.ren@theroofdocs.com', start_year: 2024 },
  { name: 'Reese Samala', title: 'Admin', phone: '(703) 239-3085', email: 'reese.samala@theroofdocs.com', start_year: 2022 },
  { name: 'Richie Riley', title: 'Team Lead', phone: '(703) 239-3094', email: 'richie.riley@theroofdocs.com', start_year: 2022 },
  { name: 'Robert Sims', title: 'Sales Rep', phone: '(703) 239-3738', email: 'robert.sims@theroofdocs.com', start_year: 2024 },
  { name: 'Rodrigo Lopez', title: 'Sales Rep', phone: '(703) 239-3239', email: 'rodrigo.lopez@theroofdocs.com', start_year: 2024 },
  { name: 'Ross Renzi', title: 'Sales Rep', phone: '(703) 239-3111', email: 'ross.renzi@theroofdocs.com', start_year: 2024 },
  { name: 'Ryan Kiely', title: 'Sales Rep', phone: '(267) 217-3063', email: 'Ryan.Kiely@theroofdocs.com', start_year: 2022 },
  { name: 'Ryan Parker', title: 'Sales Rep', phone: '(484) 222-3059', email: 'ryan.parker@theroofdocs.com', start_year: 2022 },
  { name: 'Evan Ruszala', title: 'Production Manager', phone: '(703) 239-4479', email: 'service@theroofdocs.com', start_year: 2022 },
  { name: 'Shane Conton', title: 'Sales Rep', phone: '(703) 239-3079', email: 'shane.conton@theroofdocs.com', start_year: 2022 },
  { name: 'Shane Santangelo', title: 'Team Lead', phone: '(703) 239-4703', email: 'shane.santangelo@theroofdocs.com', start_year: 2022 },
  { name: 'Shilongo Shilongo', title: 'Sales Rep', phone: '(703) 239-3477', email: 'Shilongo@theroofdocs.com', start_year: 2022 },
  { name: 'Shoaib Gujer', title: 'Sales Rep', phone: '(703) 239-3238', email: 'shoaib.g@theroofdocs.com', start_year: 2024 },
  { name: 'Steve McKim', title: 'Sales Rep', phone: '(703) 239-3412', email: 'steve.mckim@theroofdocs.com', start_year: 2024 },
  { name: 'Jermaine Perkins', title: 'Ops Assistant', phone: '(703) 239-3590', email: 'support@theroofdocs.com', start_year: 2022 },
  { name: 'Trevon Neely', title: 'Sales Rep', phone: '(703) 239-3108', email: 'trevon.n@theroofdocs.com', start_year: 2024 },
  { name: 'Varun Solan', title: 'Ops Assistant', phone: '(617) 417-1809', email: 'varun@theroofdocs.com', start_year: 2022 },
  { name: 'Walter Cabatbat', title: 'Sales Rep', phone: '(703) 239-3350', email: 'walter.cabatbat@theroofdocs.com', start_year: 2022 },
  { name: 'William Hawkins', title: 'Sales Rep', phone: '(703) 239-3006', email: 'william.hawkins@theroofdocs.com', start_year: 2022 },
  { name: 'William Whitlock', title: 'Sales Rep', phone: '(703) 239-3013', email: 'william.whitlock@theroofdocs.com', start_year: 2024 },
  { name: 'Zebadiah Dyer', title: 'Sales Rep', phone: '(703) 239-3144', email: 'zebadiah.dyer@theroofdocs.com', start_year: 2022 }
];

function parseEmployeeName(fullName) {
  const parts = fullName.trim().split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

function mapTitleToRole(title) {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('admin') || titleLower.includes('hr director')) {
    return 'ADMIN';
  }
  if (titleLower.includes('manager') || titleLower.includes('lead')) {
    return 'MANAGER';
  }
  return 'EMPLOYEE';
}

function mapTitleToDepartment(title) {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('sales')) return 'Sales';
  if (titleLower.includes('admin')) return 'Administration';
  if (titleLower.includes('ops') || titleLower.includes('operations')) return 'Operations';
  if (titleLower.includes('project') || titleLower.includes('production')) return 'Project Management';
  if (titleLower.includes('field') || titleLower.includes('tech')) return 'Field Operations';
  if (titleLower.includes('estimator')) return 'Estimating';
  if (titleLower.includes('hr')) return 'Human Resources';
  return 'General';
}

async function updateEmployeeRoster() {
  try {
    console.log('Starting employee roster update...');
    
    // Clear existing users except admin accounts
    await db.delete(users).where(eq(users.role, 'EMPLOYEE'));
    console.log('Cleared existing employee data');
    
    let createdCount = 0;
    let errorCount = 0;
    
    for (const employee of newEmployeeData) {
      try {
        const { firstName, lastName } = parseEmployeeName(employee.name);
        const role = mapTitleToRole(employee.title);
        const department = mapTitleToDepartment(employee.title);
        
        // Generate a simple password (employee can change later)
        const passwordHash = await bcrypt.hash('welcome123', 10);
        
        const userData = {
          id: uuidv4(),
          email: employee.email,
          firstName,
          lastName,
          role,
          employmentType: 'W2',
          department,
          position: employee.title,
          hireDate: `${employee.start_year}-01-01`,
          phone: employee.phone,
          address: '',
          emergencyContact: '',
          emergencyPhone: '',
          passwordHash,
          isActive: true,
        };
        
        await db.insert(users).values(userData);
        createdCount++;
        
        if (createdCount % 10 === 0) {
          console.log(`Created ${createdCount} employees...`);
        }
        
      } catch (error) {
        console.error(`Failed to create employee ${employee.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\nEmployee roster update completed:`);
    console.log(`✓ Created: ${createdCount} employees`);
    console.log(`✗ Errors: ${errorCount} employees`);
    console.log(`📊 Total processed: ${newEmployeeData.length} employees`);
    
  } catch (error) {
    console.error('Failed to update employee roster:', error);
    process.exit(1);
  }
}

// Run the update
updateEmployeeRoster().then(() => {
  console.log('Employee roster update script completed');
  process.exit(0);
}).catch(console.error);