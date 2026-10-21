import crypto from 'node:crypto';
import pg from 'pg';
import { expect, it } from 'vitest';
const base=process.env.TEST_BASE_URL!;
const headers={Authorization:`Bearer ${process.env.TEST_ADMIN_TOKEN}`};
it('lists existing pilot uploads by category with their saved region and assignment controls contract',async()=>{
  const db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
  const id=crypto.randomUUID(),region=crypto.randomUUID();
  try {
    await db.query('INSERT INTO territories (id,name,region,is_active) VALUES ($1,$2,$3,true)',[region,'Resume Pilot Region','Test']);
    await db.query(`INSERT INTO candidates (id,first_name,last_name,email,phone,position,resume_url,status,stage,applied_date,notes,territory_id) VALUES ($1,'Resume','Pilot','resume@example.test','555-0100','Field Tech','/synthetic.pdf','APPLIED','Application Review',NOW(),$2,$3)`,[id,'Auto-created from resume upload (Indeed-abc123--Resume_Pilot.pdf). Skills:',region]);
    const res=await fetch(`${base}/api/resumes/recent?category=field-tech`,{headers});expect(res.status).toBe(200);
    const row=(await res.json()).candidates.find((c:any)=>c.id===id);
    expect(row.source).toBe('Resume Upload');expect(row.territoryId).toBe(region);expect(row.assignedTo).toBeNull();
    const options=await fetch(`${base}/api/resumes/transfer-options`,{headers});expect(options.status).toBe(200);
    const body=await options.json();expect(body.transferVersion).toBe(2);expect(body.territories.some((t:any)=>t.id===region)).toBe(true);
    const office=await fetch(`${base}/api/resumes/recent?category=office`,{headers});expect((await office.json()).candidates.some((c:any)=>c.id===id)).toBe(false);
  } finally {await db.end();}
});
it('keeps resume options and uploaded candidate details restricted to manager access',async()=>{
  for(const path of ['/api/resumes/transfer-options','/api/resumes/recent?category=field-tech']){
    const anonymous=await fetch(`${base}${path}`);expect(anonymous.status).toBe(401);
    const employee=await fetch(`${base}${path}`,{headers:{Authorization:`Bearer ${process.env.TEST_EMPLOYEE_TOKEN}`}});expect(employee.status).toBe(403);
  }
});

it('lets the existing lead sourcer upload and choose a region without manager promotion',async()=>{
  const db=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await db.connect();
  const id=crypto.randomUUID(),token=crypto.randomUUID();
  try {
    await db.query(`INSERT INTO users (id,email,first_name,last_name,role,employment_type,department,position,hire_date,is_active,password_hash) VALUES ($1,'careers@theroofdocs.com','Lead','Fixture','SOURCER','W2','Recruiting','Lead Sourcer','2026-01-01',true,'test-not-a-login')`,[id]);
    await db.query("INSERT INTO sessions (id,user_id,token,expires_at) VALUES ($1,$2,$3,NOW()+INTERVAL '1 day')",[crypto.randomUUID(),id,token]);
    const leadHeaders={Authorization:`Bearer ${token}`};
    for(const path of ['/api/resumes/transfer-options','/api/resumes/recent?category=field-tech'])expect((await fetch(`${base}${path}`,{headers:leadHeaders})).status).toBe(200);
    const data=new FormData();data.append('category','field-tech');data.append('territoryId','invalid-fixture-region');data.append('resume',new Blob(['%PDF- synthetic'],{type:'application/pdf'}),'fixture.pdf');
    expect((await fetch(`${base}/api/resumes/upload`,{method:'POST',headers:leadHeaders,body:data})).status).toBe(400);
    // A different SOURCER does not gain this access.
    await db.query("UPDATE users SET email='ordinary-sourcer@example.test' WHERE id=$1",[id]);
    expect((await fetch(`${base}/api/resumes/transfer-options`,{headers:leadHeaders})).status).toBe(403);
  } finally {await db.end();}
});
