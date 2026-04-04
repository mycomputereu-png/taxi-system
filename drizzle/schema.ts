import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Drivers table - created by dispatcher
export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 256 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  status: mysqlEnum("status", ["available", "busy", "offline"]).default("offline").notNull(),
  currentLat: decimal("currentLat", { precision: 10, scale: 7 }),
  currentLng: decimal("currentLng", { precision: 10, scale: 7 }),
  lastLocationUpdate: timestamp("lastLocationUpdate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

// Clients table - phone-based auth
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }),
  currentLat: decimal("currentLat", { precision: 10, scale: 7 }),
  currentLng: decimal("currentLng", { precision: 10, scale: 7 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// OTP codes for client phone authentication
export const otpCodes = mysqlTable("otp_codes", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 32 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OtpCode = typeof otpCodes.$inferSelect;

// Rides table
export const rides = mysqlTable("rides", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  driverId: int("driverId"),
  status: mysqlEnum("status", [
    "pending",
    "assigned",
    "accepted",
    "in_progress",
    "completed",
    "rejected",
    "cancelled",
  ])
    .default("pending")
    .notNull(),
  clientLat: decimal("clientLat", { precision: 10, scale: 7 }).notNull(),
  clientLng: decimal("clientLng", { precision: 10, scale: 7 }).notNull(),
  clientAddress: text("clientAddress"),
  destinationLat: decimal("destinationLat", { precision: 10, scale: 7 }),
  destinationLng: decimal("destinationLng", { precision: 10, scale: 7 }),
  destinationAddress: text("destinationAddress"),
  estimatedArrival: int("estimatedArrival"), // minutes
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
  completedAt: timestamp("completedAt"),
});

export type Ride = typeof rides.$inferSelect;
export type InsertRide = typeof rides.$inferInsert;

// Driver sessions (JWT tokens)
export const driverSessions = mysqlTable("driver_sessions", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  token: varchar("token", { length: 512 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Client sessions
export const clientSessions = mysqlTable("client_sessions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  token: varchar("token", { length: 512 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Client ratings - drivers rate clients
export const clientRatings = mysqlTable("client_ratings", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  driverId: int("driverId").notNull(),
  rideId: int("rideId").notNull(),
  rating: int("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientRating = typeof clientRatings.$inferSelect;
export type InsertClientRating = typeof clientRatings.$inferInsert;
