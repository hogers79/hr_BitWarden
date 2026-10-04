/**
 * Fork patch: gate for "sensitive actions" (viewing or copying passwords and similar fields).
 * A successful check opens the Sensitive Enabled State (SES) for an hour.
 */
export abstract class SensitiveActionVerifier {
  /**
   * Runs the passkey check unless SES is already open (or always, when forceCheck is true).
   * @returns true when allowed, false when refused or cancelled, null when no passkey check is
   * available and the caller should fall back to the master password.
   */
  abstract verify(forceCheck?: boolean): Promise<boolean | null>;

  /** Whether a passkey check is available on this machine. */
  abstract isPasskeyAvailable(): Promise<boolean>;

  /** Opens SES, used after a fallback verification succeeds. */
  abstract enable(): Promise<void>;
}
