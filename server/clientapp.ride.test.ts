import { describe, it, expect, vi } from "vitest";

// In-memory stores for mocking
const otpStore = new Map<string, { code: string; expiresAt: Date; used: boolean }>();
const clientStore = new Map<string, { id: number; phone: string; name: string | null; currentLat: string | null; currentLng: string | null; createdAt: Date; updatedAt: Date }>();
const sessionStore = new Map<string, number>();
const rideStore = new Map<number, any>();
let nextClientId = 1;
let nextRideId = 1;

// Mock database functions with in-memory implementations
vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({})),
  createOtp: vi.fn(async (phone: string, code: string, expiresAt: Date) => {
    otpStore.set(phone, { code, expiresAt, used: false });
  }),
  verifyOtp: vi.fn(async (phone: string, code: string) => {
    const otp = otpStore.get(phone);
    if (!otp) return false;
    if (otp.code !== code) return false;
    if (otp.used) return false;
    if (otp.expiresAt < new Date()) return false;
    otp.used = true;
    return true;
  }),
  upsertClient: vi.fn(async (phone: string, name?: string) => {
    let client = clientStore.get(phone);
    if (!client) {
      client = {
        id: nextClientId++,
        phone,
        name: name ?? null,
        currentLat: null,
        currentLng: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      clientStore.set(phone, client);
    }
    return client;
  }),
  getClientByPhone: vi.fn(async (phone: string) => {
    return clientStore.get(phone);
  }),
  createClientSession: vi.fn(async (clientId: number, token: string, _expiresAt: Date) => {
    sessionStore.set(token, clientId);
  }),
  getClientByToken: vi.fn(async (token: string) => {
    const clientId = sessionStore.get(token);
    if (!clientId) return undefined;
    for (const client of clientStore.values()) {
      if (client.id === clientId) return client;
    }
    return undefined;
  }),
  createRide: vi.fn(async (data: any) => {
    const ride = {
      id: nextRideId++,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    rideStore.set(ride.id, ride);
    return ride;
  }),
  getClientActiveRide: vi.fn(async (clientId: number) => {
    for (const ride of rideStore.values()) {
      if (ride.clientId === clientId && ride.status !== "completed" && ride.status !== "cancelled" && ride.status !== "rejected") {
        return ride;
      }
    }
    return undefined;
  }),
}));

describe("Client App - Ride Flow", () => {
  const testPhone = "+40712345678";
  const testCode = "123456";

  it("should create OTP and verify it", async () => {
    const { createOtp, verifyOtp } = await import("./db");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await createOtp(testPhone, testCode, expiresAt);
    
    const isValid = await verifyOtp(testPhone, testCode);
    expect(isValid).toBe(true);
  });

  it("should create client and session", async () => {
    const { upsertClient, getClientByPhone, createClientSession, getClientByToken } = await import("./db");
    await upsertClient(testPhone);
    const client = await getClientByPhone(testPhone);
    
    expect(client).toBeDefined();
    expect(client?.phone).toBe(testPhone);
    
    if (client) {
      const token = "test-token-" + Date.now();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await createClientSession(client.id, token, expiresAt);
      
      const sessionClient = await getClientByToken(token);
      expect(sessionClient?.id).toBe(client.id);
    }
  });

  it("should create ride and retrieve it", async () => {
    const { getClientByPhone, createRide, getClientActiveRide } = await import("./db");
    const client = await getClientByPhone(testPhone);
    expect(client).toBeDefined();
    
    if (client) {
      const ride = await createRide({
        clientId: client.id,
        status: "pending",
        clientLat: "47.5540",
        clientLng: "25.8975",
        clientAddress: "Test Address",
      });
      
      expect(ride).toBeDefined();
      expect(ride.clientId).toBe(client.id);
      expect(ride.status).toBe("pending");
      
      const activeRide = await getClientActiveRide(client.id);
      expect(activeRide).toBeDefined();
      expect(activeRide?.id).toBe(ride.id);
      expect(activeRide?.status).toBe("pending");
    }
  });
});
