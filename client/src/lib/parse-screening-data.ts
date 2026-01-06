/**
 * Safely parse screening data which may be either a JSON string or an already-parsed object.
 *
 * This handles the case where the API sometimes returns the data as a string (from database)
 * and sometimes as an already-parsed object (from query result transformations).
 *
 * @param data - The screening data (string, object, or null/undefined)
 * @returns The parsed screening data object, or null if invalid
 */
export function parseScreeningData(data: any): {
  hasDriversLicense?: boolean;
  hasReliableVehicle?: boolean;
  hasClearCommunication?: boolean;
  willingToRelocate?: boolean;
  availableForOvertime?: boolean;
  notes?: string;
} | null {
  if (!data) return null;

  // If it's already an object, return it directly
  if (typeof data === 'object' && data !== null) {
    return data;
  }

  // If it's a string, try to parse it
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      // Don't spam console with errors - just return null
      return null;
    }
  }

  return null;
}
