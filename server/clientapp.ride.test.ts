import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { createOtp, verifyOtp, upsertClient, getClientByPhone, createClientSession, createRide, getClientActiveRide } from "./db";

describe("Client App - Ride Flow", () => {
  const testPhone = "+40712345678";
  const testCode = "123456";

  beforeAll(async () => {
    // Initialize database
    await getDb();
  });

  it("should create OTP and verify it", async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await createOtp(testPhone, testCode, expiresAt);
    
    const isValid = await verifyOtp(testPhone, testCode);
    expect(isValid).toBe(true);
  });

  it("should create client and session", async () => {
    await upsertClient(testPhone);
    const client = await getClientByPhone(testPhone);
    
    expect(client).toBeDefined();
    expect(client?.phone).toBe(testPhone);
    
    if (client) {
      const token = "test-token-" + Date.now();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await createClientSession(client.id, token, expiresAt);
      
      // Verify session was created
      const { getClientByToken } = await import("./db");
      const sessionClient = await getClientByToken(token);
      expect(sessionClient?.id).toBe(client.id);
    }
  });

  it("should create ride and retrieve it", async () => {
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
      
      // Retrieve active ride
      const activeRide = await getClientActiveRide(client.id);
      expect(activeRide).toBeDefined();
      expect(activeRide?.id).toBe(ride.id);
      expect(activeRide?.status).toBe("pending");
    }
  });
});
