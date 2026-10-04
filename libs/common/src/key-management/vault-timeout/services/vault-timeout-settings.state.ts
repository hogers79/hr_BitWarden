import {
  UserKeyDefinition,
  VAULT_TIMEOUT_SETTINGS_DISK_LOCAL,
  VAULT_TIMEOUT_SETTINGS_MEMORY,
} from "../../../platform/state";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import { VaultTimeout } from "../types/vault-timeout.type";

/**
 * Settings use disk storage and local storage on web so settings can persist after logout
 * in order for us to know if the user's chose to never lock their vault or not.
 * When the user has never lock selected, we have to set the user key in memory
 * from the user auto unlock key stored on disk on client bootstrap.
 */
export const VAULT_TIMEOUT_ACTION = new UserKeyDefinition<VaultTimeoutAction>(
  VAULT_TIMEOUT_SETTINGS_DISK_LOCAL,
  "vaultTimeoutAction",
  {
    deserializer: (vaultTimeoutAction) => vaultTimeoutAction,
    clearOn: [], // persisted on logout
  },
);

export const VAULT_TIMEOUT = new UserKeyDefinition<VaultTimeout>(
  VAULT_TIMEOUT_SETTINGS_DISK_LOCAL,
  "vaultTimeout",
  {
    deserializer: (vaultTimeout) => vaultTimeout,
    clearOn: [], // persisted on logout
  },
);

/**
 * Fork patch: the never-lock key may only live this long after the last master password unlock.
 */
export const AUTO_UNLOCK_DEFAULT_DAYS = 7;
export const AUTO_UNLOCK_DAY_OPTIONS = [1, 2, 7, 14, 30] as const;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Fork patch: user-chosen number of days the vault stays unlocked (see AUTO_UNLOCK_DAY_OPTIONS).
 */
export const AUTO_UNLOCK_DAYS = new UserKeyDefinition<number | null>(
  VAULT_TIMEOUT_SETTINGS_DISK_LOCAL,
  "autoUnlockDays",
  {
    deserializer: (value) => value,
    clearOn: [], // persisted on logout
  },
);

/**
 * Fork patch: epoch ms of the last master password unlock that (re)armed the never-lock key.
 */
export const AUTO_UNLOCK_PASSWORD_AT = new UserKeyDefinition<number | null>(
  VAULT_TIMEOUT_SETTINGS_DISK_LOCAL,
  "autoUnlockPasswordAt",
  {
    deserializer: (value) => value,
    clearOn: ["logout"],
  },
);

/**
 * Fork patch: Sensitive Enabled State (SES). Epoch ms of the last successful passkey check. SES is
 * open for SES_DURATION_MS after that, and is cleared on lock or logout.
 */
export const SES_DURATION_MS = 60 * 60 * 1000;
export const SES_ACTIVATED_AT = new UserKeyDefinition<number | null>(
  VAULT_TIMEOUT_SETTINGS_MEMORY,
  "sensitiveEnabledStateActivatedAt",
  {
    deserializer: (value) => value,
    clearOn: ["lock", "logout"],
  },
);

export const VAULT_TIMEOUT_SUPPRESSED_UNTIL = new UserKeyDefinition<number | null>(
  VAULT_TIMEOUT_SETTINGS_MEMORY,
  "vaultTimeoutSuppressedUntil",
  {
    deserializer: (value) => value,
    clearOn: ["logout"],
  },
);
