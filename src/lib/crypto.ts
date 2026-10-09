import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Format: enc:v1:<base64(iv[12] | tag[16] | ciphertext)>, AES-256-GCM.
// Values without the prefix are plaintext written before encryption existed and are returned as is.
const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const raw = process.env.SENHAFACIL_ENC_KEY;
  if (!raw) throw new Error('SENHAFACIL_ENC_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SENHAFACIL_ENC_KEY must be 32 bytes in base64');
  return key;
}

export function encryptValue<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string' || value === '' || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return (PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')) as T;
}

export function decryptValue<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8') as T;
}

type SecretFields = { senha?: string | null; customFields?: Array<{ label: string; value: string }> | null };

function mapSecrets<T extends SecretFields>(entry: T, fn: (v: string) => string): T {
  const out = { ...entry };
  if (typeof out.senha === 'string') out.senha = fn(out.senha);
  if (Array.isArray(out.customFields)) {
    out.customFields = out.customFields.map(cf => ({ ...cf, value: typeof cf.value === 'string' ? fn(cf.value) : cf.value }));
  }
  return out;
}

export const encryptEntry = <T extends SecretFields>(entry: T): T => mapSecrets(entry, encryptValue);

export const decryptEntry = <T extends SecretFields>(entry: T): T => mapSecrets(entry, decryptValue);
