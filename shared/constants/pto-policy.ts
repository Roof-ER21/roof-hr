// Centralized PTO Policy Constants
// Use these constants throughout the app for consistent PTO values
// Updated: December 2024

// ============================================================================
// COMPANY PTO POLICY
// ============================================================================
// All employees receive 17 PTO days per year
// Sales Representatives (1099) receive 0 PTO days
// Employees must use at least 5 PTO days in January, February, or December
// ============================================================================

export const PTO_POLICY = {
  // Default allocation for all employees (17 total)
  DEFAULT_VACATION_DAYS: 10,
  DEFAULT_SICK_DAYS: 5,
  DEFAULT_PERSONAL_DAYS: 2,
  DEFAULT_TOTAL_DAYS: 17,

  // Sales Rep / 1099 Contractor allocation (0 total)
  SALES_VACATION_DAYS: 0,
  SALES_SICK_DAYS: 0,
  SALES_PERSONAL_DAYS: 0,
  SALES_TOTAL_DAYS: 0,

  // Soft enforcement requirement
  REQUIRED_WINTER_DAYS: 5, // Days that must be used in Jan, Feb, or Dec
  WINTER_MONTHS: [0, 1, 11], // January (0), February (1), December (11)

  // Waiting period for new hires (in days)
  DEFAULT_WAITING_PERIOD: 90,
} as const;

// Helper function to get PTO allocation based on employment type
export function getPtoAllocation(employmentType?: string, department?: string) {
  // Sales reps and 1099 contractors get 0 PTO
  if (
    employmentType === '1099' ||
    department?.toLowerCase() === 'sales' ||
    department?.toLowerCase().includes('sales')
  ) {
    return {
      vacationDays: PTO_POLICY.SALES_VACATION_DAYS,
      sickDays: PTO_POLICY.SALES_SICK_DAYS,
      personalDays: PTO_POLICY.SALES_PERSONAL_DAYS,
      totalDays: PTO_POLICY.SALES_TOTAL_DAYS,
    };
  }

  // Everyone else gets the standard allocation
  return {
    vacationDays: PTO_POLICY.DEFAULT_VACATION_DAYS,
    sickDays: PTO_POLICY.DEFAULT_SICK_DAYS,
    personalDays: PTO_POLICY.DEFAULT_PERSONAL_DAYS,
    totalDays: PTO_POLICY.DEFAULT_TOTAL_DAYS,
  };
}

// Check if a date is in a winter month (Jan, Feb, Dec)
export function isWinterMonth(date: Date): boolean {
  return PTO_POLICY.WINTER_MONTHS.includes(date.getMonth());
}

// Calculate how many winter PTO days have been used
export function getWinterDaysUsed(ptoRequests: Array<{ startDate: string; endDate: string; status: string }>): number {
  let winterDays = 0;

  for (const request of ptoRequests) {
    if (request.status !== 'APPROVED') continue;

    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    const current = new Date(start);

    while (current <= end) {
      if (isWinterMonth(current)) {
        winterDays++;
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return winterDays;
}

// Check if user has met winter PTO requirement
export function hasMetWinterRequirement(ptoRequests: Array<{ startDate: string; endDate: string; status: string }>): boolean {
  return getWinterDaysUsed(ptoRequests) >= PTO_POLICY.REQUIRED_WINTER_DAYS;
}
