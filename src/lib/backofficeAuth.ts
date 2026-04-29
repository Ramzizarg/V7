const encoder = new TextEncoder();

export const BACKOFFICE_SESSION_COOKIE = "vero7_backoffice_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h

function getEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export function getBackofficeCredentials() {
  return {
    email: getEnv("BACKOFFICE_LOGIN_EMAIL", "admin@vero7.local"),
    password: getEnv("BACKOFFICE_LOGIN_PASSWORD", "ChangeMe123!"),
    passwordHash: getEnv("BACKOFFICE_LOGIN_PASSWORD_HASH", ""),
  };
}

function getSessionSecret() {
  return getEnv(
    "BACKOFFICE_SESSION_SECRET",
    "vero7-dev-secret-change-this-in-env"
  );
}

async function hmacHex(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string) {
  if (!hex || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}

function timingSafeEqualString(a: string, b: string) {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

async function pbkdf2Hex(password: string, saltHex: string, iterations: number) {
  const saltBytes = fromHex(saltHex);
  if (!saltBytes || !Number.isFinite(iterations) || iterations < 10_000) {
    return null;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations,
    },
    key,
    256
  );
  return toHex(new Uint8Array(bits));
}

export async function verifyBackofficePassword(candidatePassword: string) {
  const creds = getBackofficeCredentials();
  const storedHash = creds.passwordHash.trim();

  // Preferred mode: PBKDF2 hash from env => pbkdf2$210000$<saltHex>$<hashHex>
  if (storedHash.startsWith("pbkdf2$")) {
    const [, iterRaw, saltHex, expectedHex] = storedHash.split("$");
    const iterations = Number.parseInt(iterRaw ?? "", 10);
    const derivedHex = await pbkdf2Hex(candidatePassword, saltHex ?? "", iterations);
    return !!derivedHex && timingSafeEqualString(derivedHex, expectedHex ?? "");
  }

  // Fallback mode: plain password from env (kept for backward compatibility).
  return timingSafeEqualString(candidatePassword, creds.password);
}

export async function createBackofficeSessionToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = nowSeconds + SESSION_DURATION_SECONDS;
  const nonce = crypto.randomUUID();
  const payload = `${expiresAt}.${nowSeconds}.${nonce}`;
  const signature = await hmacHex(payload, getSessionSecret());
  return `${payload}.${signature}`;
}

export async function verifyBackofficeSessionToken(token?: string | null) {
  if (!token) return false;

  const [expiresAtRaw, issuedAtRaw, nonce, signature] = token.split(".");
  const expiresAt = Number.parseInt(expiresAtRaw ?? "", 10);
  const issuedAt = Number.parseInt(issuedAtRaw ?? "", 10);

  if (
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(issuedAt) ||
    !nonce ||
    !signature
  ) {
    return false;
  }
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;
  if (issuedAt > Math.floor(Date.now() / 1000) + 60) return false;
  if (expiresAt - issuedAt > SESSION_DURATION_SECONDS + 60) return false;

  const payload = `${expiresAtRaw}.${issuedAtRaw}.${nonce}`;
  const expected = await hmacHex(payload, getSessionSecret());
  return timingSafeEqualString(expected, signature);
}
