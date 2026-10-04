# hr_BitWarden: personal fork of the Bitwarden browser extension

A personal fork of [bitwarden/clients](https://github.com/bitwarden/clients) built for one use: the
Microsoft Edge extension, on the bitwarden.com (US) cloud. Only the browser extension is maintained.
The web, desktop and CLI apps are untouched upstream code and are not supported here.

- Upstream baseline: `245879a5e3269da22197d3306a2f8b0355794095`. The first commit on `main` is an
  unmodified snapshot of it, so `git diff 1056bd2 HEAD` shows every fork change.
- Modified builds are loaded unpacked in Edge developer mode. They do not auto-update, and Bitwarden
  does not support them.

## What is different

| Area | Behaviour |
| --- | --- |
| Vault timeout | Always **Never**. The stored value and organization policies are ignored. |
| Stay unlocked for | Replaces the session timeout setting: 1 day, 2 days, **1 week (default)**, 2 weeks or 1 month. The window runs from the last master password unlock, regardless of activity, browser restarts or reboots. The vault locks when it ends. |
| Unlock and login | Master password only. PIN, biometrics, unlock with passkey and log in with passkey are hidden. |
| Sensitive actions | Opening an item, or copying a password, TOTP code or card field, needs a Windows Hello **passkey check** unless SES is open. |
| SES (sensitive enabled state) | Opened by a successful passkey check and lasts 1 hour. Ended by locking, logging out, Edge starting, or the last Edge window closing. A master password login or a restored session does not open it. |
| No passkey | If no passkey is set up, sensitive actions fall back to the master password, which also opens SES. |
| Server | Always bitwarden.com (US). The region and self-hosted selector is removed. |
| Premium upsells | Upgrade badges, dialog, vault banner and settings callout are removed. Premium features stay unavailable on a non-premium account. |
| Settings | New **Sensitive actions passkey** section: status, **Test passkey** and **Add passkey**. |

Fork changes are marked `Fork patch` in the code. Main files:

- `libs/unlock/src/default-auto-unlock.service.ts`: the stay-unlocked expiry.
- `libs/common/src/key-management/vault-timeout/`: forced Never, duration setting, SES state.
- `libs/common/src/vault/abstractions/sensitive-action-verifier.ts` and
  `apps/browser/src/key-management/sensitive-action/`: the passkey check.
- `libs/vault/src/services/password-reprompt.service.ts`: routes sensitive actions to the check.
- `apps/browser/src/background/main.background.ts`: ends SES when Edge closes.

## Passkey setup

The passkey is a Bitwarden "log in with passkey" credential that has encryption enabled, so it
can only be created in the web vault. On a new or replacement PC:

1. Open the extension, then Settings, **Sensitive actions passkey**, **Add passkey**. This opens
   the web vault security settings.
2. Add a passkey under **Log in with passkey** using Windows Hello, and turn on the option to use it
   for vault encryption.
3. Back in the extension, **Test passkey** should pass.

## Build

Needs Node 22 and npm 10. Build outside OneDrive or any synced folder, because `node_modules` is large.

```sh
npm install --ignore-scripts --no-audit --no-fund
cd apps/browser
npm run build:edge
```

- Use `npm install`, not `npm ci`. The upstream lock file does not match npm 10, and
  `npm ci` fails. Do not commit the resulting `package-lock.json` change.
- `--ignore-scripts` avoids native modules that need C++ build tools, for example on Windows on ARM.
  They are not needed for the browser build.
- The extension is written to `apps/browser/build`.

## Load in Edge

1. Zip or copy the contents of `apps/browser/build` so that `manifest.json` is directly inside the folder.
2. Open `edge://extensions`, turn on **Developer mode**, and remove any older copy.
3. Choose **Load unpacked** and pick that folder.
4. Check the version label in `edge://extensions`. The fork build is named `2026.9.3-fork-v7`.

To restart Edge fully, use `edge://restart`. Closing the windows may leave Edge running in the
background. Turn off **Startup boost** and **Continue running background extensions** in Edge
settings if you want closing to quit it.

To test the expiry quickly, temporarily set `MS_PER_DAY` to `60 * 1000` in
`libs/common/src/key-management/vault-timeout/services/vault-timeout-settings.state.ts` and rebuild.
One "day" is then one minute, so 1 week is 7 minutes. Do not commit that change.

## Tests

```sh
cd libs/unlock && npx jest
cd libs/vault && npx jest
cd libs/common && npx jest src/key-management src/platform/services
cd apps/browser && npx jest src/key-management src/auth src/vault src/billing
```

## Updating from upstream

Add `bitwarden/clients` as a remote, merge or rebase a newer tag, and resolve conflicts in the
files above. Re-run the tests, rebuild, and check the sensitive-action prompt and the
stay-unlocked setting in Edge before relying on the build.

## Known gaps

- Autofill and the inline menu are not gated by SES.
- Opening any item is gated, not only password fields.
- Sections other than item view and copy (generator history, Send) are not gated.
- Hidden unlock methods are hidden in the interface only. The code paths still exist.
- Not tested on Firefox, Chrome or Safari builds.
