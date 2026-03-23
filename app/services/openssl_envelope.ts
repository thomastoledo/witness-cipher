import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'

const SALTED_PREFIX = Buffer.from('Salted__')
const SALT_LENGTH = 8
const AES_KEY_LENGTH = 32
const AES_IV_LENGTH = 16
const DERIVED_BYTES_LENGTH = AES_KEY_LENGTH + AES_IV_LENGTH

export const OPENSSL_SETTINGS = Object.freeze({
  alg: 'AES-256-CBC',
  kdf: 'PBKDF2',
  iter: 200000,
  digest: 'sha256',
  tool: 'openssl',
})

export const OPENSSL_COMMAND = `openssl enc -aes-256-cbc -pbkdf2 -iter ${OPENSSL_SETTINGS.iter} -md ${OPENSSL_SETTINGS.digest} -a -A`

export function extractEnvelopeInput(rawInput: string) {
  const trimmed = String(rawInput ?? '').trim()
  if (trimmed.length === 0) {
    return { encoded: '', meta: '' }
  }

  if (!trimmed.startsWith('{')) {
    return { encoded: trimmed, meta: '' }
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && typeof parsed.enc === 'string') {
      return {
        encoded: parsed.enc.trim(),
        meta: typeof parsed.meta === 'string' ? parsed.meta : '',
      }
    }
  } catch {
    // Fall back to raw base64 input when JSON parsing fails.
  }

  return { encoded: trimmed, meta: '' }
}

export function encryptOpenSslBase64(
  plaintext: string,
  password: string,
  options: { saltBytes?: Uint8Array | Buffer } = {}
) {
  const normalizedPassword = String(password ?? '')
  if (normalizedPassword.length === 0) {
    throw new Error('A password is required to encrypt the message.')
  }

  const saltBytes =
    options.saltBytes instanceof Uint8Array || Buffer.isBuffer(options.saltBytes)
      ? Buffer.from(options.saltBytes)
      : randomBytes(SALT_LENGTH)

  if (saltBytes.length !== SALT_LENGTH) {
    throw new Error('OpenSSL-compatible salt must be exactly 8 bytes long.')
  }

  const { key, iv } = deriveKeyAndIv(normalizedPassword, saltBytes)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext ?? ''), 'utf8'),
    cipher.final(),
  ])

  return Buffer.concat([SALTED_PREFIX, saltBytes, ciphertext]).toString('base64')
}

export function decryptOpenSslBase64(encoded: string, password: string) {
  const normalizedPassword = String(password ?? '')
  if (normalizedPassword.length === 0) {
    throw new Error('A password is required to decrypt the message.')
  }

  const payloadBytes = base64ToBytes(String(encoded ?? ''))
  if (payloadBytes.length <= SALTED_PREFIX.length + SALT_LENGTH) {
    throw new Error('The payload is too short to contain an OpenSSL envelope.')
  }

  const prefix = payloadBytes.subarray(0, SALTED_PREFIX.length)
  if (!prefix.equals(SALTED_PREFIX)) {
    throw new Error('Invalid OpenSSL envelope. The payload should start with the "Salted__" header.')
  }

  const saltBytes = payloadBytes.subarray(SALTED_PREFIX.length, SALTED_PREFIX.length + SALT_LENGTH)
  const ciphertext = payloadBytes.subarray(SALTED_PREFIX.length + SALT_LENGTH)
  const { key, iv } = deriveKeyAndIv(normalizedPassword, saltBytes)

  try {
    const decipher = createDecipheriv('aes-256-cbc', key, iv)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    throw new Error('Decryption failed. Check the password and the base64 payload.')
  }
}

export function formatIfJson(text: string) {
  const trimmed = String(text ?? '').trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return String(text ?? '')
  }

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return String(text ?? '')
  }
}

function deriveKeyAndIv(password: string, saltBytes: Uint8Array | Buffer) {
  const derivedBytes = pbkdf2Sync(
    password,
    saltBytes,
    OPENSSL_SETTINGS.iter,
    DERIVED_BYTES_LENGTH,
    OPENSSL_SETTINGS.digest
  )

  return {
    key: derivedBytes.subarray(0, AES_KEY_LENGTH),
    iv: derivedBytes.subarray(AES_KEY_LENGTH, DERIVED_BYTES_LENGTH),
  }
}

function base64ToBytes(input: string) {
  const normalized = String(input ?? '').replace(/\s+/g, '')
  if (normalized.length === 0) {
    throw new Error('Paste a base64 payload to decrypt.')
  }

  if (!isValidBase64(normalized)) {
    throw new Error('The payload is not valid base64.')
  }

  return Buffer.from(normalized, 'base64')
}

function isValidBase64(value: string) {
  if (value.length === 0 || value.length % 4 !== 0) {
    return false
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return false
  }

  const decoded = Buffer.from(value, 'base64')
  return decoded.toString('base64') === value
}
