import router from '@adonisjs/core/services/router'
import type { HttpContext } from '@adonisjs/core/http'
import {
  OPENSSL_COMMAND,
  OPENSSL_SETTINGS,
  decryptOpenSslBase64,
  encryptOpenSslBase64,
  extractEnvelopeInput,
  formatIfJson,
} from '#services/openssl_envelope'

const DEFAULT_TEXT =
  'We had to encrypt the testimonies. Maybe you can find a useful tool on this website?'

type BannerTone = 'idle' | 'success' | 'error'

type BannerState = {
  text: string
  tone: BannerTone
}

type FormState = {
  message: string
  password: string
}

type DecodeFormState = {
  payload: string
  password: string
}

type PageState = {
  opensslCommand: string
  settings: typeof OPENSSL_SETTINGS
  encryptForm: FormState
  decodeForm: DecodeFormState
  encryptResult: string
  decodeResult: string
  meta: string
  encryptStatus: BannerState
  decodeStatus: BannerState
}

const defaultEncryptStatus = {
  tone: 'idle',
  text: 'Encrypt a testimony with the same OpenSSL-compatible envelope used by orbital-noise.',
} satisfies BannerState

const defaultDecodeStatus = {
  tone: 'idle',
  text: 'Paste raw base64 or the full JSON envelope to recover the testimony.',
} satisfies BannerState

router.get('/', async ({ view }: HttpContext) => {
  return view.render('pages/home', buildPageState())
})

router.post('/encrypt', async ({ request, response, view }: HttpContext) => {
  const encryptForm: FormState = {
    message: request.input('message', DEFAULT_TEXT),
    password: request.input('password', ''),
  }

  if (encryptForm.message.trim().length === 0 || encryptForm.password.length === 0) {
    response.status(400)
    return view.render(
      'pages/home',
      buildPageState({
        encryptForm,
        encryptStatus: {
          tone: 'error',
          text: 'A message and a password are required to encrypt the testimony.',
        },
      })
    )
  }

  try {
    const encryptResult = encryptOpenSslBase64(encryptForm.message, encryptForm.password)
    return view.render(
      'pages/home',
      buildPageState({
        encryptForm,
        decodeForm: {
          payload: encryptResult,
          password: encryptForm.password,
        },
        encryptResult,
        encryptStatus: {
          tone: 'success',
          text: 'Message encrypted and encoded. The payload is ready to copy or to inspect in the decode station.',
        },
        decodeStatus: {
          tone: 'idle',
          text: 'The freshly generated payload was mirrored into the decode station below.',
        },
      })
    )
  } catch (error) {
    response.status(400)
    return view.render(
      'pages/home',
      buildPageState({
        encryptForm,
        encryptStatus: {
          tone: 'error',
          text: getErrorMessage(error, 'Encryption failed.'),
        },
      })
    )
  }
})

router.post('/decrypt', async ({ request, response, view }: HttpContext) => {
  const decodeForm: DecodeFormState = {
    payload: request.input('payload', ''),
    password: request.input('password', ''),
  }
  const extracted = extractEnvelopeInput(decodeForm.payload)

  if (extracted.encoded.length === 0 || decodeForm.password.length === 0) {
    response.status(400)
    return view.render(
      'pages/home',
      buildPageState({
        decodeForm,
        meta: extracted.meta,
        decodeStatus: {
          tone: 'error',
          text: 'A payload and a password are required to decrypt the testimony.',
        },
      })
    )
  }

  try {
    const decodeResult = formatIfJson(decryptOpenSslBase64(extracted.encoded, decodeForm.password))
    return view.render(
      'pages/home',
      buildPageState({
        decodeForm,
        decodeResult,
        meta: extracted.meta,
        decodeStatus: {
          tone: 'success',
          text:
            extracted.meta.length > 0
              ? 'Envelope decoded successfully. The meta clue from the JSON response is visible above the decrypted text.'
              : 'Payload decoded successfully.',
        },
      })
    )
  } catch (error) {
    response.status(400)
    return view.render(
      'pages/home',
      buildPageState({
        decodeForm,
        meta: extracted.meta,
        decodeStatus: {
          tone: 'error',
          text: getErrorMessage(error, 'Decryption failed.'),
        },
      })
    )
  }
})

function buildPageState(overrides: Partial<PageState> = {}): PageState {
  return {
    opensslCommand: OPENSSL_COMMAND,
    settings: OPENSSL_SETTINGS,
    encryptForm: {
      message: DEFAULT_TEXT,
      password: '',
      ...overrides.encryptForm,
    },
    decodeForm: {
      payload: '',
      password: '',
      ...overrides.decodeForm,
    },
    encryptResult: overrides.encryptResult ?? '',
    decodeResult: overrides.decodeResult ?? '',
    meta: overrides.meta ?? '',
    encryptStatus: {
      ...defaultEncryptStatus,
      ...overrides.encryptStatus,
    },
    decodeStatus: {
      ...defaultDecodeStatus,
      ...overrides.decodeStatus,
    },
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}
