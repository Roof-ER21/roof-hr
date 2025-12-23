// Predefined colors for sourcer identification
// These colors are chosen to NOT conflict with position colors (left border colors):
// Position colors use: Red, Green, Purple, Orange, Blue, Cyan
// Screener colors use: Pink, Violet, Indigo, Teal, Amber, Lime, Rose

export const SCREENER_COLORS = [
  '#EC4899', // Pink
  '#8B5CF6', // Violet
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F59E0B', // Amber
  '#84CC16', // Lime
  '#F472B6', // Rose
  '#A78BFA', // Light violet
  '#22D3EE', // Light cyan
  '#FBBF24', // Yellow
];

/**
 * Get the next available color for a new sourcer
 * @param usedColors Array of colors already assigned to other sourcers
 * @returns A hex color string
 */
export function getNextAvailableColor(usedColors: string[]): string {
  // Find first unused color
  const available = SCREENER_COLORS.find(c => !usedColors.includes(c));

  // If all colors are used, return a random one
  return available || SCREENER_COLORS[Math.floor(Math.random() * SCREENER_COLORS.length)];
}

/**
 * Default color for sourcers without an assigned color
 */
export const DEFAULT_SCREENER_COLOR = '#6B7280'; // Gray
