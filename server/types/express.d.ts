// Extend Express Request to include our User type
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: 'TRUE_ADMIN' | 'ADMIN' | 'GENERAL_MANAGER' | 'TERRITORY_SALES_MANAGER' | 'MANAGER' | 'EMPLOYEE' | 'CONTRACTOR' | 'SALES_REP' | 'FIELD_TECH';
      employmentType: 'W2' | '1099' | 'CONTRACTOR' | 'SUB_CONTRACTOR';
      department: string;
      position: string;
      hireDate: string;
      terminationDate?: string | null;
      territoryId?: string | null;
      primaryManagerId?: string | null;
      isActive: boolean;
      phone?: string | null;
      address?: string | null;
      emergencyContact?: string | null;
      emergencyPhone?: string | null;
      shirtSize?: 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3X' | null;
      passwordHash: string;
      mustChangePassword: boolean;
      lastPasswordChange?: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

export {};
