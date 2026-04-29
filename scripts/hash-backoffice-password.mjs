/**
 * Usage: npm run hash:backoffice-password -- "your-password"
 * Paste the printed line into backoffice_users.password_hash in Neon.
 */
import crypto from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash:backoffice-password -- "your-password"');
  process.exit(1);
}

const iterations = 210_000;
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
const line = `pbkdf2$${iterations}$${salt.toString("hex")}$${hash.toString("hex")}`;
console.log(line);
