import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  SES_ACTIVATED_AT,
  SES_DURATION_MS,
} from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SensitiveActionVerifier } from "@bitwarden/common/vault/abstractions/sensitive-action-verifier";
import { WebAuthnPrfUnlockService } from "@bitwarden/key-management-ui";
import { StateProvider } from "@bitwarden/state";

/**
 * Fork patch: runs the Windows Hello passkey check for sensitive actions and tracks SES.
 */
export class BrowserSensitiveActionVerifier implements SensitiveActionVerifier {
  constructor(
    private accountService: AccountService,
    private stateProvider: StateProvider,
    private webAuthnPrfUnlockService: WebAuthnPrfUnlockService,
    private logService: LogService,
  ) {}

  async verify(): Promise<boolean | null> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const activatedAt = await firstValueFrom(
      this.stateProvider.getUserState$(SES_ACTIVATED_AT, userId),
    );
    if (activatedAt != null && Date.now() - activatedAt < SES_DURATION_MS) {
      return true;
    }

    if (!(await this.webAuthnPrfUnlockService.isPrfUnlockAvailable(userId))) {
      return null;
    }

    try {
      await this.webAuthnPrfUnlockService.unlockVaultWithPrf(userId);
    } catch (error) {
      // Cancelled or failed checks refuse the action; nothing is unlocked or leaked.
      this.logService.info("[SensitiveActionVerifier] Passkey check failed or was cancelled", error);
      return false;
    }

    await this.enable();
    return true;
  }

  async enable(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.stateProvider.setUserState(SES_ACTIVATED_AT, Date.now(), userId);
  }
}
