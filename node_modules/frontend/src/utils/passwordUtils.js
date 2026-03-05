// Password validation and strength utilities
export function validatePassword(pw) {
  const errors = [];
  if (!pw) return { valid: false, errors: ['Password is required'] };
  if (pw.length < 8 || pw.length > 14) errors.push('Password must be 8–14 characters long');
  if (!/[a-z]/.test(pw)) errors.push('Include at least one lowercase letter');
  if (!/[A-Z]/.test(pw)) errors.push('Include at least one uppercase letter');
  if (!/[0-9]/.test(pw)) errors.push('Include at least one number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('Include at least one special character');
  return { valid: errors.length === 0, errors };
}

export function passwordStrengthLabel(pw) {
  if (!pw) return '';
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;

  if (score <= 2) return 'Weak';
  if (score <= 4) return 'Medium';
  return 'Strong';
}

export function passwordStrengthPercent(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(100, Math.round((score / 6) * 100));
}

export default { validatePassword, passwordStrengthLabel, passwordStrengthPercent };