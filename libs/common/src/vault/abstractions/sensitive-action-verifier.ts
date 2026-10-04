/**
 * Fork patch: gate for "sensitive actions" (viewing or copying passwords and similar fields).
 * A successful check opens the Sensitive Enabled State (SES) for an hour.
 */
export abstract class SensitiveActionVerifier {
  /**
   * Runs the passkey check unless SES is already open.
   * @returns true when allowed, false when refused or cancelled, null when no passkey check is
   * available and the caller should fall back to the master password.
   */
  abstract verify(): Promise<boolean | null>;

  /** Opens SES, used after a fallback verification succeeds. */
  abstract enable(): Promise<void>;
}
