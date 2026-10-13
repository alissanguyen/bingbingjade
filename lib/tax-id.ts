/**
 * Recipient tax ID handling for customs-required destination countries
 * (e.g. Brazil's CPF/CNPJ, Mexico's RFC) — required by carriers to clear
 * customs, so checkout collects it and it's stored encrypted at rest.
 *
 * Encryption: AES-256-GCM, application-level. The key never touches the
 * database — it lives only in TAX_ID_ENCRYPTION_KEY (a 32-byte key,
 * base64-encoded). Ciphertext is stored as "{iv}:{authTag}:{ciphertext}"
 * (each base64), so a single text column round-trips it.
 *
 * SERVER-ONLY — never import this in client components.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV length for GCM

export { TAX_ID_REQUIRED_COUNTRIES, requiresTaxId } from "./tax-id-countries";

function getKey(): Buffer {
  const raw = process.env.TAX_ID_ENCRYPTION_KEY;
  if (!raw) throw new Error("TAX_ID_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TAX_ID_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

/** Encrypts a plaintext tax ID. Fails closed — throws rather than ever storing plaintext. */
export function encryptTaxId(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Decrypts a value produced by encryptTaxId(). Throws on any tampering or key mismatch. */
export function decryptTaxId(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed tax ID ciphertext");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Last 4 characters of the plaintext, for masked admin display without decrypting. */
export function taxIdLast4(plaintext: string): string {
  const trimmed = plaintext.trim();
  return trimmed.slice(-4);
}
