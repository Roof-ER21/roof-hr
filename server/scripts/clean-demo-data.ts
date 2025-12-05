import { db } from '../db';
import { users, sessions, ptoRequests, candidates, interviews, employeeReviews } from '../../shared/schema';
import { inArray } from 'drizzle-orm';

async function cleanDemoData() {
  console.log('Starting demo data cleanup...');
  
  try {
    // List of demo emails to remove
    const demoEmails = [
      'admin@roof-er.com',
      'manager@roof-er.com',
      'employee@roof-er.com',
      'contractor@roof-er.com',
      'hr1@roof-er.com',
      'hr2@roof-er.com',
      'hr3@roof-er.com'
    ];
    
    // Get demo user IDs
    const demoUsers = await db.select({ id: users.id })
      .from(users)
      .where(inArray(users.email, demoEmails));
    
    const demoUserIds = demoUsers.map(u => u.id);
    
    if (demoUserIds.length > 0) {
      // Delete related data
      console.log(`Deleting data for ${demoUserIds.length} demo users...`);
      
      // Delete sessions
      await db.delete(sessions).where(inArray(sessions.userId, demoUserIds));
      console.log('✓ Deleted demo user sessions');
      
      // Delete PTO requests
      await db.delete(ptoRequests).where(inArray(ptoRequests.employeeId, demoUserIds));
      console.log('✓ Deleted demo PTO requests');
      
      // Delete employee reviews
      await db.delete(employeeReviews).where(inArray(employeeReviews.employeeId, demoUserIds));
      console.log('✓ Deleted demo employee reviews');
      
      // Delete users
      await db.delete(users).where(inArray(users.id, demoUserIds));
      console.log('✓ Deleted demo users');
    }
    
    // Delete demo candidates
    const demoCandidates = [
      'john.smith@email.com',
      'jane.doe@email.com',
      'mike.johnson@email.com',
      'sarah.williams@email.com',
      'robert.brown@email.com',
      'emily.davis@email.com'
    ];
    
    const candidatesToDelete = await db.select({ id: candidates.id })
      .from(candidates)
      .where(inArray(candidates.email, demoCandidates));
    
    const candidateIds = candidatesToDelete.map(c => c.id);
    
    if (candidateIds.length > 0) {
      // Delete interviews for demo candidates
      await db.delete(interviews).where(inArray(interviews.candidateId, candidateIds));
      console.log('✓ Deleted demo interviews');
      
      // Delete candidates
      await db.delete(candidates).where(inArray(candidates.id, candidateIds));
      console.log('✓ Deleted demo candidates');
    }
    
    console.log('\nDemo data cleanup completed successfully!');
    console.log('The database now contains only real employee data.');
    
  } catch (error) {
    console.error('Error cleaning demo data:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the cleanup
cleanDemoData();