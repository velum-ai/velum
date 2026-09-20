// Redact an account number for logs. The number is the only credential in the
// system, so it must never appear in plaintext in stdout/stderr - keep just the
// last 4 digits for correlation.
export function maskAccount(number) {
  const digits = String(number ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• •••• •••• ${digits.slice(-4)}`;
}
