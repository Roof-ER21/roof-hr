import { db } from '../server/db';
import { hrAgentConfigs } from '../shared/schema';
import { v4 as uuidv4 } from 'uuid';

async function initializeHrAgents() {
  try {
    // Define the default HR agents
    const defaultAgents = [
      {
        id: uuidv4(),
        agentName: 'PTO Expiration Reminder',
        isActive: true,
        schedule: '0 9 * * MON',
        description: 'Sends reminders for upcoming PTO expiration dates',
        config: JSON.stringify({
          reminderDays: 30,
          ptoAllowance: 15
        })
      },
      {
        id: uuidv4(),
        agentName: 'Performance Review Automation',
        isActive: true,
        schedule: '0 10 1 */3 *',
        description: 'Automatically creates performance reviews based on schedule',
        config: JSON.stringify({
          reviewTypes: ['QUARTERLY', 'ANNUAL'],
          autoGenerate: true
        })
      },
      {
        id: uuidv4(),
        agentName: 'Document Expiration Monitor',
        isActive: true,
        schedule: '0 8 * * MON,WED,FRI',
        description: 'Monitors and alerts for expiring documents',
        config: JSON.stringify({
          warningDays: 30,
          criticalDays: 7
        })
      },
      {
        id: uuidv4(),
        agentName: 'Onboarding Workflow',
        isActive: false,
        schedule: 'manual',
        description: 'Manages new employee onboarding workflows',
        config: JSON.stringify({
          stepsToCreate: 10,
          autoAssign: true
        })
      }
    ];

    // Insert agents into database
    for (const agent of defaultAgents) {
      await db.insert(hrAgentConfigs)
        .values(agent)
        .onConflictDoNothing();
    }

    console.log('✅ Successfully initialized HR agent configurations');
    console.log(`Created ${defaultAgents.length} HR agents`);
    
  } catch (error) {
    console.error('Error initializing HR agents:', error);
  } finally {
    process.exit(0);
  }
}

initializeHrAgents();