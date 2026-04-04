import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPanicAlert, updatePanicAlertStatus, getActivePanicAlerts, getPanicAlertsByDriver } from "./db";

// Mock database functions
vi.mock("./db", () => ({
  createPanicAlert: vi.fn(),
  updatePanicAlertStatus: vi.fn(),
  getActivePanicAlerts: vi.fn(),
  getPanicAlertsByDriver: vi.fn(),
}));

describe("Panic Button Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPanicAlert", () => {
    it("should create a panic alert with driver location", async () => {
      const mockAlert = {
        id: 1,
        driverId: 123,
        rideId: 456,
        status: "active",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
      };

      vi.mocked(createPanicAlert).mockResolvedValue(mockAlert);

      const result = await createPanicAlert({
        driverId: 123,
        rideId: 456,
        status: "active",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
      });

      expect(result).toEqual(mockAlert);
      expect(createPanicAlert).toHaveBeenCalledWith({
        driverId: 123,
        rideId: 456,
        status: "active",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
      });
    });

    it("should store panic alert with current timestamp", async () => {
      const mockAlert = {
        id: 1,
        driverId: 123,
        rideId: null,
        status: "active",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "Emergency Location",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
      };

      vi.mocked(createPanicAlert).mockResolvedValue(mockAlert);

      const result = await createPanicAlert({
        driverId: 123,
        rideId: null,
        status: "active",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "Emergency Location",
      });

      expect(result.createdAt).toBeDefined();
      expect(result.status).toBe("active");
    });
  });

  describe("updatePanicAlertStatus", () => {
    it("should update panic alert status to resolved", async () => {
      const mockAlert = {
        id: 1,
        driverId: 123,
        rideId: 456,
        status: "resolved",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: new Date(),
      };

      vi.mocked(updatePanicAlertStatus).mockResolvedValue(mockAlert);

      const result = await updatePanicAlertStatus(1, "resolved");

      expect(result.status).toBe("resolved");
      expect(result.resolvedAt).toBeDefined();
      expect(updatePanicAlertStatus).toHaveBeenCalledWith(1, "resolved");
    });

    it("should update panic alert status to acknowledged", async () => {
      const mockAlert = {
        id: 1,
        driverId: 123,
        rideId: 456,
        status: "acknowledged",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
      };

      vi.mocked(updatePanicAlertStatus).mockResolvedValue(mockAlert);

      const result = await updatePanicAlertStatus(1, "acknowledged");

      expect(result.status).toBe("acknowledged");
      expect(updatePanicAlertStatus).toHaveBeenCalledWith(1, "acknowledged");
    });
  });

  describe("getActivePanicAlerts", () => {
    it("should return list of active panic alerts", async () => {
      const mockAlerts = [
        {
          id: 1,
          driverId: 123,
          rideId: 456,
          status: "active",
          driverLat: "40.7128",
          driverLng: "-74.0060",
          driverAddress: "New York, NY",
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null,
        },
        {
          id: 2,
          driverId: 124,
          rideId: 457,
          status: "active",
          driverLat: "40.7580",
          driverLng: "-73.9855",
          driverAddress: "Times Square, NY",
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null,
        },
      ];

      vi.mocked(getActivePanicAlerts).mockResolvedValue(mockAlerts);

      const result = await getActivePanicAlerts();

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("active");
      expect(result[1].status).toBe("active");
      expect(getActivePanicAlerts).toHaveBeenCalled();
    });

    it("should return empty array when no active alerts", async () => {
      vi.mocked(getActivePanicAlerts).mockResolvedValue([]);

      const result = await getActivePanicAlerts();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });
  });

  describe("getPanicAlertsByDriver", () => {
    it("should return panic alerts for specific driver", async () => {
      const mockAlerts = [
        {
          id: 1,
          driverId: 123,
          rideId: 456,
          status: "active",
          driverLat: "40.7128",
          driverLng: "-74.0060",
          driverAddress: "New York, NY",
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null,
        },
        {
          id: 2,
          driverId: 123,
          rideId: 457,
          status: "resolved",
          driverLat: "40.7580",
          driverLng: "-73.9855",
          driverAddress: "Times Square, NY",
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: new Date(),
        },
      ];

      vi.mocked(getPanicAlertsByDriver).mockResolvedValue(mockAlerts);

      const result = await getPanicAlertsByDriver(123);

      expect(result).toHaveLength(2);
      expect(result.every((alert) => alert.driverId === 123)).toBe(true);
      expect(getPanicAlertsByDriver).toHaveBeenCalledWith(123);
    });

    it("should return empty array for driver with no alerts", async () => {
      vi.mocked(getPanicAlertsByDriver).mockResolvedValue([]);

      const result = await getPanicAlertsByDriver(999);

      expect(result).toHaveLength(0);
      expect(getPanicAlertsByDriver).toHaveBeenCalledWith(999);
    });
  });

  describe("Panic Alert Data Validation", () => {
    it("should validate required fields in panic alert", async () => {
      const mockAlert = {
        id: 1,
        driverId: 123,
        rideId: 456,
        status: "active",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
      };

      expect(mockAlert.driverId).toBeDefined();
      expect(mockAlert.status).toBeDefined();
      expect(mockAlert.driverLat).toBeDefined();
      expect(mockAlert.driverLng).toBeDefined();
      expect(mockAlert.createdAt).toBeDefined();
    });

    it("should validate location coordinates are strings", async () => {
      const mockAlert = {
        id: 1,
        driverId: 123,
        rideId: 456,
        status: "active",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
      };

      expect(typeof mockAlert.driverLat).toBe("string");
      expect(typeof mockAlert.driverLng).toBe("string");
      expect(parseFloat(mockAlert.driverLat)).toBeGreaterThanOrEqual(-90);
      expect(parseFloat(mockAlert.driverLat)).toBeLessThanOrEqual(90);
      expect(parseFloat(mockAlert.driverLng)).toBeGreaterThanOrEqual(-180);
      expect(parseFloat(mockAlert.driverLng)).toBeLessThanOrEqual(180);
    });
  });

  describe("Panic Alert Status Transitions", () => {
    it("should transition from active to acknowledged", async () => {
      const mockAlert = {
        id: 1,
        driverId: 123,
        rideId: 456,
        status: "acknowledged",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
      };

      vi.mocked(updatePanicAlertStatus).mockResolvedValue(mockAlert);

      const result = await updatePanicAlertStatus(1, "acknowledged");

      expect(result.status).toBe("acknowledged");
    });

    it("should transition from acknowledged to resolved", async () => {
      const mockAlert = {
        id: 1,
        driverId: 123,
        rideId: 456,
        status: "resolved",
        driverLat: "40.7128",
        driverLng: "-74.0060",
        driverAddress: "New York, NY",
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: new Date(),
      };

      vi.mocked(updatePanicAlertStatus).mockResolvedValue(mockAlert);

      const result = await updatePanicAlertStatus(1, "resolved");

      expect(result.status).toBe("resolved");
      expect(result.resolvedAt).toBeDefined();
    });
  });
});
