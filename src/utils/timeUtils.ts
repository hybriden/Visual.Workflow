/**
 * Pure utility functions for time-related calculations.
 * These functions have no dependencies and can be easily unit tested.
 */

/**
 * Format minutes as a human-readable time display.
 * Examples: 30 -> "30m", 90 -> "1h 30m", 120 -> "2h 0m"
 *
 * @param totalMinutes - Total minutes to format
 * @returns Formatted time string
 */
export function formatTimeDisplay(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/**
 * Parse a time string into minutes.
 * Supports formats: "1h", "30m", "1h 30m", "90" (assumed minutes)
 *
 * @param timeString - Time string to parse
 * @returns Total minutes, or null if invalid format
 */
export function parseTimeString(timeString: string): number | null {
  if (!timeString || typeof timeString !== 'string') {
    return null;
  }

  const trimmed = timeString.trim().toLowerCase();

  // Just a number - assume minutes
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Format: "1h 30m" or "1h30m"
  const fullMatch = trimmed.match(/^(\d+)\s*h\s*(\d+)\s*m$/);
  if (fullMatch) {
    return parseInt(fullMatch[1], 10) * 60 + parseInt(fullMatch[2], 10);
  }

  // Format: "1h"
  const hoursMatch = trimmed.match(/^(\d+)\s*h$/);
  if (hoursMatch) {
    return parseInt(hoursMatch[1], 10) * 60;
  }

  // Format: "30m"
  const minsMatch = trimmed.match(/^(\d+)\s*m$/);
  if (minsMatch) {
    return parseInt(minsMatch[1], 10);
  }

  return null;
}

/**
 * Calculate percentage of time spent vs estimated.
 *
 * @param spent - Minutes spent
 * @param estimated - Minutes estimated
 * @returns Percentage (e.g., 50 means 50% of estimate used)
 */
export function calculateTimePercentage(spent: number, estimated: number): number {
  if (estimated <= 0) {
    return 0;
  }
  return Math.round((spent / estimated) * 100);
}

/**
 * Get today's date in YYYY-MM-DD format.
 *
 * @returns Date string in ISO format (date only)
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Round minutes to nearest interval (e.g., 15 or 30 minutes).
 *
 * @param minutes - Minutes to round
 * @param interval - Interval to round to (default: 15)
 * @returns Rounded minutes
 */
export function roundMinutes(minutes: number, interval: number = 15): number {
  return Math.round(minutes / interval) * interval;
}

/**
 * Split total minutes into multiple entries, each with max duration.
 * Useful for splitting long work sessions.
 *
 * @param totalMinutes - Total minutes to split
 * @param maxPerEntry - Maximum minutes per entry (default: 180 = 3 hours)
 * @returns Array of minute values that sum to totalMinutes
 */
export function splitMinutes(totalMinutes: number, maxPerEntry: number = 180): number[] {
  if (totalMinutes <= maxPerEntry) {
    return [totalMinutes];
  }

  const entries: number[] = [];
  let remaining = totalMinutes;

  while (remaining > 0) {
    const chunk = Math.min(remaining, maxPerEntry);
    entries.push(chunk);
    remaining -= chunk;
  }

  return entries;
}
