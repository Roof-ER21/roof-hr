
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@roof-er.com' },
    update: {},
    create: {
      email: 'admin@roof-er.com',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      name: 'System Administrator',
      employeeId: 'RE0001',
      role: 'ADMIN',
      employmentType: 'W2',
      phone: '(555) 123-4567',
      hireDate: new Date(),
      onboardingStatus: 'COMPLETED',
      onboardingCompletedAt: new Date(),
      isActive: true
    }
  });

  // Create sample manager
  const managerPassword = await bcrypt.hash('manager123', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@roof-er.com' },
    update: {},
    create: {
      email: 'manager@roof-er.com',
      password: managerPassword,
      firstName: 'John',
      lastName: 'Manager',
      name: 'John Manager',
      employeeId: 'RE0002',
      role: 'GENERAL_MANAGER',
      employmentType: 'W2',
      phone: '(555) 234-5678',
      hireDate: new Date(),
      onboardingStatus: 'COMPLETED',
      onboardingCompletedAt: new Date(),
      isActive: true
    }
  });

  // Create sample field worker (incomplete onboarding)
  const workerPassword = await bcrypt.hash('worker123', 12);
  const worker = await prisma.user.upsert({
    where: { email: 'worker@roof-er.com' },
    update: {},
    create: {
      email: 'worker@roof-er.com',
      password: workerPassword,
      firstName: 'Mike',
      lastName: 'Worker',
      name: 'Mike Worker',
      employeeId: 'RE0003',
      role: 'FIELD_WORKER',
      employmentType: 'W2',
      hireDate: new Date(),
      onboardingStatus: 'PENDING',
      isActive: true
    }
  });

  // Create sample contractor
  const contractorPassword = await bcrypt.hash('contractor123', 12);
  const contractor = await prisma.user.upsert({
    where: { email: 'contractor@roof-er.com' },
    update: {},
    create: {
      email: 'contractor@roof-er.com',
      password: contractorPassword,
      firstName: 'Sarah',
      lastName: 'Contractor',
      name: 'Sarah Contractor',
      employeeId: 'RE0004',
      role: 'FIELD_WORKER',
      employmentType: 'CONTRACTOR_1099',
      phone: '(555) 345-6789',
      hireDate: new Date(),
      onboardingStatus: 'COMPLETED',
      onboardingCompletedAt: new Date(),
      isActive: true
    }
  });

  // Create document requirements
  await prisma.documentRequirement.createMany({
    data: [
      {
        type: 'DRIVERS_LICENSE',
        isRequired: true,
        description: 'Valid driver\'s license required for all field workers'
      },
      {
        type: 'W4_FORM',
        isRequired: true,
        forEmploymentType: 'W2',
        description: 'W-4 tax form for W-2 employees'
      },
      {
        type: 'W9_FORM',
        isRequired: true,
        forEmploymentType: 'CONTRACTOR_1099',
        description: 'W-9 form for 1099 contractors'
      },
      {
        type: 'I9_FORM',
        isRequired: true,
        forEmploymentType: 'W2',
        description: 'I-9 employment eligibility verification'
      },
      {
        type: 'SAFETY_CERTIFICATION',
        isRequired: true,
        forRole: 'FIELD_WORKER',
        description: 'OSHA safety certification for field workers'
      }
    ],
    skipDuplicates: true
  });

  // Create blackout dates (busy season)
  const currentYear = new Date().getFullYear();
  await prisma.blackoutDate.createMany({
    data: [
      {
        date: new Date(currentYear, 6, 4), // July 4th
        reason: 'Independence Day',
        description: 'Federal holiday - no work scheduled'
      },
      {
        date: new Date(currentYear, 11, 25), // Christmas
        reason: 'Christmas Day',
        description: 'Federal holiday - no work scheduled'
      }
    ],
    skipDuplicates: true
  });

  // Create sample company settings
  await prisma.companySettings.createMany({
    data: [
      {
        settingKey: 'PTO_ANNUAL_ALLOWANCE',
        settingValue: '13',
        description: 'Annual PTO days allowed per employee'
      },
      {
        settingKey: 'PTO_MAX_CONSECUTIVE_BUSY_SEASON',
        settingValue: '7',
        description: 'Maximum consecutive PTO days during busy season (March-October)'
      },
      {
        settingKey: 'PTO_MAX_CARRYOVER',
        settingValue: '5',
        description: 'Maximum PTO days that can be carried over to next year'
      },
      {
        settingKey: 'BUSY_SEASON_START',
        settingValue: '03-01',
        description: 'Start of busy season (MM-DD)'
      },
      {
        settingKey: 'BUSY_SEASON_END',
        settingValue: '10-31',
        description: 'End of busy season (MM-DD)'
      }
    ],
    skipDuplicates: true
  });

  // Create sample recognitions
  await prisma.recognition.createMany({
    data: [
      {
        userId: manager.id,
        recognizedBy: admin.id,
        type: 'quality',
        title: 'Exceptional Project Management',
        description: 'Delivered the Thompson roofing project ahead of schedule with zero safety incidents',
        isPublic: true
      },
      {
        userId: contractor.id,
        recognizedBy: manager.id,
        type: 'integrity',
        title: 'Honest Customer Communication',
        description: 'Proactively communicated material delays and provided alternative solutions to the client',
        isPublic: true
      }
    ],
    skipDuplicates: true
  });

  // Create HR Director
  const hrDirectorPassword = await bcrypt.hash('hr123', 12);
  const hrDirector = await prisma.user.upsert({
    where: { email: 'hr@roof-er.com' },
    update: {},
    create: {
      email: 'hr@roof-er.com',
      password: hrDirectorPassword,
      firstName: 'Lisa',
      lastName: 'Director',
      name: 'Lisa Director',
      employeeId: 'RE0005',
      role: 'HR_DIRECTOR',
      employmentType: 'W2',
      phone: '(555) 456-7890',
      hireDate: new Date(),
      onboardingStatus: 'COMPLETED',
      onboardingCompletedAt: new Date(),
      isActive: true
    }
  });

  // Create HR Recruiter
  const recruiterPassword = await bcrypt.hash('recruiter123', 12);
  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@roof-er.com' },
    update: {},
    create: {
      email: 'recruiter@roof-er.com',
      password: recruiterPassword,
      firstName: 'Tom',
      lastName: 'Recruiter',
      name: 'Tom Recruiter',
      employeeId: 'RE0006',
      role: 'HR_RECRUITER',
      employmentType: 'W2',
      phone: '(555) 567-8901',
      hireDate: new Date(),
      onboardingStatus: 'COMPLETED',
      onboardingCompletedAt: new Date(),
      isActive: true
    }
  });

  // Create job positions
  const roofingForeman = await prisma.jobPosition.create({
    data: {
      title: 'Roofing Foreman',
      department: 'Field Operations',
      description: 'Lead roofing crews and oversee project completion. Minimum 5 years roofing experience required.',
      requirements: '5+ years roofing experience, leadership skills, OSHA 30 certification preferred',
      salaryMin: 55000,
      salaryMax: 75000,
      employmentType: 'W2',
      location: 'Various job sites',
      hiringManagerId: manager.id,
      isActive: true
    }
  });

  const roofingTechnician = await prisma.jobPosition.create({
    data: {
      title: 'Roofing Technician',
      department: 'Field Operations',
      description: 'Install, repair, and maintain roofing systems. Entry-level position with training provided.',
      requirements: 'Physical fitness, willingness to learn, reliable transportation',
      salaryMin: 35000,
      salaryMax: 50000,
      employmentType: 'W2',
      location: 'Various job sites',
      hiringManagerId: manager.id,
      isActive: true
    }
  });

  const salesRepresentative = await prisma.jobPosition.create({
    data: {
      title: 'Sales Representative',
      department: 'Sales',
      description: 'Generate leads and close residential roofing sales. Commission-based compensation.',
      requirements: 'Sales experience preferred, excellent communication skills, valid driver\'s license',
      salaryMin: 40000,
      salaryMax: 80000,
      employmentType: 'W2',
      location: 'Field-based',
      hiringManagerId: admin.id,
      isActive: true
    }
  });

  const projectManager = await prisma.jobPosition.create({
    data: {
      title: 'Project Manager',
      department: 'Operations',
      description: 'Manage roofing projects from start to finish, coordinate with customers and crews.',
      requirements: 'Project management experience, construction background preferred, strong organizational skills',
      salaryMin: 50000,
      salaryMax: 70000,
      employmentType: 'W2',
      location: 'Office/Field',
      hiringManagerId: admin.id,
      isActive: true
    }
  });

  // Create candidates in different stages
  const candidate1 = await prisma.candidate.create({
    data: {
      firstName: 'James',
      lastName: 'Rodriguez',
      email: 'james.rodriguez@email.com',
      phone: '(555) 111-2222',
      positionId: roofingForeman.id,
      stage: 'APPLIED',
      source: 'Website',
      assignedRecruiterId: recruiter.id,
      appliedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      desiredSalary: 65000,
      city: 'Austin',
      state: 'TX'
    }
  });

  const candidate2 = await prisma.candidate.create({
    data: {
      firstName: 'Maria',
      lastName: 'Garcia',
      email: 'maria.garcia@email.com',
      phone: '(555) 222-3333',
      positionId: salesRepresentative.id,
      stage: 'INTERVIEW_SCHEDULED',
      source: 'LinkedIn',
      assignedRecruiterId: recruiter.id,
      appliedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      desiredSalary: 60000,
      city: 'Houston',
      state: 'TX'
    }
  });

  const candidate3 = await prisma.candidate.create({
    data: {
      firstName: 'David',
      lastName: 'Johnson',
      email: 'david.johnson@email.com',
      phone: '(555) 333-4444',
      positionId: roofingTechnician.id,
      stage: 'INTERVIEWED',
      source: 'Referral',
      assignedRecruiterId: recruiter.id,
      appliedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      desiredSalary: 42000,
      city: 'Dallas',
      state: 'TX'
    }
  });

  const candidate4 = await prisma.candidate.create({
    data: {
      firstName: 'Jennifer',
      lastName: 'Smith',
      email: 'jennifer.smith@email.com',
      phone: '(555) 444-5555',
      positionId: projectManager.id,
      stage: 'ACCEPTED',
      source: 'Indeed',
      assignedRecruiterId: hrDirector.id,
      appliedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
      desiredSalary: 65000,
      city: 'San Antonio',
      state: 'TX'
    }
  });

  const candidate5 = await prisma.candidate.create({
    data: {
      firstName: 'Robert',
      lastName: 'Brown',
      email: 'robert.brown@email.com',
      phone: '(555) 555-6666',
      positionId: roofingTechnician.id,
      stage: 'REJECTED',
      source: 'Walk-in',
      assignedRecruiterId: recruiter.id,
      appliedDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 3 weeks ago
      rejectionReason: 'Insufficient experience for role requirements',
      city: 'Austin',
      state: 'TX'
    }
  });

  // Create interviews
  await prisma.candidateInterview.create({
    data: {
      candidateId: candidate2.id,
      scheduledBy: recruiter.id,
      type: 'VIDEO',
      status: 'SCHEDULED',
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      duration: 45,
      meetingLink: 'https://zoom.us/j/1234567890',
      interviewerIds: [manager.id, hrDirector.id]
    }
  });

  await prisma.candidateInterview.create({
    data: {
      candidateId: candidate3.id,
      scheduledBy: recruiter.id,
      type: 'IN_PERSON',
      status: 'COMPLETED',
      scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      duration: 60,
      location: 'Roof-ER Office, Conference Room A',
      interviewerIds: [manager.id],
      notes: 'Candidate showed strong technical knowledge and good communication skills. Recommended for hire.',
      score: 8,
      recommendation: 'hire'
    }
  });

  await prisma.candidateInterview.create({
    data: {
      candidateId: candidate4.id,
      scheduledBy: hrDirector.id,
      type: 'PANEL',
      status: 'COMPLETED',
      scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      duration: 90,
      location: 'Roof-ER Office, Conference Room B',
      interviewerIds: [admin.id, manager.id, hrDirector.id],
      notes: 'Excellent project management experience and cultural fit. Strong candidate for the role.',
      score: 9,
      recommendation: 'hire'
    }
  });

  // Create candidate notes
  await prisma.candidateNote.createMany({
    data: [
      {
        candidateId: candidate1.id,
        authorId: recruiter.id,
        subject: 'Initial Phone Screen',
        content: 'Completed initial phone screening. Candidate has 6 years of roofing experience and is interested in leadership role. Good communication skills.',
        category: 'phone_call'
      },
      {
        candidateId: candidate2.id,
        authorId: recruiter.id,
        subject: 'Reference Check',
        content: 'Spoke with previous sales manager. Confirmed candidate exceeded targets for 3 consecutive years. Highly recommended.',
        category: 'reference_check'
      },
      {
        candidateId: candidate3.id,
        authorId: manager.id,
        subject: 'Interview Follow-up',
        content: 'Interview went well. Candidate demonstrated good safety awareness and technical knowledge. Will move forward with offer.',
        category: 'interview'
      },
      {
        candidateId: candidate4.id,
        authorId: hrDirector.id,
        subject: 'Background Check Complete',
        content: 'Background check completed successfully. All references positive. Candidate accepted offer and will start next Monday.',
        category: 'general'
      },
      {
        candidateId: candidate5.id,
        authorId: recruiter.id,
        subject: 'Rejection Notice Sent',
        content: 'Sent rejection email to candidate. Recommended applying for entry-level technician role after gaining more experience.',
        category: 'email'
      }
    ],
    skipDuplicates: true
  });

  console.log('Database seeded successfully');
  console.log('Sample accounts created:');
  console.log('Admin: admin@roof-er.com / admin123');
  console.log('Manager: manager@roof-er.com / manager123');
  console.log('Worker (needs onboarding): worker@roof-er.com / worker123');
  console.log('Contractor: contractor@roof-er.com / contractor123');
  console.log('HR Director: hr@roof-er.com / hr123');
  console.log('HR Recruiter: recruiter@roof-er.com / recruiter123');
  console.log('');
  console.log('Recruiting data created:');
  console.log('- 4 Job positions');
  console.log('- 5 Candidates in different stages');
  console.log('- 3 Interviews (1 scheduled, 2 completed)');
  console.log('- 5 Candidate notes');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
