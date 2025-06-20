/**
 * Utility functions for handling precision in trading operations
 */

/**
 * Rounds a number to the specified step size precision
 * @param value - The value to round
 * @param stepSize - The step size (e.g., 0.001, 0.01, 1)
 * @returns The rounded value
 */
export function roundToPrecision(value: number, stepSize: number): number {
  if (stepSize === 0) return value;
  
  // Calculate the number of decimal places in stepSize
  const decimals = stepSize.toString().split('.')[1]?.length || 0;
  
  // Round to step size
  const rounded = Math.floor(value / stepSize) * stepSize;
  
  // Return with proper decimal places
  return parseFloat(rounded.toFixed(decimals));
}

/**
 * Formats a number to string with proper precision
 * @param value - The value to format
 * @param stepSize - The step size for precision
 * @returns Formatted string
 */
export function formatToPrecision(value: number, stepSize: number): string {
  const rounded = roundToPrecision(value, stepSize);
  
  // Calculate decimal places from stepSize
  const decimals = stepSize.toString().split('.')[1]?.length || 0;
  
  return rounded.toFixed(decimals);
}

/**
 * Validates if a value meets the minimum and maximum constraints
 * @param value - The value to validate
 * @param minValue - Minimum allowed value
 * @param maxValue - Maximum allowed value
 * @returns True if valid, false otherwise
 */
export function validateRange(value: number, minValue: number, maxValue: number): boolean {
  return value >= minValue && value <= maxValue;
}