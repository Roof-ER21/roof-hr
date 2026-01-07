// US Federal Holidays for PTO Calendar Display
// These are automatically displayed in the PTO calendar for awareness

export interface Holiday {
  date: string;  // YYYY-MM-DD format
  name: string;
}

// 2025 Company Holidays (Standard US Holidays)
export const US_HOLIDAYS_2025: Holiday[] = [
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-05-26', name: 'Memorial Day' },
  { date: '2025-07-04', name: 'Independence Day' },
  { date: '2025-09-01', name: 'Labor Day' },
  { date: '2025-11-27', name: 'Thanksgiving Day' },
  { date: '2025-11-28', name: 'Black Friday' },
  { date: '2025-12-24', name: 'Christmas Eve' },
  { date: '2025-12-25', name: 'Christmas Day' },
];

// 2026 Company Holidays (Standard US Holidays)
export const US_HOLIDAYS_2026: Holiday[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-07-04', name: 'Independence Day (Observed)' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-11-26', name: 'Thanksgiving Day' },
  { date: '2026-11-27', name: 'Black Friday' },
  { date: '2026-12-24', name: 'Christmas Eve' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

// Combined holidays for easy lookup
export const ALL_HOLIDAYS: Holiday[] = [...US_HOLIDAYS_2025, ...US_HOLIDAYS_2026];

/**
 * Check if a given date string is a holiday
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns boolean
 */
export function isHoliday(dateStr: string): boolean {
  return ALL_HOLIDAYS.some(h => h.date === dateStr);
}

/**
 * Get the holiday name for a given date
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Holiday name or null if not a holiday
 */
export function getHolidayName(dateStr: string): string | null {
  const holiday = ALL_HOLIDAYS.find(h => h.date === dateStr);
  return holiday?.name || null;
}

/**
 * Get all holidays for a specific year
 * @param year - The year (e.g., 2025)
 * @returns Array of holidays for that year
 */
export function getHolidaysForYear(year: number): Holiday[] {
  if (year === 2025) return US_HOLIDAYS_2025;
  if (year === 2026) return US_HOLIDAYS_2026;
  return [];
}

/**
 * Get holidays within a date range
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Array of holidays within the range
 */
export function getHolidaysInRange(startDate: string, endDate: string): Holiday[] {
  return ALL_HOLIDAYS.filter(h => h.date >= startDate && h.date <= endDate);
}
