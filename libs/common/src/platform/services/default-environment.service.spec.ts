import { firstValueFrom } from "rxjs";

import { FakeStateProvider, awaitAsync, mockAccountInfoWith } from "../../../spec";
import { FakeAccountService } from "../../../spec/fake-account-service";
import { UserId } from "../../types/guid";
import { CloudRegion, Region } from "../abstractions/environment.service";

import {
  GLOBAL_ENVIRONMENT_KEY,
  DefaultEnvironmentService,
  EnvironmentUrls,
  USER_ENVIRONMENT_KEY,
} from "./default-environment.service";

// There are a few main states EnvironmentService could be in when first used
// 1. Not initialized, no active user. Hopefully not to likely but possible
// 2. Not initialized, with active user. Not likely
// 3. Initialized, no active user.
// 4. Initialized, with active user.
describe("EnvironmentService", () => {
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  let sut: DefaultEnvironmentService;

  const testUser = "00000000-0000-1000-a000-000000000001" as UserId;
  const alternateTestUser = "00000000-0000-1000-a000-000000000002" as UserId;

  beforeEach(async () => {
    accountService = new FakeAccountService({
      [testUser]: mockAccountInfoWith({
        name: "name",
        email: "email",
      }),
      [alternateTestUser]: mockAccountInfoWith({
        name: "name",
        email: "email",
      }),
    });
    stateProvider = new FakeStateProvider(accountService);

    sut = new DefaultEnvironmentService(stateProvider, accountService);
  });

  const switchUser = async (userId: UserId) => {
    accountService.activeAccountSubject.next({
      id: userId,
      ...mockAccountInfoWith({
        email: "test@example.com",
        name: `Test Name ${userId}`,
      }),
    });
    await awaitAsync();
  };

  const setGlobalData = (region: Region, environmentUrls: EnvironmentUrls) => {
    stateProvider.global.getFake(GLOBAL_ENVIRONMENT_KEY).stateSubject.next({
      region: region,
      urls: environmentUrls,
    });
  };

  const setUserData = (
    region: Region,
    environmentUrls: EnvironmentUrls,
    userId: UserId = testUser,
  ) => {
    stateProvider.singleUser.getFake(userId, USER_ENVIRONMENT_KEY).nextState({
      region: region,
      urls: environmentUrls,
    });
  };

  // Fork patch: bitwarden.com (US) is the only supported server, whatever is stored or requested.
  const US_URLS = {
    webVault: "https://vault.bitwarden.com",
    identity: "https://identity.bitwarden.com",
    api: "https://api.bitwarden.com",
    icons: "https://icons.bitwarden.net",
    notifications: "https://notifications.bitwarden.com",
    events: "https://events.bitwarden.com",
    send: "https://send.bitwarden.com",
  };

  const SELF_HOSTED_URLS: EnvironmentUrls = {
    base: "https://self-hosted.example.com",
    api: "https://self-hosted.example.com/api",
    identity: "https://self-hosted.example.com/identity",
    webVault: "https://self-hosted.example.com",
    icons: "https://self-hosted.example.com/icons",
    notifications: "https://self-hosted.example.com/notifications",
    events: "https://self-hosted.example.com/events",
    keyConnector: "https://self-hosted.example.com/key-connector",
    send: "https://self-hosted.example.com/send",
  };

  const STORED_REGIONS = [
    { region: Region.US, urls: null as EnvironmentUrls },
    { region: Region.EU, urls: null as EnvironmentUrls },
    { region: Region.Gov, urls: null as EnvironmentUrls },
    { region: Region.SelfHosted, urls: SELF_HOSTED_URLS },
    { region: "unknown" as Region, urls: null as EnvironmentUrls },
  ];

  describe("with user", () => {
    beforeEach(async () => {
      await switchUser(testUser);
    });

    it.each(STORED_REGIONS)(
      "resolves a stored user region of $region to the US cloud",
      async ({ region, urls }) => {
        setUserData(region, urls);

        const env = await firstValueFrom(sut.environment$);

        expect(env.getRegion()).toBe(Region.US);
        expect(env.isCloud()).toBe(true);
        expect(env.getUrls()).toEqual(expect.objectContaining(US_URLS));
      },
    );

    it.each(STORED_REGIONS)(
      "resolves a stored global region of $region to the US cloud",
      async ({ region, urls }) => {
        setGlobalData(region, urls);

        const env = await firstValueFrom(sut.getEnvironment$(alternateTestUser));

        expect(env.getRegion()).toBe(Region.US);
        expect(env.getWebVaultUrl()).toBe(US_URLS.webVault);
        expect(env.getApiUrl()).toBe(US_URLS.api);
      },
    );
  });

  describe("without user", () => {
    it("defaults to the US cloud", async () => {
      const env = await firstValueFrom(sut.environment$);

      expect(env.getRegion()).toBe(Region.US);
      expect(env.getUrls()).toEqual(expect.objectContaining(US_URLS));
    });

    it.each(STORED_REGIONS)(
      "resolves stored global data of $region to the US cloud",
      async ({ region, urls }) => {
        setGlobalData(region, urls);

        const env = await firstValueFrom(sut.environment$);

        expect(env.getRegion()).toBe(Region.US);
        expect(env.getIdentityUrl()).toBe(US_URLS.identity);
      },
    );
  });

  describe("setEnvironment", () => {
    it.each([Region.US, Region.EU, Region.Gov])(
      "stores the US region when %s is requested",
      async (region) => {
        const urls = await sut.setEnvironment(region);

        expect(urls).toBeNull();
        const stored = await firstValueFrom(
          stateProvider.global.getFake(GLOBAL_ENVIRONMENT_KEY).state$,
        );
        expect(stored).toEqual({ region: Region.US, urls: null });
      },
    );

    it("ignores self-hosted urls and stores the US region", async () => {
      const urls = await sut.setEnvironment(Region.SelfHosted, SELF_HOSTED_URLS);

      expect(urls).toBeNull();
      const stored = await firstValueFrom(
        stateProvider.global.getFake(GLOBAL_ENVIRONMENT_KEY).state$,
      );
      expect(stored).toEqual({ region: Region.US, urls: null });
    });

    it("keeps the US environment after a self-hosted request", async () => {
      await sut.setEnvironment(Region.SelfHosted, SELF_HOSTED_URLS);

      const env = await firstValueFrom(sut.environment$);

      expect(env.getRegion()).toBe(Region.US);
      expect(env.getWebVaultUrl()).toBe(US_URLS.webVault);
    });
  });

  describe("cloudWebVaultUrl$", () => {
    it("no extra initialization, returns US vault", async () => {
      expect(await firstValueFrom(sut.cloudWebVaultUrl$)).toBe(US_URLS.webVault);
    });

    it.each([
      { region: Region.US, expectedVault: "https://vault.bitwarden.com" },
      { region: Region.EU, expectedVault: "https://vault.bitwarden.eu" },
      { region: Region.SelfHosted, expectedVault: "https://vault.bitwarden.com" },
    ])(
      "no extra initialization, returns expected host for each region %s",
      async ({ region, expectedVault }) => {
        await switchUser(testUser);

        expect(await sut.setCloudRegion(testUser, region as CloudRegion));
        expect(await firstValueFrom(sut.cloudWebVaultUrl$)).toBe(expectedVault);
      },
    );
  });
});
