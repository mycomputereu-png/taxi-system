import { and, desc, eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Client,
  Driver,
  InsertClient,
  InsertDriver,
  InsertRide,
  Ride,
  clientSessions,
  clients,
  driverSessions,
  drivers,
  otpCodes,
  rides,
  users,
  InsertUser,
  ClientRating,
  InsertClientRating,
  clientRatings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      // Run migrations on first connection
      await runMigrations();
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

let _migrationRun = false;

async function runMigrations() {
  if (_migrationRun) return;
  _migrationRun = true;
  
  try {
    const db = _db;
    if (!db) return;
    
    // Add carPlate and carBrand columns if they don't exist
    await db.execute(
      "ALTER TABLE `drivers` ADD COLUMN `carPlate` varchar(32) NULL"
    ).catch(() => {
      // Column might already exist, ignore error
    });
    
    await db.execute(
      "ALTER TABLE `drivers` ADD COLUMN `carBrand` varchar(128) NULL"
    ).catch(() => {
      // Column might already exist, ignore error
    });
    
    console.log("[Database] Migrations completed");
  } catch (error) {
    console.warn("[Database] Migration error:", error);
  }
}

// ─── Users (Manus OAuth) ─────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

export async function createDriver(data: InsertDriver): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(drivers).values(data);
}

export async function getDriverByUsername(username: string): Promise<Driver | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drivers).where(eq(drivers.username, username)).limit(1);
  return result[0];
}

export async function getDriverById(id: number): Promise<Driver | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return result[0];
}

export async function getAllDrivers(): Promise<Driver[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers).orderBy(desc(drivers.createdAt));
}

export async function getAvailableDrivers(): Promise<Driver[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers).where(eq(drivers.status, "available"));
}

export async function updateDriverStatus(
  id: number,
  status: "available" | "busy" | "offline"
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(drivers).set({ status }).where(eq(drivers.id, id));
}

export async function updateDriverLocation(
  id: number,
  lat: string,
  lng: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(drivers)
    .set({ currentLat: lat, currentLng: lng, lastLocationUpdate: new Date() })
    .where(eq(drivers.id, id));
}

export async function deleteDriver(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(drivers).where(eq(drivers.id, id));
}

// ─── Driver Sessions ──────────────────────────────────────────────────────────

export async function createDriverSession(driverId: number, token: string, expiresAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(driverSessions).values({ driverId, token, expiresAt });
}

export async function getDriverByToken(token: string): Promise<Driver | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ driver: drivers })
    .from(driverSessions)
    .innerJoin(drivers, eq(driverSessions.driverId, drivers.id))
    .where(and(eq(driverSessions.token, token)))
    .limit(1);
  return result[0]?.driver;
}

export async function deleteDriverSession(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(driverSessions).where(eq(driverSessions.token, token));
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export async function upsertClient(phone: string, name?: string): Promise<Client> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(clients)
    .values({ phone, name: name ?? null })
    .onDuplicateKeyUpdate({ set: { name: name ?? null } });
  const result = await db.select().from(clients).where(eq(clients.phone, phone)).limit(1);
  return result[0]!;
}

export async function getClientById(id: number): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function getClientByPhone(phone: string): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.phone, phone)).limit(1);
  return result[0];
}

export async function updateClientLocation(id: number, lat: string, lng: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ currentLat: lat, currentLng: lng }).where(eq(clients.id, id));
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

export async function createOtp(phone: string, code: string, expiresAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Invalidate old codes
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  await db.insert(otpCodes).values({ phone, code, expiresAt });
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = new Date();
  const result = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.code, code),
        eq(otpCodes.used, false)
      )
    )
    .limit(1);
  if (!result[0]) return false;
  if (result[0].expiresAt < now) return false;
  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, result[0].id));
  return true;
}

// ─── Client Sessions ──────────────────────────────────────────────────────────

export async function createClientSession(clientId: number, token: string, expiresAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(clientSessions).values({ clientId, token, expiresAt });
}

export async function getClientByToken(token: string): Promise<Client | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({ client: clients })
    .from(clientSessions)
    .innerJoin(clients, eq(clientSessions.clientId, clients.id))
    .where(eq(clientSessions.token, token))
    .limit(1);
  return result[0]?.client;
}

export async function deleteClientSession(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(clientSessions).where(eq(clientSessions.token, token));
}

// ─── Rides ────────────────────────────────────────────────────────────────────

export async function createRide(data: InsertRide): Promise<Ride> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(rides).values(data);
  const result = await db
    .select()
    .from(rides)
    .where(eq(rides.clientId, data.clientId!))
    .orderBy(desc(rides.createdAt))
    .limit(1);
  return result[0]!;
}

export async function getRideById(id: number): Promise<Ride | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(rides).where(eq(rides.id, id)).limit(1);
  return result[0];
}

export async function getPendingRides(): Promise<Ride[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rides).where(eq(rides.status, "pending")).orderBy(desc(rides.createdAt));
}

export async function getActiveRides(): Promise<Ride[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(rides)
    .where(
      and(
        ne(rides.status, "completed"),
        ne(rides.status, "cancelled"),
        ne(rides.status, "rejected")
      )
    )
    .orderBy(desc(rides.createdAt));
}

export async function getRideHistory(): Promise<Ride[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rides).orderBy(desc(rides.createdAt)).limit(100);
}

export async function getClientActiveRide(clientId: number): Promise<Ride | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(rides)
    .where(
      and(
        eq(rides.clientId, clientId),
        ne(rides.status, "completed"),
        ne(rides.status, "cancelled"),
        ne(rides.status, "rejected")
      )
    )
    .orderBy(desc(rides.createdAt))
    .limit(1);
  return result[0];
}

export async function getDriverActiveRide(driverId: number): Promise<Ride | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(rides)
    .where(
      and(
        eq(rides.driverId, driverId),
        ne(rides.status, "completed"),
        ne(rides.status, "cancelled"),
        ne(rides.status, "rejected")
      )
    )
    .orderBy(desc(rides.createdAt))
    .limit(1);
  return result[0];
}

export async function assignRide(rideId: number, driverId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const timeoutAt = new Date(now.getTime() + 30 * 1000); // 30 seconds from now
  await db
    .update(rides)
    .set({ driverId, status: "assigned", assignedAt: now, acceptanceTimeoutAt: timeoutAt })
    .where(eq(rides.id, rideId));
  await db.update(drivers).set({ status: "busy" }).where(eq(drivers.id, driverId));
}

export async function updateRideStatus(
  rideId: number,
  status: Ride["status"],
  extra?: Partial<Ride>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(rides)
    .set({ status, ...extra })
    .where(eq(rides.id, rideId));
}

// ─── Client Ratings ──────────────────────────────────────────────────────────

export async function submitClientRating(data: InsertClientRating): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(clientRatings).values(data);
}

export async function getClientRatings(clientId: number): Promise<ClientRating[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientRatings).where(eq(clientRatings.clientId, clientId));
}

export async function getClientAverageRating(clientId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { sql } = await import("drizzle-orm");
  const result = await db
    .select({ avg: sql<number>`AVG(${clientRatings.rating})` })
    .from(clientRatings)
    .where(eq(clientRatings.clientId, clientId));
  return result[0]?.avg ? Math.round(result[0].avg * 10) / 10 : 0;
}

export async function getAllClientsWithRatings() {
  const db = await getDb();
  if (!db) return [];
  const { sql } = await import("drizzle-orm");
  const result = await db
    .select({
      client: clients,
      avgRating: sql<number>`AVG(${clientRatings.rating})`,
      ratingCount: sql<number>`COUNT(${clientRatings.id})`,
    })
    .from(clients)
    .leftJoin(clientRatings, eq(clients.id, clientRatings.clientId))
    .groupBy(clients.id);
  return result;
}


// ─── Client Profile ──────────────────────────────────────────────────────────

export async function getClientProfile(clientId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const client = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client[0]) return null;

  // Get all rides for this client with driver info
  const clientRides = await db
    .select({
      ride: rides,
      driver: drivers,
    })
    .from(rides)
    .leftJoin(drivers, eq(rides.driverId, drivers.id))
    .where(eq(rides.clientId, clientId))
    .orderBy(desc(rides.createdAt));

  // Get all ratings received by this client with driver info
  const ratingsReceived = await db
    .select({
      rating: clientRatings,
      driver: drivers,
    })
    .from(clientRatings)
    .leftJoin(drivers, eq(clientRatings.driverId, drivers.id))
    .where(eq(clientRatings.clientId, clientId))
    .orderBy(desc(clientRatings.createdAt));

  // Calculate average rating
  const { sql } = await import("drizzle-orm");
  const avgRatingResult = await db
    .select({ avg: sql<number>`AVG(${clientRatings.rating})` })
    .from(clientRatings)
    .where(eq(clientRatings.clientId, clientId));
  
  const avgRating = avgRatingResult[0]?.avg ? Math.round(avgRatingResult[0].avg * 10) / 10 : 0;

  return {
    client: client[0],
    rides: clientRides,
    ratingsReceived,
    avgRating,
    totalRatings: ratingsReceived.length,
    completedRides: clientRides.filter(r => r.ride.status === "completed").length,
  };
}
