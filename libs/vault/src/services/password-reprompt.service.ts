import { Injectable, Optional } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { SensitiveActionVerifier } from "@bitwarden/common/vault/abstractions/sensitive-action-verifier";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService } from "@bitwarden/components";

import { PasswordRepromptComponent } from "../components/password-reprompt.component";

/**
 * Used to verify the user's Master Password for the "Master Password Re-prompt" feature only.
 * See UserVerificationService for any other situation where you need to verify the user's identity.
 */
@Injectable()
export class PasswordRepromptService {
  constructor(
    private dialogService: DialogService,
    private userVerificationService: UserVerificationService,
    // Fork patch: only provided by the browser extension.
    @Optional() private sensitiveActionVerifier?: SensitiveActionVerifier,
  ) {}

  /**
   * Fork patch: with a sensitive action verifier every cipher is gated by SES, not just ciphers
   * flagged for master password re-prompt.
   */
  isGateRequired(cipher: CipherViewLike): boolean {
    return this.sensitiveActionVerifier != null || cipher.reprompt !== CipherRepromptType.None;
  }

  enabled$ = Utils.asyncToObservable(() => this.userVerificationService.hasMasterPassword());

  protectedFields() {
    return [
      "TOTP",
      "Password",
      "H_Field",
      "Card Number",
      "Security Code",
      "PIN",
      "Account Number",
      "IBAN",
      "SWIFT",
      "Passport Number",
      "National Identification Number",
      "License Number",
    ];
  }

  async passwordRepromptCheck(cipher: CipherViewLike) {
    if (!this.isGateRequired(cipher)) {
      return true;
    }

    return await this.showPasswordPrompt();
  }

  async showPasswordPrompt() {
    if (this.sensitiveActionVerifier != null) {
      const verified = await this.sensitiveActionVerifier.verify();
      if (verified !== null) {
        return verified;
      }
      // No passkey check available: fall back to the master password, which also opens SES.
      const passed = await this.showMasterPasswordDialog();
      if (passed) {
        await this.sensitiveActionVerifier.enable();
      }
      return passed;
    }

    if (!(await this.enabled())) {
      return true;
    }

    return await this.showMasterPasswordDialog();
  }

  private async showMasterPasswordDialog() {
    const dialog = await this.dialogService.open<boolean>(PasswordRepromptComponent, {
      ariaModal: true,
    });

    const result = await lastValueFrom(dialog.closed);

    return result === true;
  }

  enabled() {
    return firstValueFrom(this.enabled$);
  }
}
