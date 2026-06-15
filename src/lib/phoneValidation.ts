export const TUNISIA_PHONE_LENGTH = 8;

/** Keep digits only; strip optional +216 country prefix. */
export function normalizeTunisiaPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("216")) {
    digits = digits.slice(3);
  }
  return digits.slice(0, TUNISIA_PHONE_LENGTH);
}

export function isValidTunisiaPhone(input: string): boolean {
  return /^\d{8}$/.test(normalizeTunisiaPhoneDigits(input));
}

export const TUNISIA_PHONE_ERROR = "Le numéro de téléphone doit contenir exactement 8 chiffres.";
