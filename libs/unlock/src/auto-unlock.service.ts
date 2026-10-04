import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

/**
 * The auto unlock service is responsible for the never-lock key
 */
export abstract class AutoUnlockService {
  /**
   * Retrieves the user's never-lock key, if one is stored.
   *
   * @param userId - The user's id
   * @returns The never-lock user key, or null when none is stored
   */
  abstract getAutoUnlockKey(userId: UserId): Promise<UserKey | null>;

  /**
   * Writes or clears the never-lock user key, according to whether the user's vault timeout allows
   * storing it. Called during unlock.
   *
   * @param userId - The user's id
   * @param userKey - The user's decrypted user key
   * @param unlockedWithMasterPassword - Fork patch: true when this unlock was a master password
   * unlock, which restarts the 7 day never-lock window
   */
  abstract setAutoUnlockKey(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    unlockedWithMasterPassword?: boolean,
  ): Promise<void>;

  /**
   * Fork patch: whether the stored never-lock key is older than 7 days since the last master
   * password unlock. Always false when no never-lock key is stored.
   *
   * @param userId - The user's id
   */
  abstract isAutoUnlockExpired(userId: UserId): Promise<boolean>;

  /**
   * Re-evaluates never-lock storage for an already-unlocked user. Call after changing a setting that
   * affects whether the user key may be stored.
   *
   * @param userId - The user's id
   * @throws If the user is locked
   */
  abstract refreshAutoUnlockKey(userId: UserId): Promise<void>;
}
