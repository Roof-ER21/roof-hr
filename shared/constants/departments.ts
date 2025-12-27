/**
 * Standard departments for The Roof Docs HR system.
 * This is the single source of truth for all department values.
 * Based on the actual imported employee data from the production system.
 */

export const DEPARTMENTS = [
  'Administration',
  'Estimating',
  'Field Operations',
  'Human Resources',
  'Operations',
  'Production',
  'Project Management',
  'Recruiting',
  'Sales',
] as const;

export type DepartmentType = typeof DEPARTMENTS[number];

/**
 * Check if a string is a valid department
 */
export function isValidDepartment(department: string): department is DepartmentType {
  return DEPARTMENTS.includes(department as DepartmentType);
}

/**
 * Get department display name (currently same as value, but allows for future customization)
 */
export function getDepartmentDisplayName(department: string): string {
  return department;
}

/**
 * Position to Department mapping based on import logic
 */
export const POSITION_TO_DEPARTMENT: Record<string, DepartmentType> = {
  'admin': 'Administration',
  'hr director': 'Human Resources',
  'hr manager': 'Human Resources',
  'ops manager': 'Operations',
  'ops assistant': 'Operations',
  'operations manager': 'Operations',
  'sales manager': 'Sales',
  'sales rep': 'Sales',
  'sales representative': 'Sales',
  'production manager': 'Production',
  'project manager': 'Project Management',
  'project coordinator': 'Project Management',
  'field tech': 'Field Operations',
  'field technician': 'Field Operations',
  'field trainer': 'Field Operations',
  'estimator': 'Estimating',
  'recruiter': 'Recruiting',
};

/**
 * Get suggested department based on position/title
 */
export function getDepartmentForPosition(position: string): DepartmentType {
  const normalizedPosition = position.toLowerCase().trim();
  return POSITION_TO_DEPARTMENT[normalizedPosition] || 'Operations';
}
