import { createHash } from "crypto";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashMetaEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return sha256(normalized);
}

export function hashMetaPhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `216${digits.slice(1)}`;
  if (!digits.startsWith("216") && digits.length === 8) digits = `216${digits}`;
  return sha256(digits);
}

export function hashMetaName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (!normalized) return null;
  return sha256(normalized);
}

export function hashMetaCity(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (!normalized) return null;
  return sha256(normalized);
}

export function hashMetaState(value: string) {
  return hashMetaCity(value);
}

export function hashMetaCountry(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return sha256(normalized.length === 2 ? normalized : normalized.slice(0, 2));
}

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}
