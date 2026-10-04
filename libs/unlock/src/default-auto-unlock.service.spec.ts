import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import {
  AUTO_UNLOCK_DAYS,
  AUTO_UNLOCK_PASSWORD_AT,
  MS_PER_DAY,
  VAULT_TIMEOUT,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { CsprngArray, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider, StateService } from "@bitwarden/state";

import { DefaultAutoUnlockService } from "./default-auto-unlock.service";

describe("DefaultAutoUnlockService", () => {
  const mockUserId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;
  const mockUserKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

  const keyService = mock<KeyService>();
  const stateService = mock<StateService>();
  const stateProvider = mock<StateProvider>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();

  const userState = new Map<string, unknown>();

  let sut: DefaultAutoUnlockService;

  beforeEach(() => {
    jest.resetAllMocks();

    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);
    userState.clear();
    userState.set(VAULT_TIMEOUT.key, VaultTimeoutStringType.Never);
    userState.set(AUTO_UNLOCK_PASSWORD_AT.key, Date.now());
    stateProvider.getUserState$.mockImplementation((definition) =>
      of(userState.get(definition.key)),
    );
    keyService.userKey$.mockReturnValue(of(mockUserKey));

    sut = new DefaultAutoUnlockService(
      keyService,
      stateService,
      stateProvider,
      platformUtilsService,
      logService,
    );
  });

  describe("setAutoUnlockKey", () => {
    it("stores the key when the vault timeout is never", async () => {
      await sut.setAutoUnlockKey(mockUserId, mockUserKey);

      expect(stateProvider.getUserState$).toHaveBeenCalledWith(VAULT_TIMEOUT, mockUserId);
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.toBase64(), {
        userId: mockUserId,
      });
    });

    it("stores the key on the cli without reading the vault timeout", async () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Cli);
      stateProvider.getUserState$.mockReturnValue(of(60));

      await sut.setAutoUnlockKey(mockUserId, mockUserKey);

      expect(stateProvider.getUserState$).not.toHaveBeenCalledWith(VAULT_TIMEOUT, mockUserId);
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.toBase64(), {
        userId: mockUserId,
      });
    });

    it.each([60, VaultTimeoutStringType.OnRestart, VaultTimeoutStringType.OnLocked])(
      "clears the key when the vault timeout is %s",
      async (timeout) => {
        stateProvider.getUserState$.mockReturnValue(of(timeout));

        await sut.setAutoUnlockKey(mockUserId, mockUserKey);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      },
    );
  });

  describe("getAutoUnlockKey", () => {
    it("returns null when no never-lock key is stored", async () => {
      stateService.getUserKeyAutoUnlock.mockResolvedValue(null);

      const result = await sut.getAutoUnlockKey(mockUserId);

      expect(result).toBeNull();
      expect(stateService.getUserKeyAutoUnlock).toHaveBeenCalledWith({ userId: mockUserId });
      expect(keyService.validateUserKey).not.toHaveBeenCalled();
    });

    it("returns the stored key when it is valid", async () => {
      stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
      keyService.validateUserKey.mockResolvedValue(true);

      const result = await sut.getAutoUnlockKey(mockUserId);

      expect(result).toEqual(mockUserKey);
      expect(keyService.validateUserKey).toHaveBeenCalledWith(mockUserKey, mockUserId);
      expect(keyService.clearAllStoredUserKeys).not.toHaveBeenCalled();
    });

    it("throws away the stored keys and returns null when the stored key fails validation", async () => {
      stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
      keyService.validateUserKey.mockResolvedValue(false);

      const result = await sut.getAutoUnlockKey(mockUserId);

      expect(result).toBeNull();
      expect(logService.warning).toHaveBeenCalledWith("Invalid key, throwing away stored keys");
      expect(keyService.clearAllStoredUserKeys).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe("refreshAutoUnlockKey", () => {
    it("re-stores the in-memory user key", async () => {
      await sut.refreshAutoUnlockKey(mockUserId);

      expect(keyService.userKey$).toHaveBeenCalledWith(mockUserId);
      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.toBase64(), {
        userId: mockUserId,
      });
    });

    it("clears the stored key when the vault timeout no longer allows it", async () => {
      stateProvider.getUserState$.mockReturnValue(of(VaultTimeoutStringType.OnLocked));

      await sut.refreshAutoUnlockKey(mockUserId);

      expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, { userId: mockUserId });
    });

    it.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(sut.refreshAutoUnlockKey(userId)).rejects.toThrow("UserId is required.");

        expect(stateService.setUserKeyAutoUnlock).not.toHaveBeenCalled();
      },
    );

    it("throws when the user is locked", async () => {
      keyService.userKey$.mockReturnValue(of(null));

      await expect(sut.refreshAutoUnlockKey(mockUserId)).rejects.toThrow(
        "No user key found for: " + mockUserId,
      );

      expect(stateService.setUserKeyAutoUnlock).not.toHaveBeenCalled();
    });
  });
  describe("7 day expiry", () => {
    const stampedDaysAgo = (days: number) => Date.now() - days * MS_PER_DAY;

    describe("isAutoUnlockExpired", () => {
      it("is false when no never-lock key is stored", async () => {
        stateService.getUserKeyAutoUnlock.mockResolvedValue(null);
        userState.set(AUTO_UNLOCK_PASSWORD_AT.key, stampedDaysAgo(30));

        expect(await sut.isAutoUnlockExpired(mockUserId)).toBe(false);
      });

      it("fails closed when a key is stored without a timestamp", async () => {
        stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
        userState.set(AUTO_UNLOCK_PASSWORD_AT.key, null);

        expect(await sut.isAutoUnlockExpired(mockUserId)).toBe(true);
      });

      it.each([
        [6.9, 7, false],
        [7, 7, true],
        [8, 7, true],
        [0.9, 1, false],
        [1.1, 1, true],
        [29, 30, false],
        [31, 30, true],
      ])(
        "with a timestamp %s days old and a %s day window expired is %s",
        async (age, days, expected) => {
          stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
          userState.set(AUTO_UNLOCK_PASSWORD_AT.key, stampedDaysAgo(age));
          userState.set(AUTO_UNLOCK_DAYS.key, days);

          expect(await sut.isAutoUnlockExpired(mockUserId)).toBe(expected);
        },
      );

      it("defaults to a 7 day window when none is chosen", async () => {
        stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
        userState.set(AUTO_UNLOCK_DAYS.key, null);

        userState.set(AUTO_UNLOCK_PASSWORD_AT.key, stampedDaysAgo(6));
        expect(await sut.isAutoUnlockExpired(mockUserId)).toBe(false);

        userState.set(AUTO_UNLOCK_PASSWORD_AT.key, stampedDaysAgo(8));
        expect(await sut.isAutoUnlockExpired(mockUserId)).toBe(true);
      });
    });

    describe("getAutoUnlockKey", () => {
      it("throws away the stored keys and the timestamp when expired", async () => {
        stateService.getUserKeyAutoUnlock.mockResolvedValue(mockUserKey.keyB64);
        userState.set(AUTO_UNLOCK_PASSWORD_AT.key, stampedDaysAgo(8));

        const result = await sut.getAutoUnlockKey(mockUserId);

        expect(result).toBeNull();
        expect(keyService.clearAllStoredUserKeys).toHaveBeenCalledWith(mockUserId);
        expect(stateProvider.setUserState).toHaveBeenCalledWith(
          AUTO_UNLOCK_PASSWORD_AT,
          null,
          mockUserId,
        );
        expect(keyService.validateUserKey).not.toHaveBeenCalled();
      });
    });

    describe("setAutoUnlockKey", () => {
      it("restarts the window on a master password unlock", async () => {
        userState.set(AUTO_UNLOCK_PASSWORD_AT.key, stampedDaysAgo(3));

        await sut.setAutoUnlockKey(mockUserId, mockUserKey, true);

        expect(stateProvider.setUserState).toHaveBeenCalledWith(
          AUTO_UNLOCK_PASSWORD_AT,
          expect.any(Number),
          mockUserId,
        );
        const stamp = stateProvider.setUserState.mock.calls.find(
          ([definition]) => definition === AUTO_UNLOCK_PASSWORD_AT,
        )[1] as number;
        expect(Date.now() - stamp).toBeLessThan(5000);
      });

      it("keeps the existing timestamp on other unlocks", async () => {
        userState.set(AUTO_UNLOCK_PASSWORD_AT.key, stampedDaysAgo(3));

        await sut.setAutoUnlockKey(mockUserId, mockUserKey, false);

        expect(stateProvider.setUserState).not.toHaveBeenCalledWith(
          AUTO_UNLOCK_PASSWORD_AT,
          expect.anything(),
          mockUserId,
        );
        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.toBase64(), {
          userId: mockUserId,
        });
      });

      it("starts the window when there is no timestamp yet", async () => {
        userState.set(AUTO_UNLOCK_PASSWORD_AT.key, null);

        await sut.setAutoUnlockKey(mockUserId, mockUserKey, false);

        expect(stateProvider.setUserState).toHaveBeenCalledWith(
          AUTO_UNLOCK_PASSWORD_AT,
          expect.any(Number),
          mockUserId,
        );
      });

      it("clears the timestamp when the key is no longer stored", async () => {
        userState.set(VAULT_TIMEOUT.key, 60);

        await sut.setAutoUnlockKey(mockUserId, mockUserKey, true);

        expect(stateProvider.setUserState).toHaveBeenCalledWith(
          AUTO_UNLOCK_PASSWORD_AT,
          null,
          mockUserId,
        );
      });
    });
  });
});
