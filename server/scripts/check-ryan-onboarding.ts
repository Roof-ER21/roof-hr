import { storage } from '../storage';

async function checkRyanOnboarding() {
  try {
    console.log('Checking Ryan Ferguson onboarding data...\n');

    // Find Ryan Ferguson by email
    const allUsers = await storage.getAllUsers();
    const ryan = allUsers.find(u => u.email === 'careers@theroofdocs.com');

    if (!ryan) {
      console.log('❌ Ryan Ferguson (careers@theroofdocs.com) not found in database');
      return;
    }

    console.log('✅ Found Ryan Ferguson:');
    console.log(`   ID: ${ryan.id}`);
    console.log(`   Name: ${ryan.firstName} ${ryan.lastName}`);
    console.log(`   Email: ${ryan.email}`);
    console.log(`   Role: ${ryan.role}`);
    console.log(`   Department: ${ryan.department || 'N/A'}`);
    console.log('');

    // Check onboarding workflows
    console.log('Checking onboarding workflows...');
    const workflows = await storage.getAllOnboardingWorkflows();
    const ryanWorkflows = workflows.filter((w: any) => w.employeeId === ryan.id);
    console.log(`   Found ${ryanWorkflows.length} workflows for Ryan`);

    if (ryanWorkflows.length > 0) {
      ryanWorkflows.forEach((w: any, idx: number) => {
        console.log(`   Workflow ${idx + 1}:`);
        console.log(`     ID: ${w.id}`);
        console.log(`     Status: ${w.status}`);
        console.log(`     Current Step: ${w.currentStep}`);
        console.log(`     Total Steps: ${w.totalSteps}`);
        console.log(`     Notes: ${w.notes || 'N/A'}`);
      });
    }
    console.log('');

    // Check onboarding instances
    console.log('Checking onboarding instances...');
    const instances = await storage.getOnboardingInstancesByEmployeeId(ryan.id.toString());
    console.log(`   Found ${instances.length} instances for Ryan`);

    if (instances.length > 0) {
      for (const instance of instances) {
        console.log(`   Instance:`);
        console.log(`     ID: ${instance.id}`);
        console.log(`     Template ID: ${instance.templateId}`);
        console.log(`     Status: ${instance.status}`);
        console.log(`     Start Date: ${instance.startDate}`);

        // Get template info
        if (instance.templateId) {
          const template = await storage.getOnboardingTemplateById(instance.templateId);
          if (template) {
            console.log(`     Template Name: ${template.name}`);
          }
        }

        // Get steps for this instance
        const steps = await storage.getOnboardingStepsByWorkflowId(instance.id);
        console.log(`     Steps: ${steps.length} total`);

        if (steps.length > 0) {
          const completed = steps.filter((s: any) => s.status === 'COMPLETED').length;
          console.log(`     Completed: ${completed}/${steps.length}`);

          // Show first 3 steps
          console.log('     First 3 steps:');
          steps.slice(0, 3).forEach((step: any, idx: number) => {
            console.log(`       ${idx + 1}. ${step.title} - ${step.status}`);
          });
        }
      }
    }
    console.log('');

    // Test the actual API endpoint logic
    console.log('Testing API endpoint logic...');
    const employeeWorkflows = workflows.filter((w: any) => w.employeeId === ryan.id.toString());

    console.log(`   Workflows matching Ryan's ID: ${employeeWorkflows.length}`);
    console.log(`   Instances matching Ryan's ID: ${instances.length}`);

    const enrichedData: any[] = [];

    // Process workflows
    for (const workflow of employeeWorkflows) {
      const steps = await storage.getOnboardingStepsByWorkflowId(workflow.id);
      const sortedSteps = steps.sort((a: any, b: any) => a.stepNumber - b.stepNumber);
      const completedCount = sortedSteps.filter((s: any) => s.status === 'COMPLETED').length;

      enrichedData.push({
        id: workflow.id,
        type: 'workflow',
        status: workflow.status,
        stepsCount: sortedSteps.length,
        completedCount,
      });
    }

    // Process instances
    for (const instance of instances) {
      const steps = await storage.getOnboardingStepsByWorkflowId(instance.id);
      const sortedSteps = steps.sort((a: any, b: any) => a.stepNumber - b.stepNumber);
      const completedCount = sortedSteps.filter((s: any) => s.status === 'COMPLETED').length;
      const template = await storage.getOnboardingTemplateById(instance.templateId);

      enrichedData.push({
        id: instance.id,
        type: 'instance',
        status: instance.status,
        templateName: template?.name,
        stepsCount: sortedSteps.length,
        completedCount,
      });
    }

    console.log('   Enriched data:');
    console.log(JSON.stringify(enrichedData, null, 2));

    // Filter out completed
    const active = enrichedData.filter(
      (o) => o.stepsCount > 0 && o.status !== 'COMPLETED' && o.status !== 'completed'
    );

    console.log(`\n   Active onboarding (what API would return): ${active.length} items`);
    if (active.length === 0) {
      console.log('\n⚠️  No active onboarding found!');
      console.log('   This explains why the user sees "failed to load onboarding tasks"');
      console.log('   Possible reasons:');
      console.log('   1. No onboarding template has been assigned to Ryan Ferguson');
      console.log('   2. All onboarding is marked as COMPLETED');
      console.log('   3. Onboarding has no steps');
    } else {
      console.log('   Active items:', JSON.stringify(active, null, 2));
    }

  } catch (error) {
    console.error('Error checking Ryan onboarding:', error);
  }
}

checkRyanOnboarding();
