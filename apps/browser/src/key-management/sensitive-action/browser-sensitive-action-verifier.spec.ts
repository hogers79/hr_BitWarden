import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SES_ACTIVATED_AT, SES_DURATION_MS } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { WebAuthnPrfUnlockService } from "@bitwarden/key-management-ui";
import { StateProvider } from "@bitwarden/state";

import { BrowserSensitiveActionVerifier } from "./browser-sensitive-action-verifier";

describe("BrowserSensitiveActionVerifier", () => {
  const userId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
  const now = 1_700_000_000_000;

  let accountService: MockProxy<AccountService>;
  let stateProvider: MockProxy<StateProvider>;
  let prfService: MockProxy<WebAuthnPrfUnlockService>;
  let logService: MockProxy<LogService>;
  let sut: BrowserSensitiveActionVerifier;

  const setSesActivatedAt = (value: number | null) =>
    stateProvider.getUserState$.mockReturnValue(of(value));

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(now);

    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as never);
    stateProvider = mock<StateProvider>();
    prfService = mock<WebAuthnPrfUnlockService>();
    logService = mock<LogService>();
    setSesActivatedAt(null);
    prfService.isPrfUnlockAvailable.mockResolvedValue(true);
    prfService.unlockVaultWithPrf.mockResolvedValue({} as UserKey);

    sut = new BrowserSensitiveActionVerifier(accountService, stateProvider, prfService, logService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("verify", () => {
    it("allows the action without a passkey check while SES is open", async () => {
      setSesActivatedAt(now - SES_DURATION_MS + 1000);

      expect(await sut.verify()).toBe(true);
      expect(prfService.unlockVaultWithPrf).not.toHaveBeenCalled();
    });

    it("runs the passkey check once SES has lapsed", async () => {
      setSesActivatedAt(now - SES_DURATION_MS);

      expect(await sut.verify()).toBe(true);
      expect(prfService.unlockVaultWithPrf).toHaveBeenCalledWith(userId);
    });

    it("runs the passkey check when SES was never opened", async () => {
      expect(await sut.verify()).toBe(true);
      expect(prfService.unlockVaultWithPrf).toHaveBeenCalledWith(userId);
    });

    it("runs the passkey check while SES is open when forced", async () => {
      setSesActivatedAt(now - 1000);

      expect(await sut.verify(true)).toBe(true);
      expect(prfService.unlockVaultWithPrf).toHaveBeenCalled();
    });

    it("opens SES after a successful passkey check", async () => {
      await sut.verify();

      expect(stateProvider.setUserState).toHaveBeenCalledWith(SES_ACTIVATED_AT, now, userId);
    });

    it("returns null so the caller can fall back when no passkey is available", async () => {
      prfService.isPrfUnlockAvailable.mockResolvedValue(false);

      expect(await sut.verify()).toBeNull();
      expect(prfService.unlockVaultWithPrf).not.toHaveBeenCalled();
      expect(stateProvider.setUserState).not.toHaveBeenCalled();
    });

    it.each([new Error("canceled"), new Error("No PRF credentials")])(
      "refuses the action and does not open SES when the passkey check throws %s",
      async (error) => {
        prfService.unlockVaultWithPrf.mockRejectedValue(error);

        expect(await sut.verify()).toBe(false);
        expect(stateProvider.setUserState).not.toHaveBeenCalled();
      },
    );
  });

  describe("enable", () => {
    it("opens SES for the active user", async () => {
      await sut.enable();

      expect(stateProvider.setUserState).toHaveBeenCalledWith(SES_ACTIVATED_AT, now, userId);
    });
  });

  describe("isPasskeyAvailable", () => {
    it.each([true, false])("reports availability %s for the active user", async (available) => {
      prfService.isPrfUnlockAvailable.mockResolvedValue(available);

      expect(await sut.isPasskeyAvailable()).toBe(available);
      expect(prfService.isPrfUnlockAvailable).toHaveBeenCalledWith(userId);
    });
  });
});
