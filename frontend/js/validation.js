/**
 * validation.js - Form validation and sanitization engine
 */

export const POPULAR_COUNTRY_CODES = [
  { country: 'United States', code: 'US', dialCode: '+1', format: '(555) 000-0000' },
  { country: 'United Kingdom', code: 'GB', dialCode: '+44', format: '7911 123456' },
  { country: 'India', code: 'IN', dialCode: '+91', format: '98765 43210' },
  { country: 'Canada', code: 'CA', dialCode: '+1', format: '(555) 000-0000' },
  { country: 'Australia', code: 'AU', dialCode: '+61', format: '412 345 678' },
  { country: 'Germany', code: 'DE', dialCode: '+49', format: '151 23456789' },
  { country: 'France', code: 'FR', dialCode: '+33', format: '6 12 34 56 78' },
  { country: 'Japan', code: 'JP', dialCode: '+81', format: '90 1234 5678' },
  { country: 'Singapore', code: 'SG', dialCode: '+65', format: '8123 4567' },
  { country: 'United Arab Emirates', code: 'AE', dialCode: '+971', format: '50 123 4567' },
];

/**
 * Sanitizes input text by trimming whitespace and stripping HTML tags.
 */
export function sanitizeInput(value) {
  if (!value) return '';
  return String(value).trim().replace(/<[^>]*>?/gm, '');
}

/**
 * Validates a username according to standard security rules:
 * - 3 to 20 characters
 * - Alphanumeric, underscores, and dots allowed
 * - Cannot start or end with symbols
 * - No consecutive dots or underscores
 */
export function validateUsername(username) {
  const trimmed = (username || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Username is required.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long.' };
  }
  if (trimmed.length > 20) {
    return { isValid: false, error: 'Username cannot exceed 20 characters.' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return { isValid: false, error: 'Username may only contain letters, numbers, dots, and underscores.' };
  }
  if (/^[._-]|[._-]$/.test(trimmed)) {
    return { isValid: false, error: 'Username cannot begin or end with a symbol.' };
  }
  if (/[._-]{2,}/.test(trimmed)) {
    return { isValid: false, error: 'Username cannot contain consecutive symbols.' };
  }
  return { isValid: true };
}

/**
 * Validates email against standard RFC 5322 compliant regex pattern
 */
export function validateEmail(email) {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Email address is required.' };
  }
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. user@example.com).' };
  }
  if (trimmed.length > 254) {
    return { isValid: false, error: 'Email address is too long.' };
  }
  return { isValid: true };
}

/**
 * Validates phone numbers according to E.164 standards
 */
export function normalizeMobileNumber(mobile, dialCode) {
  const rawValue = (mobile || '').trim();
  const selectedDialCode = dialCode || '+1';
  const selectedCountryDigits = selectedDialCode.replace(/\D/g, '');
  const matchedCountry = POPULAR_COUNTRY_CODES
    .slice()
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => rawValue.startsWith(country.dialCode));
  const effectiveDialCode = matchedCountry ? matchedCountry.dialCode : selectedDialCode;
  const countryDigits = matchedCountry
    ? matchedCountry.dialCode.replace(/\D/g, '')
    : selectedCountryDigits;

  let digitsOnly = rawValue.replace(/\D/g, '');
  if (rawValue.startsWith('+') && countryDigits && digitsOnly.startsWith(countryDigits)) {
    digitsOnly = digitsOnly.slice(countryDigits.length);
  }

  return {
    dialCode: effectiveDialCode,
    localNumber: digitsOnly,
    e164Number: `${effectiveDialCode}${digitsOnly}`,
  };
}

export function validateMobileNumber(mobile, dialCode) {
  const { localNumber: digitsOnly, dialCode: effectiveDialCode } = normalizeMobileNumber(mobile, dialCode);
  if (!digitsOnly) {
    return { isValid: false, error: 'Enter your mobile number after the country code.' };
  }
  if (digitsOnly.length < 7) {
    return { isValid: false, error: 'Mobile number must include at least 7 digits after the country code.' };
  }
  if (digitsOnly.length > 15) {
    return { isValid: false, error: 'Mobile number cannot exceed 15 digits.' };
  }
  if (effectiveDialCode === '+1' && digitsOnly.length !== 10) {
    return { isValid: false, error: 'US/Canada phone numbers must be exactly 10 digits.' };
  }
  if (effectiveDialCode === '+91' && digitsOnly.length !== 10) {
    return { isValid: false, error: 'India mobile numbers must be exactly 10 digits.' };
  }
  return { isValid: true, cleanNumber: digitsOnly, dialCode: effectiveDialCode };
}

/**
 * Analyzes password complexity and returns criteria flags, score (0-4), label, and color
 */
export function analyzePassword(password) {
  const pwd = password || '';
  const hasMinLength = pwd.length >= 8;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);

  let passedCriteria = 0;
  if (hasMinLength) passedCriteria++;
  if (hasUppercase) passedCriteria++;
  if (hasLowercase) passedCriteria++;
  if (hasNumber) passedCriteria++;
  if (hasSpecialChar) passedCriteria++;

  let score = 0;
  let label = 'Very Weak';
  let color = 'bg-rose-500';

  if (pwd.length === 0) {
    score = 0;
    label = 'Very Weak';
    color = 'bg-slate-300';
  } else if (passedCriteria <= 2 || pwd.length < 8) {
    score = 1;
    label = 'Weak';
    color = 'bg-rose-500';
  } else if (passedCriteria === 3) {
    score = 2;
    label = 'Fair';
    color = 'bg-amber-500';
  } else if (passedCriteria === 4) {
    score = 3;
    label = 'Good';
    color = 'bg-emerald-500';
  } else {
    score = 4;
    label = 'Strong';
    color = 'bg-teal-600';
  }

  return {
    score,
    label,
    color,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  };
}

/**
 * Validates password meets minimum security standards
 */
export function validatePassword(password) {
  if (!password) {
    return { isValid: false, error: 'Password is required.' };
  }
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one numeric digit (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character (!@#$%...).' };
  }
  return { isValid: true };
}

/**
 * Validates confirmation password matches
 */
export function validateConfirmPassword(password, confirm) {
  if (!confirm) {
    return { isValid: false, error: 'Please confirm your password.' };
  }
  if (password !== confirm) {
    return { isValid: false, error: 'Passwords do not match.' };
  }
  return { isValid: true };
}

/**
 * Validates login identifier: username, email, or phone
 */
export function validateLoginIdentifier(identifier) {
  const trimmed = (identifier || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please enter your username, email, or mobile number.' };
  }

  // Email format check
  if (trimmed.includes('@')) {
    const emailResult = validateEmail(trimmed);
    return emailResult.isValid
      ? { isValid: true, type: 'email' }
      : { isValid: false, error: 'Invalid email address format.' };
  }

  // Mobile format check
  const cleanDigits = trimmed.replace(/\D/g, '');
  if (/^\+?[0-9\s-]{7,16}$/.test(trimmed) && cleanDigits.length >= 7) {
    return { isValid: true, type: 'phone' };
  }

  // Otherwise username check
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Identifier must be at least 3 characters.' };
  }

  return { isValid: true, type: 'username' };
}
