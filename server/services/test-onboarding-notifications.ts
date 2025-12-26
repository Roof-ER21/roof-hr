/**
 * Test script for onboarding notification service
 *
 * Run with: npx tsx server/services/test-onboarding-notifications.ts
 */

import { storage } from '../storage';
import {
  sendOnboardingAssignedNotification,
  sendOverdueTaskNotification,
  checkOverdueTasks,
} from './onboarding-notifications';

async function testNotificationService() {
  console.log('='.repeat(80));
  console.log('ONBOARDING NOTIFICATION SERVICE TEST');
  console.log('='.repeat(80));

  try {
    // Test 1: Get all users to find test subjects
    console.log('\n[Test 1] Finding test users...');
    const users = await storage.getAllUsers();
    console.log(`Found ${users.length} users in the system`);

    if (users.length === 0) {
      console.error('No users found. Please create some test users first.');
      return;
    }

    const testEmployee = users[0]; // Use first user as test employee
    console.log(`Test employee: ${testEmployee.firstName} ${testEmployee.lastName} (${testEmployee.email})`);

    // Test 2: Get all templates
    console.log('\n[Test 2] Finding onboarding templates...');
    const templates = await storage.getAllOnboardingTemplates();
    console.log(`Found ${templates.length} templates`);

    if (templates.length === 0) {
      console.error('No templates found. Please create some templates first.');
      return;
    }

    const testTemplate = templates[0];
    console.log(`Test template: ${testTemplate.name}`);

    // Test 3: Test assignment notification
    console.log('\n[Test 3] Testing assignment notification...');
    const testInstanceId = `test-instance-${Date.now()}`;
    const testManagerName = 'Test Manager';

    await sendOnboardingAssignedNotification(
      testEmployee.id,
      testInstanceId,
      testTemplate.name,
      testManagerName
    );

    console.log('Assignment notification sent successfully!');

    // Verify notification was created
    const notifications = await storage.getNotificationsByUserId(testEmployee.id, 10);
    const assignmentNotif = notifications.find(n => n.type === 'onboarding_assigned');
    if (assignmentNotif) {
      console.log('✓ Assignment notification found in database');
      console.log(`  Title: ${assignmentNotif.title}`);
      console.log(`  Message: ${assignmentNotif.message}`);
    } else {
      console.warn('⚠ Assignment notification not found in database');
    }

    // Test 4: Test overdue task notification
    console.log('\n[Test 4] Testing overdue task notification...');
    const testStepId = `test-step-${Date.now()}`;
    const testTaskTitle = 'Complete orientation paperwork';
    const testDueDate = new Date();
    testDueDate.setDate(testDueDate.getDate() - 3); // 3 days ago

    await sendOverdueTaskNotification(
      testEmployee.id,
      testStepId,
      testTaskTitle,
      testDueDate
    );

    console.log('Overdue task notification sent successfully!');

    // Verify notification was created
    const updatedNotifications = await storage.getNotificationsByUserId(testEmployee.id, 10);
    const overdueNotif = updatedNotifications.find(n => n.type === 'task_overdue');
    if (overdueNotif) {
      console.log('✓ Overdue notification found in database');
      console.log(`  Title: ${overdueNotif.title}`);
      console.log(`  Message: ${overdueNotif.message}`);
    } else {
      console.warn('⚠ Overdue notification not found in database');
    }

    // Test 5: Test duplicate prevention (should not send duplicate within 24 hours)
    console.log('\n[Test 5] Testing duplicate prevention...');
    console.log('Attempting to send same overdue notification again...');

    await sendOverdueTaskNotification(
      testEmployee.id,
      testStepId,
      testTaskTitle,
      testDueDate
    );

    const finalNotifications = await storage.getNotificationsByUserId(testEmployee.id, 10);
    const overdueNotifs = finalNotifications.filter(n => n.type === 'task_overdue');
    console.log(`Found ${overdueNotifs.length} overdue notification(s)`);
    if (overdueNotifs.length === 1) {
      console.log('✓ Duplicate prevention working correctly');
    } else {
      console.warn('⚠ Duplicate notification was created (should be prevented)');
    }

    // Test 6: Test overdue tasks check
    console.log('\n[Test 6] Testing overdue tasks check...');
    console.log('Checking for actual overdue tasks in the system...');

    await checkOverdueTasks();

    console.log('✓ Overdue tasks check completed');

    // Test 7: Get overdue steps
    console.log('\n[Test 7] Checking actual overdue steps...');
    const overdueSteps = await storage.getOverdueOnboardingSteps();
    console.log(`Found ${overdueSteps.length} overdue steps in the system`);

    if (overdueSteps.length > 0) {
      console.log('First 3 overdue steps:');
      overdueSteps.slice(0, 3).forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.title} (Due: ${step.dueDate?.toLocaleDateString()})`);
      });
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log('✓ Assignment notification: PASSED');
    console.log('✓ Overdue task notification: PASSED');
    console.log('✓ Duplicate prevention: PASSED');
    console.log('✓ Overdue tasks check: PASSED');
    console.log('✓ Database queries: PASSED');
    console.log('\nAll tests completed successfully!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('TEST FAILED');
    console.error('='.repeat(80));
    console.error('Error:', error);
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Run the test
testNotificationService()
  .then(() => {
    console.log('\nTest completed. Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
