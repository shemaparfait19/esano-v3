/**
 * Family Code Generation and Validation System
 *
 * Family codes are 8-character alphanumeric codes that allow users to join existing family trees.
 * Only family heads can generate these codes.
 */

export function generateFamilyCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function validateFamilyCode(code: string): boolean {
  // Family codes should be exactly 8 characters, alphanumeric, uppercase
  const pattern = /^[A-Z0-9]{8}$/;
  return pattern.test(code);
}

export function formatFamilyCode(code: string): string {
  // Format as XXXX-XXXX for display
  if (code.length === 8) {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }
  return code;
}
