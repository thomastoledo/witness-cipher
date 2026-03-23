# Witness Cipher

Witness Cipher is a small web app for encrypting and decrypting OpenSSL-compatible payloads.

It accepts plain text plus a password, produces a base64 envelope, and can also decode either:

- raw OpenSSL base64
- a full JSON envelope containing `enc` and `meta`

The app is meant to mirror the payload format used by `orbital-noise`.

## Crypto Settings

Witness Cipher uses:

- `AES-256-CBC`
- `PBKDF2`
- `200000` iterations
- `sha256`
- `openssl` envelope format with the `Salted__` header

Equivalent CLI:

```bash
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -a -A
```

## Stack

- AdonisJS
- Edge templates
- Vite
- Node.js crypto

## Requirements

- Node.js `24+`
- npm

## Getting Started

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

Run the crypto test suite:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

## App Behavior

The home page exposes two stations:

- `Encrypt and encode`: turns a message plus password into OpenSSL-compatible base64
- `Decode and decrypt`: accepts base64 or a full JSON envelope and recovers the original text

If the JSON input contains a `meta` field, Witness Cipher surfaces it above the decoded output.

## Routes

- `GET /`
- `POST /encrypt`
- `POST /decrypt`

## Project Structure

```text
app/
  services/
    openssl_envelope.ts      Core encryption/decryption logic
resources/
  views/
    pages/home.edge          Main UI
  css/app.css                UI styling
  js/app.js                  Client-side copy helpers
start/routes.ts              App routes and page state
test/opensslEnvelope.test.mjs
                             Crypto regression tests
```

## Notes

- The decode flow understands `orbital-noise`-style JSON envelopes.
- `meta` is displayed but not required for decryption.
- The current app expects a Node version compatible with modern AdonisJS releases.

## Heroku

For Heroku, the important points are:

- the app must be built during deploy
- production must start from `build/bin/server.js`
- you must define at least `APP_KEY`

The repository now includes a `Procfile` and a Heroku-specific build step.

Recommended Heroku config vars:

```text
APP_KEY=generate-a-real-secret
NODE_ENV=production
LOG_LEVEL=info
SESSION_DRIVER=cookie
```

`HOST`, `PORT`, and `APP_URL` now have safe defaults, so they are no longer required just to boot the app.
