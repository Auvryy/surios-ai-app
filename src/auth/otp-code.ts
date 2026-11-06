/** Normalize email OTP text before validating or sending it to the server. */
export function normalizeOtpCode(value: string) {
  return value.normalize('NFKC').replace(/[^0-9]/g, '').slice(0, 6);
}
