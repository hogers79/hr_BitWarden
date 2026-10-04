import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { SensitiveActionVerifier } from "@bitwarden/common/vault/abstractions/sensitive-action-verifier";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService } from "@bitwarden/components";

import { PasswordRepromptService } from "./password-reprompt.service";

describe("PasswordRepromptService", () => {
  let passwordRepromptService: PasswordRepromptService;

  let userVerificationService: MockProxy<UserVerificationService>;
  let dialogService: MockProxy<DialogService>;

  beforeEach(() => {
    dialogService = mock<DialogService>();
    userVerificationService = mock<UserVerificationService>();

    passwordRepromptService = new PasswordRepromptService(dialogService, userVerificationService);
  });

  describe("enabled()", () => {
    it("returns false if a user does not have a master password", async () => {
      userVerificationService.hasMasterPassword.mockResolvedValue(false);

      expect(await passwordRepromptService.enabled()).toBe(false);
    });
    it("returns true if the user has a master password", async () => {
      userVerificationService.hasMasterPassword.mockResolvedValue(true);

      expect(await passwordRepromptService.enabled()).toBe(true);
    });
  });
  describe("fork sensitive action gate", () => {
    let verifier: MockProxy<SensitiveActionVerifier>;
    let sut: PasswordRepromptService;

    const cipher = (reprompt: CipherRepromptType) => ({ reprompt }) as CipherViewLike;
    const masterPasswordDialog = (result: boolean) =>
      dialogService.open.mockReturnValue({ closed: of(result) } as never);

    beforeEach(() => {
      verifier = mock<SensitiveActionVerifier>();
      sut = new PasswordRepromptService(dialogService, userVerificationService, verifier);
    });

    describe("isGateRequired", () => {
      it.each([CipherRepromptType.None, CipherRepromptType.Password])(
        "is true for every cipher when a verifier is provided (reprompt %s)",
        (reprompt) => {
          expect(sut.isGateRequired(cipher(reprompt))).toBe(true);
        },
      );

      it("follows the cipher flag without a verifier", () => {
        expect(passwordRepromptService.isGateRequired(cipher(CipherRepromptType.None))).toBe(false);
        expect(passwordRepromptService.isGateRequired(cipher(CipherRepromptType.Password))).toBe(
          true,
        );
      });
    });

    describe("passwordRepromptCheck", () => {
      it("runs the passkey check for a cipher without a reprompt flag", async () => {
        verifier.verify.mockResolvedValue(true);

        expect(await sut.passwordRepromptCheck(cipher(CipherRepromptType.None))).toBe(true);
        expect(verifier.verify).toHaveBeenCalled();
      });

      it("skips the check for a cipher without a reprompt flag when there is no verifier", async () => {
        expect(
          await passwordRepromptService.passwordRepromptCheck(cipher(CipherRepromptType.None)),
        ).toBe(true);
        expect(dialogService.open).not.toHaveBeenCalled();
      });
    });

    describe("showPasswordPrompt", () => {
      it("allows the action when the passkey check passes", async () => {
        verifier.verify.mockResolvedValue(true);

        expect(await sut.showPasswordPrompt()).toBe(true);
        expect(dialogService.open).not.toHaveBeenCalled();
        expect(verifier.enable).not.toHaveBeenCalled();
      });

      it("refuses the action when the passkey check fails or is cancelled", async () => {
        verifier.verify.mockResolvedValue(false);

        expect(await sut.showPasswordPrompt()).toBe(false);
        expect(dialogService.open).not.toHaveBeenCalled();
      });

      it("falls back to the master password when no passkey is available", async () => {
        verifier.verify.mockResolvedValue(null);
        userVerificationService.hasMasterPassword.mockResolvedValue(true);
        masterPasswordDialog(true);

        expect(await sut.showPasswordPrompt()).toBe(true);
        expect(dialogService.open).toHaveBeenCalled();
        expect(verifier.enable).toHaveBeenCalled();
      });

      it("does not open SES when the master password fallback is refused", async () => {
        verifier.verify.mockResolvedValue(null);
        userVerificationService.hasMasterPassword.mockResolvedValue(true);
        masterPasswordDialog(false);

        expect(await sut.showPasswordPrompt()).toBe(false);
        expect(verifier.enable).not.toHaveBeenCalled();
      });
    });
  });
});
