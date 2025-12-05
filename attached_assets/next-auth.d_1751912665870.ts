
import NextAuth from 'next-auth';
import { UserRole, EmploymentType, OnboardingStatus } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      employmentType: EmploymentType;
      onboardingStatus: OnboardingStatus;
      ptoBalance: number;
      ptoUsed: number;
    }
  }

  interface User {
    role: UserRole;
    employmentType: EmploymentType;
    onboardingStatus: OnboardingStatus;
    ptoBalance: number;
    ptoUsed: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole;
    employmentType: EmploymentType;
    onboardingStatus: OnboardingStatus;
    ptoBalance: number;
    ptoUsed: number;
  }
}
