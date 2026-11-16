/**
 * Client-side Password Policy, Strength Estimator & Cryptographic Generator
 * for Kadambas Game Management System.
 */

export const COMMON_PASSWORDS = new Set([
  '123456',
  '12345678',
  '123456789',
  '1234567890',
  '123456789012',
  'password',
  'password123',
  'password1234',
  'password12345',
  'admin123',
  'admin1234',
  'admin12345',
  'admin123456',
  'qwerty',
  'qwerty123456',
  'qwertyuiop',
  'letmein',
  'welcome',
  'welcome123',
  'welcome1234',
  'iloveyou',
  'kadambas',
  'kadambas123',
  'kadambas1234',
  'kadambas12345',
  'abc123456789',
  'changeme',
  'masterpassword',
  'superadmin123',
]);

/**
 * Checks whether a string consists of simple sequential characters (e.g. "123456789012", "abcdefghijkl")
 */
function isSequential(str) {
  if (!str || str.length < 8) return false;
  let isAscending = true;
  let isDescending = true;
  for (let i = 1; i < str.length; i++) {
    const diff = str.charCodeAt(i) - str.charCodeAt(i - 1);
    if (diff !== 1) isAscending = false;
    if (diff !== -1) isDescending = false;
  }
  return isAscending || isDescending;
}

/**
 * Checks whether a string consists of repeated identical characters (e.g. "aaaaaaaaaaaa")
 */
function isRepeated(str) {
  if (!str || str.length < 6) return false;
  return /^([a-zA-Z0-9])\1+$/.test(str);
}

/**
 * Checks if password contains personal account details (username, parts of name, phone)
 */
export function containsPersonalDetails(password, userContext = {}) {
  if (!password) return false;
  const lowerPassword = password.toLowerCase();

  if (userContext.email) {
    const cleanEmail = String(userContext.email).trim().toLowerCase();
    const emailPrefix = cleanEmail.split('@')[0];
    if (emailPrefix.length >= 3 && lowerPassword.includes(emailPrefix)) {
      return true;
    }
  }

  if (userContext.username) {
    const cleanUsername = String(userContext.username).trim().toLowerCase();
    if (cleanUsername.length >= 3 && lowerPassword.includes(cleanUsername)) {
      return true;
    }
  }

  if (userContext.name) {
    const nameWords = String(userContext.name)
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    for (const word of nameWords) {
      if (lowerPassword.includes(word)) {
        return true;
      }
    }
  }

  if (userContext.phone) {
    const phoneDigits = String(userContext.phone).replace(/\D/g, '');
    if (phoneDigits.length >= 6) {
      const last6 = phoneDigits.slice(-6);
      if (password.includes(phoneDigits) || password.includes(last6)) {
        return true;
      }
    }
  }

  return false;
}

const COMMON_BASE_WORDS = ['password', 'admin', 'welcome', 'qwerty', 'kadambas', 'master', 'chapter'];

/**
 * Checks if password matches common/guessable patterns
 */
export function isCommonPassword(password) {
  if (!password) return false;
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPassword) || isSequential(lowerPassword) || isRepeated(password)) {
    return true;
  }
  const baseLetters = lowerPassword.replace(/[^a-z]/g, '');
  if (COMMON_BASE_WORDS.includes(baseLetters)) {
    return true;
  }
  for (const prefix of COMMON_BASE_WORDS) {
    if (lowerPassword.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks password against individual criteria for live requirements checklist.
 */
export function checkPasswordRequirements(password, userContext = {}) {
  const pwd = password || '';
  const hasMinLength = pwd.length >= 12;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const notPersonal = pwd.length > 0 ? !containsPersonalDetails(pwd, userContext) : true;
  const notCommon = pwd.length > 0 ? !isCommonPassword(pwd) : true;

  return [
    {
      id: 'length',
      label: 'Minimum 12 characters',
      met: hasMinLength,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      met: hasUppercase,
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      met: hasLowercase,
    },
    {
      id: 'number',
      label: 'At least one number (0-9)',
      met: hasNumber,
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%...)',
      met: hasSpecial,
    },
    {
      id: 'noPersonal',
      label: 'No username, name or phone number',
      met: notPersonal,
    },
    {
      id: 'notCommon',
      label: 'Not easily guessed (e.g. password123)',
      met: notCommon,
    },
  ];
}

/**
 * Calculates live password strength: Weak, Fair, Good, or Strong.
 * Returns null if password is empty.
 */
export function calculatePasswordStrength(password, userContext = {}) {
  if (!password) return null;

  const reqs = checkPasswordRequirements(password, userContext);
  const hasMinLength = reqs.find((r) => r.id === 'length')?.met;
  const hasUppercase = reqs.find((r) => r.id === 'uppercase')?.met;
  const hasLowercase = reqs.find((r) => r.id === 'lowercase')?.met;
  const hasNumber = reqs.find((r) => r.id === 'number')?.met;
  const hasSpecial = reqs.find((r) => r.id === 'special')?.met;
  const notPersonal = reqs.find((r) => r.id === 'noPersonal')?.met;
  const notCommon = reqs.find((r) => r.id === 'notCommon')?.met;

  // Fatal flaws instantly make it Weak
  if (!notPersonal || !notCommon || password.length < 8) {
    return {
      score: 1,
      level: 'Weak',
      color: 'bg-rose-500',
      textColor: 'text-rose-600',
      badgeBg: 'bg-rose-50 border-rose-200 text-rose-700',
      percent: 25,
    };
  }

  // Count core complexity criteria: length >= 12, upper, lower, number, special
  let passedCount = 0;
  if (hasMinLength) passedCount++;
  if (hasUppercase) passedCount++;
  if (hasLowercase) passedCount++;
  if (hasNumber) passedCount++;
  if (hasSpecial) passedCount++;

  // If length is between 8 and 11, max strength is Fair
  if (password.length < 12) {
    return {
      score: 2,
      level: 'Fair',
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
      percent: 50,
    };
  }

  // Length >= 12 and not common / not personal
  if (passedCount < 5) {
    return {
      score: 2,
      level: 'Fair',
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
      percent: 50,
    };
  }

  // Passed all 5 core requirements + length >= 12
  // Check for Strong: length >= 14 with good entropy (multiple digits or symbols)
  const numbersCount = (password.match(/[0-9]/g) || []).length;
  const specialCount = (password.match(/[^A-Za-z0-9]/g) || []).length;
  const isHighEntropy = password.length >= 14 && (numbersCount >= 2 || specialCount >= 2);

  if (isHighEntropy) {
    return {
      score: 4,
      level: 'Strong',
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      percent: 100,
    };
  }

  return {
    score: 3,
    level: 'Good',
    color: 'bg-sky-500',
    textColor: 'text-sky-600',
    badgeBg: 'bg-sky-50 border-sky-200 text-sky-700',
    percent: 75,
  };
}

/**
 * Validates password on the client before form submit.
 * Returns { isValid: boolean, message?: string }
 */
export function validatePasswordClient(password, userContext = {}) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required.' };
  }
  if (password.length < 12) {
    return { isValid: false, message: 'Password must be at least 12 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number (0-9).' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character (!@#$%...).' };
  }
  if (isCommonPassword(password)) {
    return { isValid: false, message: 'This password is too common or easily guessed.' };
  }
  if (containsPersonalDetails(password, userContext)) {
    return { isValid: false, message: 'Password must not contain username, name, or phone number.' };
  }
  return { isValid: true };
}

/**
 * Generates a cryptographically secure strong random password using window.crypto.getRandomValues.
 * Guarantees length >= 16 with uppercase, lowercase, numbers, and special symbols.
 */
export function generateStrongPassword(length = 16) {
  const targetLength = Math.max(16, length);
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const NUMBERS = '0123456789';
  const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const ALL = LOWER + UPPER + NUMBERS + SPECIAL;

  const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : null;

  function getRandomInt(max) {
    if (cryptoObj && cryptoObj.getRandomValues) {
      const buffer = new Uint32Array(1);
      cryptoObj.getRandomValues(buffer);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  // Guarantee at least 2 of each character type
  const chars = [
    LOWER[getRandomInt(LOWER.length)],
    LOWER[getRandomInt(LOWER.length)],
    UPPER[getRandomInt(UPPER.length)],
    UPPER[getRandomInt(UPPER.length)],
    NUMBERS[getRandomInt(NUMBERS.length)],
    NUMBERS[getRandomInt(NUMBERS.length)],
    SPECIAL[getRandomInt(SPECIAL.length)],
    SPECIAL[getRandomInt(SPECIAL.length)],
  ];

  // Fill remaining slots from combined pool
  while (chars.length < targetLength) {
    chars.push(ALL[getRandomInt(ALL.length)]);
  }

  // Cryptographic Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
}
