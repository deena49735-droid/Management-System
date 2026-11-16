/**
 * Password validation policy for Kadambas Game Management System.
 *
 * Rules:
 * - Minimum 12 characters.
 * - At least one uppercase letter [A-Z].
 * - At least one lowercase letter [a-z].
 * - At least one number [0-9].
 * - At least one special character [^A-Za-z0-9].
 * - Reject common and easily guessed passwords.
 * - Reject passwords containing username, name words, or phone numbers.
 */

// Common weak password blacklist (normalized lowercase)
const COMMON_PASSWORDS = new Set([
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
  if (str.length < 8) return false;
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
  if (str.length < 6) return false;
  return /^([a-zA-Z0-9])\1+$/.test(str);
}

/**
 * Validates a candidate password against security requirements.
 *
 * @param {string} password Candidate plaintext password
 * @param {Object} [userContext] Optional user context to prevent personal details
 * @param {string} [userContext.username]
 * @param {string} [userContext.name]
 * @param {string} [userContext.phone]
 * @returns {{ isValid: boolean, message?: string }}
 */
const COMMON_BASE_WORDS = ['password', 'admin', 'welcome', 'qwerty', 'kadambas', 'master', 'chapter'];

/**
 * Checks whether a password is a common or easily guessed variation.
 */
function isCommonPassword(password) {
  if (!password) return false;
  const lowerPassword = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lowerPassword) || isSequential(lowerPassword) || isRepeated(password)) {
    return true;
  }

  // Strip trailing/surrounding numbers and symbols to catch "Password123!", "Admin123456@", etc.
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
 * Validates a candidate password against security requirements.
 *
 * @param {string} password Candidate plaintext password
 * @param {Object} [userContext] Optional user context to prevent personal details
 * @param {string} [userContext.username]
 * @param {string} [userContext.name]
 * @param {string} [userContext.phone]
 * @returns {{ isValid: boolean, message?: string }}
 */
function validatePassword(password, userContext = {}) {
  if (typeof password !== 'string') {
    return { isValid: false, message: 'Password must be a string.' };
  }

  // 1. Minimum 12 characters
  if (password.length < 12) {
    return {
      isValid: false,
      message: 'Password must be at least 12 characters long.',
    };
  }

  // 2. Common / easily guessed passwords
  if (isCommonPassword(password)) {
    return {
      isValid: false,
      message: 'This password is too common or easily guessed. Please choose a stronger password.',
    };
  }

  // 3. Reject passwords containing email, username or personal account details
  const lowerPassword = password.toLowerCase();
  if (userContext.email) {
    const cleanEmail = String(userContext.email).trim().toLowerCase();
    const emailPrefix = cleanEmail.split('@')[0];
    if (emailPrefix.length >= 3 && lowerPassword.includes(emailPrefix)) {
      return {
        isValid: false,
        message: 'Password must not contain parts of your email address.',
      };
    }
  }

  if (userContext.username) {
    const cleanUsername = String(userContext.username).trim().toLowerCase();
    if (cleanUsername.length >= 3 && lowerPassword.includes(cleanUsername)) {
      return {
        isValid: false,
        message: 'Password must not contain the username.',
      };
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
        return {
          isValid: false,
          message: 'Password must not contain parts of your name.',
        };
      }
    }
  }

  if (userContext.phone) {
    const phoneDigits = String(userContext.phone).replace(/\D/g, '');
    if (phoneDigits.length >= 6) {
      const last6 = phoneDigits.slice(-6);
      if (password.includes(phoneDigits) || password.includes(last6)) {
        return {
          isValid: false,
          message: 'Password must not contain your phone number.',
        };
      }
    }
  }

  // 4. At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter (A-Z).',
    };
  }

  // 5. At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter (a-z).',
    };
  }

  // 6. At least one number
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number (0-9).',
    };
  }

  // 7. At least one special character
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character (e.g. !@#$%^&*).',
    };
  }

  return { isValid: true };
}

module.exports = {
  validatePassword,
  COMMON_PASSWORDS,
};
