import { eq, and, ne, desc, inArray, getTableColumns, gte, lte, sql } from "drizzle-orm";
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
  panicAlerts,
  PanicAlert,
  InsertPanicAlert,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

// Type for rides with nested client and driver info
export type ActiveRide = Ride & {
  client?: {
    id: number;
    phone: string;
    name: string | null;
    currentLat: string | null;
    currentLng: string | null;
  } | null;
  driver?: {
    id: number;
    name: string;
    phone: string | null;
    username: string;
    carPlate: string | null;
    carBrand: string | null;
  } | null;
};

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
    
    // Add rides columns if they don't exist
    await db.execute(
      "ALTER TABLE `rides` ADD COLUMN `assignedAt` timestamp NULL"
    ).catch(() => {
      // Column might already exist, ignore error
    });
    
    // Add distance_km column if it doesn't exist
    await db.execute(
      "ALTER TABLE `rides` ADD COLUMN `distance_km` DECIMAL(8, 2) NULL"
    ).catch(() => {
      // Column might already exist, ignore error
    });
    
    // Add revenue column if it doesn't exist
    await db.execute(
      "ALTER TABLE `rides` ADD COLUMN `revenue` DECIMAL(10, 2) NULL"
    ).catch(() => {
      // Column might already exist, ignore error
    });
    
    await db.execute(
      "ALTER TABLE `rides` ADD COLUMN `acceptanceTimeoutAt` timestamp NULL"
    ).catch(() => {
      // Column might already exist, ignore error
    });
    
    // Fix distanceKm column name to distance_km if it exists as distanceKm
    await db.execute(
      "ALTER TABLE `rides` CHANGE COLUMN `distanceKm` `distance_km` DECIMAL(8, 2) NULL"
    ).catch(() => {
      // Column might already be named distance_km, ignore error
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
  console.log(`[DB] upsertClient: phone=${phone}, name=${name}`);
  await db
    .insert(clients)
    .values({ phone, name: name ?? null })
    .onDuplicateKeyUpdate({ set: { name: name ?? null } });
  const result = await db.select().from(clients).where(eq(clients.phone, phone)).limit(1);
  console.log(`[DB] upsertClient result: id=${result[0]?.id}, phone=${result[0]?.phone}`);
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
  console.log(`[DB] getClientByPhone: phone=${phone}, found=${result[0]?.id}`);
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
  console.log(`[DB] createOtp: phone=${phone}, code=${code}`);
  // Invalidate old codes
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  await db.insert(otpCodes).values({ phone, code, expiresAt });
  console.log(`[DB] createOtp: success`);
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
  try {
    console.log(`[DB] createClientSession: clientId=${clientId}, token=${token}`);
    await db.insert(clientSessions).values({ clientId, token, expiresAt });
    console.log(`[DB] createClientSession: success`);
  } catch (error) {
    console.error(`[DB] createClientSession error:`, error);
    throw error;
  }
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
  console.log(`[DB] getClientByToken: token=${token}, found=${result[0]?.client?.id}`);
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
  console.log(`[DB] createRide: clientId=${data.clientId}, status=${data.status}`);
  await db.insert(rides).values(data);
  const result = await db
    .select()
    .from(rides)
    .where(eq(rides.clientId, data.clientId!))
    .orderBy(desc(rides.createdAt))
    .limit(1);
  console.log(`[DB] createRide: created ride id=${result[0]?.id}`);
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

export async function getActiveRides(): Promise<ActiveRide[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      ...getTableColumns(rides),
      client: {
        id: clients.id,
        phone: clients.phone,
        name: clients.name,
        currentLat: clients.currentLat,
        currentLng: clients.currentLng,
      },
      driver: {
        id: drivers.id,
        name: drivers.name,
        phone: drivers.phone,
        username: drivers.username,
        carPlate: drivers.carPlate,
        carBrand: drivers.carBrand,
      },
    })
    .from(rides)
    .leftJoin(clients, eq(rides.clientId, clients.id))
    .leftJoin(drivers, eq(rides.driverId, drivers.id))
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
  console.log(`[DB] getClientActiveRide: clientId=${clientId}`);
  try {
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
    console.log(`[DB] getClientActiveRide: found=${result[0]?.id}, status=${result[0]?.status}`);
    return result[0];
  } catch (error: any) {
    console.error(`[DB] getClientActiveRide error:`, error?.message || error);
    if (error?.cause) console.error(`[DB] getClientActiveRide error cause:`, error.cause);
    throw error;
  }
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
  
  // Get clients with ratings and ride count
  const result = await db
    .select({
      client: clients,
      avgRating: sql<number>`COALESCE(AVG(${clientRatings.rating}), 0)`,
      ratingCount: sql<number>`COUNT(DISTINCT ${clientRatings.id})`,
      rideCount: sql<number>`COUNT(DISTINCT ${rides.id})`,
    })
    .from(clients)
    .leftJoin(clientRatings, eq(clients.id, clientRatings.clientId))
    .leftJoin(rides, eq(clients.id, rides.clientId))
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

  // Get all ratings received by this client with driver and ride info
  const ratingsReceived = await db
    .select({
      rating: clientRatings,
      driver: drivers,
      ride: rides,
    })
    .from(clientRatings)
    .leftJoin(drivers, eq(clientRatings.driverId, drivers.id))
    .leftJoin(rides, eq(clientRatings.rideId, rides.id))
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


// ─── Panic Alerts ────────────────────────────────────────────────────────────

export async function createPanicAlert(data: InsertPanicAlert): Promise<PanicAlert> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(panicAlerts).values(data);
  const result = await db
    .select()
    .from(panicAlerts)
    .where(eq(panicAlerts.driverId, data.driverId!))
    .orderBy(desc(panicAlerts.createdAt))
    .limit(1);
  return result[0]!;
}

export async function getPanicAlertById(id: number): Promise<PanicAlert | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(panicAlerts).where(eq(panicAlerts.id, id)).limit(1);
  return result[0];
}

export async function getActivePanicAlerts(): Promise<PanicAlert[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(panicAlerts)
    .where(eq(panicAlerts.status, "active"))
    .orderBy(desc(panicAlerts.createdAt));
}

export async function getPanicAlertsByDriver(driverId: number): Promise<PanicAlert[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(panicAlerts)
    .where(eq(panicAlerts.driverId, driverId))
    .orderBy(desc(panicAlerts.createdAt))
    .limit(50);
}

export async function updatePanicAlertStatus(
  alertId: number,
  status: PanicAlert["status"],
  extra?: Partial<PanicAlert>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const updates: any = { status, ...extra };
  if (status === "acknowledged" && !extra?.acknowledgedAt) {
    updates.acknowledgedAt = new Date();
  }
  if (status === "resolved" && !extra?.resolvedAt) {
    updates.resolvedAt = new Date();
  }
  await db.update(panicAlerts).set(updates).where(eq(panicAlerts.id, alertId));
}


// Driver statistics and ride history
export interface DriverRideStats {
  id: number;
  clientId: number;
  driverId: number | null;
  status: string;
  clientLat: string | null;
  clientLng: string | null;
  clientAddress: string | null;
  destinationLat: string | null;
  destinationLng: string | null;
  destinationAddress: string | null;
  estimatedArrival: number | null;
  distanceKm: string | null;
  revenue: string | null;
  createdAt: Date;
  completedAt: Date | null;
  acceptedAt: Date | null;
  clientName: string | null;
  clientPhone: string | null;
}

export async function getDriverRides(
  driverId: number,
  startDate?: Date,
  endDate?: Date
): Promise<DriverRideStats[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db
    .select({
      id: rides.id,
      clientId: rides.clientId,
      driverId: rides.driverId,
      status: rides.status,
      clientLat: rides.clientLat,
      clientLng: rides.clientLng,
      clientAddress: rides.clientAddress,
      destinationLat: rides.destinationLat,
      destinationLng: rides.destinationLng,
      destinationAddress: rides.destinationAddress,
      estimatedArrival: rides.estimatedArrival,
      distanceKm: rides.distanceKm,
      revenue: rides.revenue,
      createdAt: rides.createdAt,
      completedAt: rides.completedAt,
      acceptedAt: rides.acceptedAt,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(rides)
    .leftJoin(clients, eq(rides.clientId, clients.id));
  
  const whereConditions: any[] = [eq(rides.driverId, driverId)];
  if (startDate) whereConditions.push(gte(rides.createdAt, startDate));
  if (endDate) whereConditions.push(lte(rides.createdAt, endDate));
  
  return query.where(and(...whereConditions)).orderBy(desc(rides.createdAt));
}

export interface DriverStatistics {
  totalRides: number;
  completedRides: number;
  totalDistanceKm: number;
  totalRevenue: number;
  averageRating: number | null;
  ratingCount: number;
}

export async function getDriverStatistics(
  driverId: number,
  startDate?: Date,
  endDate?: Date
): Promise<DriverStatistics> {
  const db = await getDb();
  if (!db) {
    return {
      totalRides: 0,
      completedRides: 0,
      totalDistanceKm: 0,
      totalRevenue: 0,
      averageRating: null,
      ratingCount: 0,
    };
  }
  
  // Get ride statistics
  const conditions: any[] = [eq(rides.driverId, driverId)];
  if (startDate) conditions.push(gte(rides.createdAt, startDate));
  if (endDate) conditions.push(lte(rides.createdAt, endDate));
  
  const rideStats = await db
    .select({
      totalRides: sql<number>`COUNT(*)`,
      completedRides: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
      totalDistanceKm: sql<number>`COALESCE(SUM(CAST(distanceKm AS DECIMAL(10,2))), 0)`,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(revenue AS DECIMAL(10,2))), 0)`,
    })
    .from(rides)
    .where(and(...conditions));
  
  // Get rating statistics
  const ratingConditions: any[] = [eq(clientRatings.driverId, driverId)];
  if (startDate) ratingConditions.push(gte(clientRatings.createdAt, startDate));
  if (endDate) ratingConditions.push(lte(clientRatings.createdAt, endDate));
  
  const ratingStats = await db
    .select({
      averageRating: sql<number>`AVG(rating)`,
      ratingCount: sql<number>`COUNT(*)`,
    })
    .from(clientRatings)
    .where(and(...ratingConditions));
  
  return {
    totalRides: Number(rideStats[0]?.totalRides) || 0,
    completedRides: Number(rideStats[0]?.completedRides) || 0,
    totalDistanceKm: rideStats[0]?.totalDistanceKm ? parseFloat(String(rideStats[0].totalDistanceKm)) : 0,
    totalRevenue: rideStats[0]?.totalRevenue ? parseFloat(String(rideStats[0].totalRevenue)) : 0,
    averageRating: ratingStats[0]?.averageRating ? parseFloat(String(ratingStats[0].averageRating)) : null,
    ratingCount: Number(ratingStats[0]?.ratingCount) || 0,
  };
}
