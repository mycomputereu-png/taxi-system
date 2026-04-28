import { getDb } from "./db";
import { dispatchers, dispatcherSessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function createDispatcher(email: string, password: string, name: string, phone?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  
  const result = await db.insert(dispatchers).values({
    email,
    passwordHash,
    name,
    phone,
    status: "active",
  });
  
  return result;
}

export async function getDispatcherByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const result = await db.select().from(dispatchers).where(eq(dispatchers.email, email));
  return result[0] || null;
}

export async function verifyDispatcherPassword(email: string, password: string) {
  const dispatcher = await getDispatcherByEmail(email);
  if (!dispatcher) return null;
  
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  if (passwordHash === dispatcher.passwordHash) {
    return dispatcher;
  }
  return null;
}

export async function createDispatcherSession(dispatcherId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const result = await db.insert(dispatcherSessions).values({
    dispatcherId,
    token,
    expiresAt,
  });
  return result;
}

export async function getDispatcherSession(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const result = await db.select().from(dispatcherSessions).where(eq(dispatcherSessions.token, token));
  return result[0] || null;
}

export async function deleteDispatcherSession(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  await db.delete(dispatcherSessions).where(eq(dispatcherSessions.token, token));
}

export async function getAllDispatchers() {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const result = await db.select().from(dispatchers);
  return result;
}

export async function getDispatcherById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const result = await db.select().from(dispatchers).where(eq(dispatchers.id, id));
  return result[0] || null;
}

export async function updateDispatcher(id: number, data: { name?: string; phone?: string; status?: "active" | "inactive" | "suspended" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  await db.update(dispatchers).set(data).where(eq(dispatchers.id, id));
}

export async function updateDispatcherPassword(id: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  const passwordHash = crypto.createHash("sha256").update(newPassword).digest("hex");
  await db.update(dispatchers).set({ passwordHash }).where(eq(dispatchers.id, id));
}

export async function deleteDispatcher(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  // Delete all sessions first
  await db.delete(dispatcherSessions).where(eq(dispatcherSessions.dispatcherId, id));
  // Then delete dispatcher
  await db.delete(dispatchers).where(eq(dispatchers.id, id));
}
