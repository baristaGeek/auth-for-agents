import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

// Convert hex key to buffer
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

/**
 * Encrypt sensitive data (OAuth tokens)
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data (OAuth tokens)
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
