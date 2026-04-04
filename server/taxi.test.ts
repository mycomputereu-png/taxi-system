import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB functions
vi.mock("./db", () => ({
  getDriverByUsername: vi.fn(),
  createDriverSession: vi.fn(),
  updateDriverStatus: vi.fn(),
  getDriverByToken: vi.fn(),
  deleteDriverSession: vi.fn(),
  getClientByToken: vi.fn(),
  createOtp: vi.fn(),
  verifyOtp: vi.fn(),
  upsertClient: vi.fn(),
  createClientSession: vi.fn(),
  deleteClientSession: vi.fn(),
  getClientActiveRide: vi.fn(),
  createRide: vi.fn(),
  getRideById: vi.fn(),
  updateRideStatus: vi.fn(),
  getAllDrivers: vi.fn(),
  getAvailableDrivers: vi.fn(),
  getActiveRides: vi.fn(),
  getPendingRides: vi.fn(),
  getRideHistory: vi.fn(),
  assignRide: vi.fn(),
  deleteDriver: vi.fn(),
  createDriver: vi.fn(),
  getDriverById: vi.fn(),
  getDriverActiveRide: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getClientProfile: vi.fn(),
  getAllClientsWithRatings: vi.fn(),
  submitClientRating: vi.fn(),
}));

vi.mock("./socket", () => ({
  emitToDispatchers: vi.fn(),
  emitToDriver: vi.fn(),
  emitToClient: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("mock_token_64chars_long_enough_for_testing_purposes_1234567890"),
}));

function createMockContext(user?: TrpcContext["user"]): TrpcContext {
  return {
    user: user ?? null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createMockContext({ id: 1, openId: "test", name: "Test", email: null, loginMethod: null, role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("driver.login", () => {
  it("returns error for non-existent driver", async () => {
    const { getDriverByUsername } = await import("./db");
    vi.mocked(getDriverByUsername).mockResolvedValue(undefined);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.driver.login({ username: "nonexistent", password: "pass" })
    ).rejects.toThrow("Invalid credentials");
  });

  it("returns token for valid credentials", async () => {
    const { getDriverByUsername, createDriverSession, updateDriverStatus } = await import("./db");
    vi.mocked(getDriverByUsername).mockResolvedValue({
      id: 1,
      username: "driver1",
      passwordHash: "hashed",
      name: "Test Driver",
      phone: null,
      status: "offline",
      currentLat: null,
      currentLng: null,
      lastLocationUpdate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(createDriverSession).mockResolvedValue(undefined);
    vi.mocked(updateDriverStatus).mockResolvedValue(undefined);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.driver.login({ username: "driver1", password: "password123" });

    expect(result.token).toBeDefined();
    expect(result.driver.username).toBe("driver1");
    expect(result.driver).not.toHaveProperty("passwordHash");
  });
});

describe("clientApp.sendOtp", () => {
  it("generates and returns OTP code", async () => {
    const { createOtp } = await import("./db");
    vi.mocked(createOtp).mockResolvedValue(undefined);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clientApp.sendOtp({ phone: "+40712345678" });

    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^\d{6}$/);
  });
});

describe("dispatcher.addDriver", () => {
  it("requires authentication", async () => {
    const ctx = createMockContext(); // no user
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.dispatcher.addDriver({
        username: "newdriver",
        password: "password123",
        name: "New Driver",
      })
    ).rejects.toThrow();
  });

  it("creates driver when authenticated", async () => {
    const { getDriverByUsername, createDriver } = await import("./db");
    vi.mocked(getDriverByUsername).mockResolvedValue(undefined);
    vi.mocked(createDriver).mockResolvedValue(undefined);

    const ctx = createMockContext({
      id: 1, openId: "admin", name: "Admin", email: null, loginMethod: null,
      role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dispatcher.addDriver({
      username: "newdriver",
      password: "password123",
      name: "New Driver",
    });

    expect(result.success).toBe(true);
  });
});

describe("dispatcher.getClientProfile", () => {
  it("requires authentication", async () => {
    const ctx = createMockContext(); // no user
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.dispatcher.getClientProfile({ clientId: 1 })
    ).rejects.toThrow();
  });

  it("returns client profile with rides and ratings", async () => {
    const { getClientProfile } = await import("./db");
    vi.mocked(getClientProfile).mockResolvedValue({
      client: {
        id: 1,
        phone: "+40712345678",
        name: "Test Client",
        currentLat: null,
        currentLng: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      rides: [
        {
          ride: {
            id: 1,
            clientId: 1,
            driverId: 1,
            status: "completed",
            clientLat: null,
            clientLng: null,
            clientAddress: "Test Address",
            destinationLat: null,
            destinationLng: null,
            destinationAddress: null,
            estimatedArrival: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            acceptedAt: null,
            completedAt: new Date(),
          },
          driver: {
            id: 1,
            username: "driver1",
            passwordHash: "hash",
            name: "Test Driver",
            phone: null,
            status: "available",
            currentLat: null,
            currentLng: null,
            lastLocationUpdate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      ratingsReceived: [
        {
          rating: {
            id: 1,
            clientId: 1,
            driverId: 1,
            rideId: 1,
            rating: 5,
            comment: "Great client",
            createdAt: new Date(),
          },
          driver: {
            id: 1,
            username: "driver1",
            passwordHash: "hash",
            name: "Test Driver",
            phone: null,
            status: "available",
            currentLat: null,
            currentLng: null,
            lastLocationUpdate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      avgRating: 5,
      totalRatings: 1,
      completedRides: 1,
    });

    const ctx = createMockContext({
      id: 1, openId: "admin", name: "Admin", email: null, loginMethod: null,
      role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dispatcher.getClientProfile({ clientId: 1 });

    expect(result.client.phone).toBe("+40712345678");
    expect(result.avgRating).toBe(5);
    expect(result.totalRatings).toBe(1);
    expect(result.completedRides).toBe(1);
    expect(result.rides.length).toBe(1);
    expect(result.ratingsReceived.length).toBe(1);
  });
});
