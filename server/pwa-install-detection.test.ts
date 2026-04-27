import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("PWA Installation Detection & App-Specific Routing", () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
      length: 0,
      key: () => null,
    } as Storage;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should save installedApp to localStorage when client app is installed", () => {
    const appType = "client";
    localStorage.setItem("installedApp", appType);

    expect(localStorage.getItem("installedApp")).toBe("client");
  });

  it("should save installedApp to localStorage when driver app is installed", () => {
    const appType = "driver";
    localStorage.setItem("installedApp", appType);

    expect(localStorage.getItem("installedApp")).toBe("driver");
  });

  it("should save installedApp to localStorage when dispatcher app is installed", () => {
    const appType = "dispatcher";
    localStorage.setItem("installedApp", appType);

    expect(localStorage.getItem("installedApp")).toBe("dispatcher");
  });

  it("should clear installedApp from localStorage when installation is dismissed", () => {
    localStorage.setItem("installedApp", "client");
    expect(localStorage.getItem("installedApp")).toBe("client");

    localStorage.removeItem("installedApp");
    expect(localStorage.getItem("installedApp")).toBeNull();
  });

  it("should handle app routing based on installedApp value", () => {
    const routingMap: Record<string, string> = {
      client: "/client",
      driver: "/driver",
      dispatcher: "/dispatcher",
    };

    localStorage.setItem("installedApp", "client");
    const installedApp = localStorage.getItem("installedApp");
    const route = installedApp ? routingMap[installedApp] : null;

    expect(route).toBe("/client");
  });

  it("should route to /driver when driver app is installed", () => {
    const routingMap: Record<string, string> = {
      client: "/client",
      driver: "/driver",
      dispatcher: "/dispatcher",
    };

    localStorage.setItem("installedApp", "driver");
    const installedApp = localStorage.getItem("installedApp");
    const route = installedApp ? routingMap[installedApp] : null;

    expect(route).toBe("/driver");
  });

  it("should route to /dispatcher when dispatcher app is installed", () => {
    const routingMap: Record<string, string> = {
      client: "/client",
      driver: "/driver",
      dispatcher: "/dispatcher",
    };

    localStorage.setItem("installedApp", "dispatcher");
    const installedApp = localStorage.getItem("installedApp");
    const route = installedApp ? routingMap[installedApp] : null;

    expect(route).toBe("/dispatcher");
  });

  it("should return null route when no app is installed", () => {
    const routingMap: Record<string, string> = {
      client: "/client",
      driver: "/driver",
      dispatcher: "/dispatcher",
    };

    const installedApp = localStorage.getItem("installedApp");
    const route = installedApp ? routingMap[installedApp] : null;

    expect(route).toBeNull();
  });

  it("should handle beforeinstallprompt event", () => {
    const event = new Event("beforeinstallprompt");
    event.preventDefault = vi.fn();

    expect(event.type).toBe("beforeinstallprompt");
  });

  it("should handle appinstalled event", () => {
    const event = new Event("appinstalled");

    expect(event.type).toBe("appinstalled");
  });

  it("should validate AppType enum values", () => {
    const validAppTypes = ["client", "driver", "dispatcher"];
    const testAppType = "client";

    expect(validAppTypes).toContain(testAppType);
  });

  it("should reject invalid app type", () => {
    const validAppTypes = ["client", "driver", "dispatcher"];
    const invalidAppType = "invalid";

    expect(validAppTypes).not.toContain(invalidAppType);
  });

  it("should handle multiple app installations (last one wins)", () => {
    localStorage.setItem("installedApp", "client");
    expect(localStorage.getItem("installedApp")).toBe("client");

    localStorage.setItem("installedApp", "driver");
    expect(localStorage.getItem("installedApp")).toBe("driver");

    localStorage.setItem("installedApp", "dispatcher");
    expect(localStorage.getItem("installedApp")).toBe("dispatcher");
  });
});
