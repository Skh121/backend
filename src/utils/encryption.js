import bcrypt from "bcrypt";
import crypto from "crypto";
import { securityConfig } from "../config/security.js";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from master key
 * @param {string} masterKey - Master encryption key
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived key
 */
const deriveKey = (masterKey, salt) => {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, "sha256");
};

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(securityConfig.password.bcryptRounds);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error("Error hashing password");
  }
};

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<boolean>} True if passwords match
 */
export const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new Error("Error comparing passwords");
  }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid and errors
 */
export const validatePasswordStrength = (password) => {
  const errors = [];
  const config = securityConfig.password;

  if (password.length < config.minLength) {
    errors.push(
      `Password must be at least ${config.minLength} characters long`,
    );
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (
    config.requireSpecialChars &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Generate a random token
 * @param {number} length - Length of the token
 * @returns {string} Random token
 */
export const generateRandomToken = (length = 32) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }

  return token;
};

/**
 * Generate a numeric OTP code
 * @param {number} length - Length of the OTP
 * @returns {string} OTP code
 */
export const generateOTP = (length = 6) => {
  const digits = "0123456789";
  let otp = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    otp += digits[randomValues[i] % digits.length];
  }

  return otp;
};

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @returns {string} Encrypted data with salt, iv, and auth tag (format: salt:iv:encrypted:tag)
 */
export const encryptField = (plaintext) => {
  if (!plaintext) return null;

  try {
    const masterKey = process.env.ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error("ENCRYPTION_KEY not set in environment variables");
    }

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from master key and salt
    const key = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Return format: salt:iv:encrypted:tag (all in hex)
    return `${salt.toString("hex")}:${iv.toString("hex")}:${encrypted}:${tag.toString("hex")}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param {string} encryptedData - Encrypted data (format: salt:iv:encrypted:tag)
 * @returns {string} Decrypted plaintext
 */
export const decryptField = (encryptedData) => {
  if (!encryptedData) return null;

  try {
    const masterKey = process.env.ENCRYPTION_KEY;
    if (!masterKey) {
      throw new Error("ENCRYPTION_KEY not set in environment variables");
    }

    // Parse encrypted data
    const parts = encryptedData.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted data format");
    }

    const salt = Buffer.from(parts[0], "hex");
    const iv = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const tag = Buffer.from(parts[3], "hex");

    // Derive key from master key and salt
    const key = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

/**
 * Check if a value is encrypted (has the format salt:iv:encrypted:tag)
 * @param {string} value - Value to check
 * @returns {boolean} True if encrypted
 */
export const isEncrypted = (value) => {
  if (!value || typeof value !== "string") return false;
  const parts = value.split(":");
  return parts.length === 4;
};
