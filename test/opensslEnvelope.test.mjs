import assert from "node:assert/strict";
import test from "node:test";
import {
  OPENSSL_SETTINGS,
  decryptOpenSslBase64,
  encryptOpenSslBase64,
  extractEnvelopeInput,
} from "../lib/opensslEnvelope.js";

test("encryptOpenSslBase64 roundtrips with decryptOpenSslBase64", async () => {
  const plaintext = "The archive keeps a cleaner copy of the signal.";
  const password = "suntraz-passphrase";
  const encoded = await encryptOpenSslBase64(plaintext, password);
  const decoded = await decryptOpenSslBase64(encoded, password);

  assert.equal(decoded, plaintext);
});

test("encryptOpenSslBase64 stays stable for a deterministic salt", async () => {
  const encoded = await encryptOpenSslBase64("Follow the geometry of the witness field.", "orbital-noise", {
    saltBytes: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
  });

  assert.equal(
    encoded,
    "U2FsdGVkX18AAQIDBAUGB8gsPE5H3op01tmGwel9E0Cn9GiTQBza1AW0lWa7cadbwJXKRnUIE1CzVwctHbeAug==",
  );
});

test("decryptOpenSslBase64 can read a deterministic fixture", async () => {
  const decoded = await decryptOpenSslBase64(
    "U2FsdGVkX18JCAcGBQQDAjn8rw+MQrsAvwgeO1SGvDq5rRRib1lm6X1JWomvzbcH8A88kebf2Ow2xtY4rJfZMA==",
    "field-notes",
  );

  assert.equal(decoded, "A path appears only when the archive allows it.");
});

test("extractEnvelopeInput can read the enc payload from a JSON envelope", () => {
  const extracted = extractEnvelopeInput(
    JSON.stringify({
      alg: OPENSSL_SETTINGS.alg,
      tool: OPENSSL_SETTINGS.tool,
      enc: "U2FsdGVkX1+archive",
      meta: "We had to encrypt the testimonies.",
    }),
  );

  assert.deepEqual(extracted, {
    encoded: "U2FsdGVkX1+archive",
    meta: "We had to encrypt the testimonies.",
  });
});
