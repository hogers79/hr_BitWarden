export { VaultTimeoutSettingsService } from "./abstractions/vault-timeout-settings.service";
export { VaultTimeoutSettingsService as DefaultVaultTimeoutSettingsService } from "./services/vault-timeout-settings.service";
export { VaultTimeoutService } from "./abstractions/vault-timeout.service";
export { VaultTimeoutService as DefaultVaultTimeoutService } from "./services/vault-timeout.service";
export { VaultTimeoutAction } from "./enums/vault-timeout-action.enum";
export {
  isVaultTimeoutTypeNumeric,
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "./types/vault-timeout.type";
// Only used by desktop's electron-key.service.spec.ts test
export {
  VAULT_TIMEOUT,
  AUTO_UNLOCK_DAYS,
  AUTO_UNLOCK_DAY_OPTIONS,
  AUTO_UNLOCK_DEFAULT_DAYS,
  MS_PER_DAY,
  SES_ACTIVATED_AT,
  SES_DURATION_MS,
  AUTO_UNLOCK_PASSWORD_AT,
} from "./services/vault-timeout-settings.state";
