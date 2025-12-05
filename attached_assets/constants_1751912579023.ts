
// Roof-ER Brand Colors and Constants
export const BRAND_COLORS = {
  primary: '#B70808',      // Roof-ER Red
  secondary: '#302F2F',    // Dark Grey
  background: '#FFFFFF',   // White
  muted: '#F5F5F5',       // Light Grey for cards
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6'
} as const;

export const ROOF_ER_VALUES = {
  integrity: 'Integrity',
  quality: 'Quality', 
  simplicity: 'Simplicity'
} as const;

export const EMPLOYEE_COMMITMENTS = [
  'I will align with the mission and values of Roof-ER.',
  'I will follow the successful sales process that Roof-ER has developed.',
  'I will maintain absolute integrity in all my interactions.',
  'I will deliver elite quality in every aspect of my work.',
  'I will embrace simplicity to create seamless customer experiences.',
  'I will grow from constructive feedback and implement changes.',
  'I will communicate directly to avoid office drama.',
  'I will maintain discipline and a positive work ethic.',
  'I will take personal responsibility for my actions and results.',
  'I will support my teammates and contribute to our collective success.',
  'I will do what it takes to achieve tremendous levels of success.'
] as const;

export const PTO_RULES = {
  annualAllowance: 13,
  maxConsecutiveDuringBusySeason: 7,
  busySeasonStart: { month: 3, day: 1 }, // March 1
  busySeasonEnd: { month: 10, day: 31 }, // October 31
  maxCarryover: 5
} as const;

export const USER_ROLES = {
  ADMIN: 'Admin',
  OWNER: 'Owner', 
  SALES_DIRECTOR: 'Sales Director',
  GENERAL_MANAGER: 'General Manager',
  SUPERVISOR: 'Supervisor',
  FIELD_WORKER: 'Field Worker',
  OFFICE_STAFF: 'Office Staff',
  HR_DIRECTOR: 'HR Director',
  HR_RECRUITER: 'HR Recruiter',
  CUSTOM: 'Custom Role'
} as const;

export const EMPLOYMENT_TYPES = {
  W2: 'W-2 Employee',
  CONTRACTOR_1099: '1099 Contractor'
} as const;

export const DOCUMENT_TYPES = {
  DRIVERS_LICENSE: "Driver's License",
  WORKERS_COMP: "Workers' Compensation",
  W4_FORM: 'W-4 Form',
  W9_FORM: 'W-9 Form', 
  I9_FORM: 'I-9 Form',
  SAFETY_CERTIFICATION: 'Safety Certification',
  OSHA_TRAINING: 'OSHA Training Certificate',
  CONTRACT: 'Employment Contract',
  CUSTOM: 'Custom Document'
} as const;
