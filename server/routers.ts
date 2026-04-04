import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  assignRide,
  createDriver,
  createDriverSession,
  createOtp,
  createRide,
  deleteDriver,
  deleteDriverSession,
  deleteClientSession,
  createClientSession,
  getActiveRides,
  getAllDrivers,
  getAvailableDrivers,
  getClientActiveRide,
  getClientByPhone,
  getClientByToken,
  getDriverActiveRide,
  getDriverById,
  getDriverByToken,
  getDriverByUsername,
  getPendingRides,
  getRideById,
  getRideHistory,
  updateDriverStatus,
  updateRideStatus,
  upsertClient,
  upsertUser,
  getUserByOpenId,
  submitClientRating,
  getAllClientsWithRatings,
  getClientProfile,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { emitToClient, emitToDispatchers, emitToDriver } from "./socket";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function generateToken() {
  return nanoid(64);
}

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  // ─── Manus OAuth (Dispatcher) ───────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Driver Auth ────────────────────────────────────────────────────────────
  driver: router({
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByUsername(input.username);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        const valid = await bcrypt.compare(input.password, driver.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await createDriverSession(driver.id, token, expiresAt);
        await updateDriverStatus(driver.id, "available");
        const { passwordHash: _, ...safeDriver } = driver;
        return { token, driver: safeDriver };
      }),

    logout: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (driver) await updateDriverStatus(driver.id, "offline");
        await deleteDriverSession(input.token);
        return { success: true };
      }),

    me: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        const { passwordHash: _, ...safeDriver } = driver;
        return safeDriver;
      }),

    updateStatus: publicProcedure
      .input(z.object({ token: z.string(), status: z.enum(["available", "busy", "offline"]) }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        await updateDriverStatus(driver.id, input.status);
        emitToDispatchers("driver:status", { driverId: driver.id, status: input.status });
        return { success: true };
      }),

    getActiveRide: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getDriverActiveRide(driver.id);
        if (!ride) return null;
        const client = await getClientById_safe(ride.clientId);
        return { ...ride, client };
      }),

    acceptRide: publicProcedure
      .input(z.object({ token: z.string(), rideId: z.number() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getRideById(input.rideId);
        if (!ride || ride.driverId !== driver.id) throw new TRPCError({ code: "FORBIDDEN" });
        await updateRideStatus(input.rideId, "accepted", { acceptedAt: new Date() });
        // Notify client
        emitToClient(ride.clientId, "ride:accepted", {
          rideId: ride.id,
          driver: { id: driver.id, name: driver.name, phone: driver.phone },
        });
        emitToDispatchers("ride:status", { rideId: ride.id, status: "accepted" });
        return { success: true };
      }),

    rejectRide: publicProcedure
      .input(z.object({ token: z.string(), rideId: z.number() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getRideById(input.rideId);
        if (!ride || ride.driverId !== driver.id) throw new TRPCError({ code: "FORBIDDEN" });
        await updateRideStatus(input.rideId, "rejected");
        await updateDriverStatus(driver.id, "available");
        emitToClient(ride.clientId, "ride:rejected", { rideId: ride.id });
        emitToDispatchers("ride:status", { rideId: ride.id, status: "rejected", driverId: driver.id });
        return { success: true };
      }),

    completeRide: publicProcedure
      .input(z.object({ token: z.string(), rideId: z.number() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        await updateRideStatus(input.rideId, "completed", { completedAt: new Date() });
        await updateDriverStatus(driver.id, "available");
        const ride = await getRideById(input.rideId);
        if (ride) emitToClient(ride.clientId, "ride:completed", { rideId: ride.id });
        emitToDispatchers("ride:status", { rideId: input.rideId, status: "completed" });
        return { success: true };
      }),

    submitRating: publicProcedure
      .input(z.object({ token: z.string(), clientId: z.number(), rideId: z.number(), rating: z.number().min(1).max(5), comment: z.string().optional() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        await submitClientRating({
          clientId: input.clientId,
          driverId: driver.id,
          rideId: input.rideId,
          rating: input.rating,
          comment: input.comment,
        });
        emitToDispatchers("client:rated", { clientId: input.clientId, rating: input.rating, driverId: driver.id });
        return { success: true };
      }),
  }),

  // ─── Client Auth ────────────────────────────────────────────────────────────
  clientApp: router({
    sendOtp: publicProcedure
      .input(z.object({ phone: z.string().min(10) }))
      .mutation(async ({ input }) => {
        const code = generateOtpCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await createOtp(input.phone, code, expiresAt);
        // In production, send SMS. For demo, return code in response.
        console.log(`[OTP] Phone: ${input.phone}, Code: ${code}`);
        return { success: true, code }; // Remove code in production
      }),

    verifyOtp: publicProcedure
      .input(z.object({ phone: z.string(), code: z.string(), name: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { verifyOtp } = await import("./db");
        const valid = await verifyOtp(input.phone, input.code);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired OTP" });
        const client = await upsertClient(input.phone, input.name);
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await createClientSession(client.id, token, expiresAt);
        return { token, client };
      }),

    logout: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        await deleteClientSession(input.token);
        return { success: true };
      }),

    me: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        return client;
      }),

    requestRide: publicProcedure
      .input(
        z.object({
          token: z.string(),
          lat: z.number(),
          lng: z.number(),
          address: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        // Check if already has active ride
        const existing = await getClientActiveRide(client.id);
        if (existing && existing.status !== "rejected" && existing.status !== "cancelled") {
          return { ride: existing };
        }
        const ride = await createRide({
          clientId: client.id,
          clientLat: String(input.lat),
          clientLng: String(input.lng),
          clientAddress: input.address ?? null,
          status: "pending",
        });
        // Notify dispatchers
        emitToDispatchers("ride:new", {
          rideId: ride.id,
          clientId: client.id,
          clientPhone: client.phone,
          clientName: client.name,
          lat: input.lat,
          lng: input.lng,
          address: input.address,
          timestamp: Date.now(),
        });
        return { ride };
      }),

    getActiveRide: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getClientActiveRide(client.id);
        if (!ride) return null;
        let driverInfo = null;
        if (ride.driverId) {
          const driver = await getDriverById(ride.driverId);
          if (driver) {
            const { passwordHash: _, ...safe } = driver;
            driverInfo = safe;
          }
        }
        return { ...ride, driver: driverInfo };
      }),

    cancelRide: publicProcedure
      .input(z.object({ token: z.string(), rideId: z.number() }))
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getRideById(input.rideId);
        if (!ride || ride.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
        await updateRideStatus(input.rideId, "cancelled");
        if (ride.driverId) await updateDriverStatus(ride.driverId, "available");
        emitToDispatchers("ride:status", { rideId: ride.id, status: "cancelled" });
        if (ride.driverId) emitToDriver(ride.driverId, "ride:cancelled", { rideId: ride.id });
        return { success: true };
      }),

    getProfile: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const profile = await getClientProfile(client.id);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
        return profile;
      }),
  }),

  // ─── Dispatcher (protected) ─────────────────────────────────────────────────
  dispatcher: router({
    // Driver management
    addDriver: protectedProcedure
      .input(
        z.object({
          username: z.string().min(3),
          password: z.string().min(6),
          name: z.string().min(2),
          phone: z.string().optional(),
          carPlate: z.string().optional(),
          carBrand: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await getDriverByUsername(input.username);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Username already exists" });
        const passwordHash = await bcrypt.hash(input.password, 10);
        await createDriver({
          username: input.username,
          passwordHash,
          name: input.name,
          phone: input.phone ?? null,
          carPlate: input.carPlate ?? null,
          carBrand: input.carBrand ?? null,
        });
        return { success: true };
      }),

    deleteDriver: protectedProcedure
      .input(z.object({ driverId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDriver(input.driverId);
        return { success: true };
      }),

    getAllDrivers: protectedProcedure.query(async () => {
      const all = await getAllDrivers();
      return all.map(({ passwordHash: _, ...d }) => d);
    }),

    getAvailableDrivers: protectedProcedure.query(async () => {
      const available = await getAvailableDrivers();
      return available.map(({ passwordHash: _, ...d }) => d);
    }),

    // Ride management
    getPendingRides: protectedProcedure.query(async () => {
      const pending = await getPendingRides();
      return Promise.all(
        pending.map(async (r) => {
          const client = await getClientById_safe(r.clientId);
          return { ...r, client };
        })
      );
    }),

    getActiveRides: protectedProcedure.query(async () => {
      const active = await getActiveRides();
      return Promise.all(
        active.map(async (r) => {
          const client = await getClientById_safe(r.clientId);
          let driver = null;
          if (r.driverId) {
            const d = await getDriverById(r.driverId);
            if (d) {
              const { passwordHash: _, ...safe } = d;
              driver = safe;
            }
          }
          return { ...r, client, driver };
        })
      );
    }),

    getRideHistory: protectedProcedure.query(async () => {
      const history = await getRideHistory();
      return Promise.all(
        history.map(async (r) => {
          const client = await getClientById_safe(r.clientId);
          let driver = null;
          if (r.driverId) {
            const d = await getDriverById(r.driverId);
            if (d) {
              const { passwordHash: _, ...safe } = d;
              driver = safe;
            }
          }
          return { ...r, client, driver };
        })
      );
    }),

    assignRide: protectedProcedure
      .input(z.object({ rideId: z.number(), driverId: z.number() }))
      .mutation(async ({ input }) => {
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        await assignRide(input.rideId, input.driverId);
        const driver = await getDriverById(input.driverId);
        const client = await getClientById_safe(ride.clientId);
        // Notify driver
        emitToDriver(input.driverId, "ride:assigned", {
          rideId: ride.id,
          clientId: ride.clientId,
          clientPhone: client?.phone,
          clientName: client?.name,
          lat: ride.clientLat,
          lng: ride.clientLng,
          address: ride.clientAddress,
        });
        // Notify client
        emitToClient(ride.clientId, "ride:assigned", {
          rideId: ride.id,
          driver: driver ? { id: driver.id, name: driver.name, phone: driver.phone } : null,
        });
        emitToDispatchers("ride:status", { rideId: ride.id, status: "assigned", driverId: input.driverId });
        return { success: true };
      }),

    cancelRide: protectedProcedure
      .input(z.object({ rideId: z.number() }))
      .mutation(async ({ input }) => {
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        await updateRideStatus(input.rideId, "cancelled");
        if (ride.driverId) await updateDriverStatus(ride.driverId, "available");
        emitToClient(ride.clientId, "ride:cancelled", { rideId: ride.id });
        if (ride.driverId) emitToDriver(ride.driverId, "ride:cancelled", { rideId: ride.id });
        return { success: true };
      }),

    getAllClientsWithRatings: protectedProcedure.query(async () => {
      return getAllClientsWithRatings();
    }),

    getClientProfile: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const profile = await getClientProfile(input.clientId);
        if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
        return profile;
      }),
  }),
});

async function getClientById_safe(clientId: number) {
  const { getClientById } = await import("./db");
  return getClientById(clientId);
}

export type AppRouter = typeof appRouter;

