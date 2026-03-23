const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const SALTED_PREFIX = textEncoder.encode("Salted__");
const SALT_LENGTH = 8;
const AES_KEY_LENGTH = 32;
const AES_IV_LENGTH = 16;
const DERIVED_BYTES_LENGTH = AES_KEY_LENGTH + AES_IV_LENGTH;

export const OPENSSL_SETTINGS = Object.freeze({
  alg: "AES-256-CBC",
  kdf: "PBKDF2",
  iter: 200000,
  digest: "sha256",
  tool: "openssl",
});

export function extractEnvelopeInput(rawInput) {
  const trimmed = String(rawInput ?? "").trim();
  if (trimmed.length === 0) {
    return { encoded: "", meta: "" };
  }

  if (!trimmed.startsWith("{")) {
    return { encoded: trimmed, meta: "" };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && typeof parsed.enc === "string") {
      return {
        encoded: parsed.enc.trim(),
        meta: typeof parsed.meta === "string" ? parsed.meta : "",
      };
    }
  } catch {
    // Treat the input as raw base64 when JSON parsing fails.
  }

  return { encoded: trimmed, meta: "" };
}

export async function encryptOpenSslBase64(plaintext, password, options = {}) {
  const normalizedPassword = String(password ?? "");
  if (normalizedPassword.length === 0) {
    throw new Error("A password is required to encrypt the message.");
  }

  const saltBytes =
    options.saltBytes instanceof Uint8Array
      ? new Uint8Array(options.saltBytes)
      : crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  if (saltBytes.length !== SALT_LENGTH) {
    throw new Error("OpenSSL-compatible salt must be exactly 8 bytes long.");
  }

  const { key, iv } = await deriveKeyAndIv(normalizedPassword, saltBytes);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      key,
      textEncoder.encode(String(plaintext ?? "")),
    ),
  );

  const envelope = new Uint8Array(SALTED_PREFIX.length + saltBytes.length + ciphertext.length);
  envelope.set(SALTED_PREFIX, 0);
  envelope.set(saltBytes, SALTED_PREFIX.length);
  envelope.set(ciphertext, SALTED_PREFIX.length + saltBytes.length);

  return bytesToBase64(envelope);
}

export async function decryptOpenSslBase64(encoded, password) {
  const normalizedPassword = String(password ?? "");
  if (normalizedPassword.length === 0) {
    throw new Error("A password is required to decrypt the message.");
  }

  const payloadBytes = base64ToBytes(String(encoded ?? ""));
  if (payloadBytes.length <= SALTED_PREFIX.length + SALT_LENGTH) {
    throw new Error("The payload is too short to contain an OpenSSL envelope.");
  }

  const prefix = payloadBytes.subarray(0, SALTED_PREFIX.length);
  if (!areEqual(prefix, SALTED_PREFIX)) {
    throw new Error('Invalid OpenSSL envelope. The payload should start with the "Salted__" header.');
  }

  const saltBytes = payloadBytes.subarray(SALTED_PREFIX.length, SALTED_PREFIX.length + SALT_LENGTH);
  const ciphertext = payloadBytes.subarray(SALTED_PREFIX.length + SALT_LENGTH);
  const { key, iv } = await deriveKeyAndIv(normalizedPassword, saltBytes);

  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
    return textDecoder.decode(plaintext);
  } catch {
    throw new Error("Decryption failed. Check the password and the base64 payload.");
  }
}

async function deriveKeyAndIv(password, saltBytes) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: OPENSSL_SETTINGS.iter,
      hash: "SHA-256",
    },
    passwordKey,
    DERIVED_BYTES_LENGTH * 8,
  );
  const derivedBytes = new Uint8Array(derivedBits);
  const keyBytes = derivedBytes.slice(0, AES_KEY_LENGTH);
  const iv = derivedBytes.slice(AES_KEY_LENGTH, DERIVED_BYTES_LENGTH);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, [
    "encrypt",
    "decrypt",
  ]);

  return { key, iv };
}

function base64ToBytes(input) {
  const normalized = String(input ?? "").replace(/\s+/g, "");
  if (normalized.length === 0) {
    throw new Error("Paste a base64 payload to decrypt.");
  }

  try {
    const binary = decodeBase64(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error("The payload is not valid base64.");
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return encodeBase64(binary);
}

function encodeBase64(binary) {
  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(binary, "binary").toString("base64");
}

function decodeBase64(base64) {
  if (typeof atob === "function") {
    return atob(base64);
  }

  return Buffer.from(base64, "base64").toString("binary");
}

function areEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}
