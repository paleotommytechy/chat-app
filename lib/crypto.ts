const encoder = new TextEncoder();
const ENV_SALT = encoder.encode("friendspace-sensitive-file-v1");
const IV_BYTES = 12;

export function isSensitiveEnvFile(fileName: string) {
  const name = fileName.toLowerCase();
  return name === ".env" || name.startsWith(".env.") || name.endsWith(".env") || name.endsWith(".env.local");
}

async function deriveKey(accessCode: string) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(accessCode),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: ENV_SALT,
      iterations: 180_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSensitiveFile(file: File, accessCode: string) {
  const key = await deriveKey(accessCode);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = await file.arrayBuffer();
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return new Blob([iv, cipher], { type: "application/octet-stream" });
}

export async function decryptSensitiveFile(payload: ArrayBuffer, accessCode: string, mimeType: string) {
  const bytes = new Uint8Array(payload);
  const iv = bytes.slice(0, IV_BYTES);
  const cipher = bytes.slice(IV_BYTES);
  const key = await deriveKey(accessCode);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new Blob([plain], { type: mimeType || "application/octet-stream" });
}
