import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { departmentPtoSettings } from '../../shared/schema.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function checkDepartments() {
  const depts = await db.select().from(departmentPtoSettings);
  console.log('DEPARTMENT PTO SETTINGS:');
  console.log('========================');

  if (depts.length === 0) {
    console.log('No department settings found!');
  } else {
    depts.forEach(d => {
      console.log(`${d.department}: ${d.vacationDays}/${d.sickDays}/${d.personalDays} = ${d.totalDays}`);
      console.log(`  Inherit from company: ${d.inheritFromCompany}`);
    });
  }

  await pool.end();
}

checkDepartments();
