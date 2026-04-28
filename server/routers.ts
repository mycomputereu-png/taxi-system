
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
  createPanicAlert,
  getPanicAlertById,
  getActivePanicAlerts,
  getPanicAlertsByDriver,
  updatePanicAlertStatus,
  type ActiveRide,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
const COOKIE_NAME = "session";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { emitToClient, emitToDispatchers, emitToDriver, setRideAcceptanceTimeout, clearRideAcceptanceTimeout } from "./socket";

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
      ctx.res.clearCookie("session", { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateClientName: publicProcedure
      .input(z.object({ token: z.string(), name: z.string() }))
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { clients } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(clients)
            .set({ name: input.name })
            .where(eq(clients.id, client.id));
        }
        return { success: true };
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
        return { token, driver };
      }),

    logout: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        await deleteDriverSession(input.token);
        return { success: true };
      }),

    getMe: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        return driver;
      }),

    updateStatus: publicProcedure
      .input(z.object({ token: z.string(), status: z.enum(["available", "busy", "offline"]) }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        await updateDriverStatus(driver.id, input.status);
        // Emit status change to dispatcher
        emitToDispatchers("driver:status", {
          driverId: driver.id,
          status: input.status,
          timestamp: Date.now(),
        });
        return { success: true };
      }),

    updateLocation: publicProcedure
      .input(
        z.object({
          token: z.string(),
          lat: z.number(),
          lng: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        // Update location in DB
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { drivers } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(drivers)
            .set({
              currentLat: input.lat.toString(),
              currentLng: input.lng.toString(),
              lastLocationUpdate: new Date(),
            })
            .where(eq(drivers.id, driver.id));
        }
        // Emit to dispatcher
        emitToDispatchers("driver:location", {
          driverId: driver.id,
          lat: input.lat,
          lng: input.lng,
        });
        return { success: true };
      }),

    acceptRide: publicProcedure
      .input(z.object({ token: z.string(), rideId: z.number() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        if (ride.driverId !== driver.id) throw new TRPCError({ code: "FORBIDDEN" });

        // Clear timeout
        clearRideAcceptanceTimeout(input.rideId);

        await updateRideStatus(input.rideId, "accepted", { acceptedAt: new Date() });
        console.log(`[Ride] Driver ${driver.id} accepted ride ${input.rideId}`);
        emitToClient(ride.clientId, "ride:accepted", {
          driver: {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            currentLat: driver.currentLat,
            currentLng: driver.currentLng,
          },
        });
        emitToDispatchers("ride:accepted", { rideId: ride.id, driverId: driver.id });
        return { success: true };
      }),

    rejectRide: publicProcedure
      .input(z.object({ token: z.string(), rideId: z.number() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        if (ride.driverId !== driver.id) throw new TRPCError({ code: "FORBIDDEN" });

        // Clear timeout
        clearRideAcceptanceTimeout(input.rideId);

        await updateRideStatus(input.rideId, "rejected");
        await updateDriverStatus(driver.id, "available");
        emitToClient(ride.clientId, "ride:rejected", { rideId: ride.id });
        emitToDispatchers("ride:rejected", { rideId: ride.id, driverId: driver.id });
        return { success: true };
      }),

    completeRide: publicProcedure
      .input(z.object({ token: z.string(), rideId: z.number() }))
      .mutation(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        if (ride.driverId !== driver.id) throw new TRPCError({ code: "FORBIDDEN" });
        await updateRideStatus(input.rideId, "completed", { completedAt: new Date() });
        await updateDriverStatus(driver.id, "available");
        emitToClient(ride.clientId, "ride:completed", { rideId: ride.id });
        emitToDispatchers("ride:completed", { rideId: ride.id });
        return { success: true };
      }),

    updateRideDistance: publicProcedure
      .input(z.object({ rideId: z.number(), distance_km: z.number() }))
      .mutation(async ({ input }) => {
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { rides } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(rides)
            .set({ distanceKm: input.distance_km.toString() })
            .where(eq(rides.id, input.rideId));
        }
        return { success: true };
      }),

    getActiveRide: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByToken(input.token);
        if (!driver) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getDriverActiveRide(driver.id);
        return ride ?? null;
      }),

    submitRating: publicProcedure
      .input(
        z.object({
          token: z.string(),
          clientId: z.number(),
          rideId: z.number(),
          rating: z.number().min(1).max(5),
          comment: z.string().optional(),
        })
      )
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
        return { success: true };
      }),
    updateClientName: publicProcedure
      .input(z.object({ token: z.string(), name: z.string() }))
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { clients } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(clients)
            .set({ name: input.name })
            .where(eq(clients.id, client.id));
        }
        return { success: true };
      }),
  }),

  // ─── Client Auth ────────────────────────────────────────────────────────────
  clientApp: router({
    sendOtp: publicProcedure
      .input(z.object({ phone: z.string() }))
      .mutation(async ({ input }) => {
        const code = generateOtpCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await createOtp(input.phone, code, expiresAt);
        console.log(`[OTP] Phone: ${input.phone}, Code: ${code}`);
        return { success: true, code };
      }),

    verifyOtp: publicProcedure
      .input(z.object({ phone: z.string(), code: z.string() }))
      .mutation(async ({ input }) => {
        console.log(`[verifyOtp] Starting for phone: ${input.phone}`);
        // Verify OTP code first
        const { verifyOtp: verifyOtpCode } = await import("./db");
        const isValid = await verifyOtpCode(input.phone, input.code);
        console.log(`[verifyOtp] OTP valid: ${isValid}`);
        if (!isValid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired OTP" });
        
        console.log(`[verifyOtp] Upserting client...`);
        await upsertClient(input.phone);
        const client = await getClientByPhone(input.phone);
        console.log(`[verifyOtp] Client after upsert: id=${client?.id}, phone=${client?.phone}`);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await createClientSession(client.id, token, expiresAt);
        console.log(`[verifyOtp] Session created for client ${client.id}`);
        return { token, client };
      }),

    logout: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        await deleteClientSession(input.token);
        return { success: true };
      }),

    getMe: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const client = await getClientByToken(input.token);
        return client;
      }),

    updateLocation: publicProcedure
      .input(
        z.object({
          token: z.string(),
          lat: z.number(),
          lng: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        // Update location in DB
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { clients } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(clients)
          .set({
            currentLat: input.lat.toString(),
            currentLng: input.lng.toString(),
          })
            .where(eq(clients.id, client.id));
        }
        // Emit to dispatcher and active driver
        emitToDispatchers("client:location", {
          clientId: client.id,
          lat: input.lat,
          lng: input.lng,
        });
        return { success: true };
      }),

    requestRide: publicProcedure
      .input(
        z.object({
          token: z.string(),
          clientLat: z.number(),
          clientLng: z.number(),
          clientAddress: z.string().optional(),
          destinationLat: z.number().optional(),
          destinationLng: z.number().optional(),
          destinationAddress: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        console.log(`[requestRide] Starting with token: ${input.token}`);
        const client = await getClientByToken(input.token);
        console.log(`[requestRide] Client from token: id=${client?.id}, phone=${client?.phone}`);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await createRide({
          clientId: client.id,
          status: "pending",
          clientLat: input.clientLat.toString(),
          clientLng: input.clientLng.toString(),
          clientAddress: input.clientAddress,
          destinationLat: input.destinationLat?.toString(),
          destinationLng: input.destinationLng?.toString(),
          destinationAddress: input.destinationAddress,
        });
        console.log(`[requestRide] Ride created: id=${ride.id}, clientId=${ride.clientId}`);
        emitToDispatchers("ride:new", {
          rideId: ride.id,
          clientId: client.id,
          clientPhone: client.phone,
          clientName: client.name,
          lat: input.clientLat,
          lng: input.clientLng,
          address: input.clientAddress,
        });
        console.log(`[requestRide] Emitted ride:new event`);
        return ride;
      }),

    getActiveRide: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getClientActiveRide(client.id);
        return ride ?? null;
      }),

    cancelRide: publicProcedure
      .input(z.object({ token: z.string(), rideId: z.number() }))
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        if (ride.clientId !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
        await updateRideStatus(input.rideId, "cancelled");
        if (ride.driverId) await updateDriverStatus(ride.driverId, "available");
        emitToClient(ride.clientId, "ride:cancelled", { rideId: ride.id });
        if (ride.driverId) emitToDriver(ride.driverId, "ride:cancelled", { rideId: ride.id });
        return { success: true };
      }),
    updateClientName: publicProcedure
      .input(z.object({ token: z.string(), name: z.string() }))
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { clients } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(clients)
            .set({ name: input.name })
            .where(eq(clients.id, client.id));
        }
        return { success: true };
      }),
  }),

  // ─── Dispatcher ──────────────────────────────────────────────────────────────
  dispatcher: router({
    addDriver: protectedProcedure
      .input(
        z.object({
          username: z.string(),
          password: z.string(),
          name: z.string(),
          phone: z.string().optional(),
          carPlate: z.string().optional(),
          carBrand: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const hash = await bcrypt.hash(input.password, 10);
        await createDriver({
          username: input.username,
          passwordHash: hash,
          name: input.name,
          phone: input.phone,
          carPlate: input.carPlate,
          carBrand: input.carBrand,
          status: "offline",
        });
        return { success: true };
      }),

    getDrivers: protectedProcedure.query(async () => {
      return getAllDrivers();
    }),

    deleteDriver: protectedProcedure
      .input(z.object({ driverId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDriver(input.driverId);
        return { success: true };
      }),

    assignRide: protectedProcedure
      .input(z.object({ rideId: z.number(), driverId: z.number() }))
      .mutation(async ({ input }) => {
        const ride = await getRideById(input.rideId);
        if (!ride) throw new TRPCError({ code: "NOT_FOUND" });
        const driver = await getDriverById(input.driverId);
        if (!driver) throw new TRPCError({ code: "NOT_FOUND" });

        await assignRide(input.rideId, input.driverId);

        // Set 30-second timeout
        setRideAcceptanceTimeout(input.rideId, async () => {
          // Timeout handler
          const updatedRide = await getRideById(input.rideId);
          if (updatedRide && updatedRide.status === "assigned") {
            await updateRideStatus(input.rideId, "pending");
            await updateDriverStatus(input.driverId, "available");
            emitToDriver(input.driverId, "ride:timeout", { rideId: input.rideId });
            emitToClient(updatedRide.clientId, "ride:reassigning", { rideId: input.rideId });
            emitToDispatchers("ride:reassigning", { rideId: input.rideId });
          }
        });

        const countdown = 30;
        emitToDriver(input.driverId, "ride:assigned", {
          rideId: ride.id,
          clientLat: ride.clientLat,
          clientLng: ride.clientLng,
          clientAddress: ride.clientAddress,
          destinationLat: ride.destinationLat,
          destinationLng: ride.destinationLng,
          destinationAddress: ride.destinationAddress,
          countdown,
        });
        emitToClient(ride.clientId, "ride:assigned", {
          driverId: input.driverId,
          driverName: driver.name,
        });
        emitToDispatchers("ride:assigned", { rideId: ride.id, driverId: input.driverId });
        return { success: true };
      }),

    getPendingRides: protectedProcedure.query(async () => {
      return getPendingRides();
    }),

    getActiveRides: protectedProcedure.query(async (): Promise<ActiveRide[]> => {
      return getActiveRides();
    }),

    getRideHistory: protectedProcedure.query(async () => {
      return getRideHistory();
    }),

    getRideById: protectedProcedure
      .input(z.object({ rideId: z.number() }))
      .query(async ({ input }) => {
        return getRideById(input.rideId);
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

    getDriverRides: protectedProcedure
      .input(z.object({
        driverId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const { getDriverRides } = await import("./db");
        return getDriverRides(input.driverId, input.startDate, input.endDate);
      }),

    getDriverStatistics: protectedProcedure
      .input(z.object({
        driverId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const { getDriverStatistics } = await import("./db");
        return getDriverStatistics(input.driverId, input.startDate, input.endDate);
      }),
    updateClientName: publicProcedure
      .input(z.object({ token: z.string(), name: z.string() }))
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { clients } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(clients)
            .set({ name: input.name })
            .where(eq(clients.id, client.id));
        }
        return { success: true };
      }),
  }),

  // ─── Panic Alerts ──────────────────────────────────────────────────────────
  panic: router({
    triggerAlert: publicProcedure
      .input(
        z.object({
          driverId: z.number(),
          lat: z.number(),
          lng: z.number(),
          address: z.string().optional(),
          rideId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const alert = await createPanicAlert({
          driverId: input.driverId,
          rideId: input.rideId,
          status: "active",
          driverLat: input.lat.toString(),
          driverLng: input.lng.toString(),
          driverAddress: input.address,
        });
        // Emit to all dispatchers
        emitToDispatchers("panic:alert", {
          alertId: alert.id,
          driverId: alert.driverId,
          lat: alert.driverLat,
          lng: alert.driverLng,
          address: alert.driverAddress,
          rideId: alert.rideId,
          createdAt: alert.createdAt,
        });
        return alert;
      }),

    acknowledgePanicAlert: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input }) => {
        await updatePanicAlertStatus(input.alertId, "acknowledged");
        const alert = await getPanicAlertById(input.alertId);
        if (alert) {
          emitToDriver(alert.driverId, "panic:acknowledged", { alertId: alert.id });
        }
        return { success: true };
      }),

    resolvePanicAlert: protectedProcedure
      .input(
        z.object({
          alertId: z.number(),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updatePanicAlertStatus(input.alertId, "resolved", {
          dispatcherNote: input.note,
        });
        const alert = await getPanicAlertById(input.alertId);
        if (alert) {
          emitToDriver(alert.driverId, "panic:resolved", { alertId: alert.id });
        }
        return { success: true };
      }),

    cancelPanicAlert: publicProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input }) => {
        await updatePanicAlertStatus(input.alertId, "cancelled");
        return { success: true };
      }),

    getActivePanicAlerts: protectedProcedure.query(async () => {
      return getActivePanicAlerts();
    }),

    getPanicAlertsByDriver: protectedProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => {
        return getPanicAlertsByDriver(input.driverId);
      }),
    updateClientName: publicProcedure
      .input(z.object({ token: z.string(), name: z.string() }))
      .mutation(async ({ input }) => {
        const client = await getClientByToken(input.token);
        if (!client) throw new TRPCError({ code: "UNAUTHORIZED" });
        const db = await import("./db").then((m) => m.getDb());
        if (db) {
          const { clients } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(clients)
            .set({ name: input.name })
            .where(eq(clients.id, client.id));
        }
        return { success: true };
      }),
  }),
});

async function getClientById_safe(clientId: number) {
  const { getClientById } = await import("./db");
  return getClientById(clientId);
}

export type AppRouter = typeof appRouter;
