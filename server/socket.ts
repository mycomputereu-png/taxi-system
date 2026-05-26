import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { getDriverByToken, getClientByToken, updateDriverLocation, updateClientLocation } from "./db";

let io: SocketIOServer | null = null;

// Track connected sockets by role
const dispatcherSockets = new Set<string>();
const driverSockets = new Map<number, string>(); // driverId -> socketId
const clientSockets = new Map<number, string>(); // clientId -> socketId

// Track ride acceptance timeouts
const rideTimeouts = new Map<number, NodeJS.Timeout>(); // rideId -> timeout

export function initSocketIO(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // ─── Auth ────────────────────────────────────────────────────────────────

    socket.on("auth:dispatcher", () => {
      socket.join("dispatchers");
      dispatcherSockets.add(socket.id);
      socket.emit("auth:success", { role: "dispatcher" });
      console.log(`[Socket.IO] Dispatcher connected: ${socket.id}`);
    });

    socket.on("auth:driver", async (data: { token: string }) => {
      try {
        const driver = await getDriverByToken(data.token);
        if (!driver) {
          socket.emit("auth:error", { message: "Invalid token" });
          return;
        }
        socket.join(`driver:${driver.id}`);
        socket.join("drivers");
        driverSockets.set(driver.id, socket.id);
        (socket as any).driverId = driver.id;
        socket.emit("auth:success", { role: "driver", driverId: driver.id });
        console.log(`[Socket.IO] Driver ${driver.id} connected: ${socket.id}`);
      } catch (err) {
        socket.emit("auth:error", { message: "Auth failed" });
      }
    });

    socket.on("auth:client", async (data: { token: string }) => {
      try {
        const client = await getClientByToken(data.token);
        if (!client) {
          socket.emit("auth:error", { message: "Invalid token" });
          return;
        }
        socket.join(`client:${client.id}`);
        socket.join("clients");
        clientSockets.set(client.id, socket.id);
        (socket as any).clientId = client.id;
        socket.emit("auth:success", { role: "client", clientId: client.id });
        console.log(`[Socket.IO] Client ${client.id} connected: ${socket.id}`);
      } catch (err) {
        socket.emit("auth:error", { message: "Auth failed" });
      }
    });

    // ─── Location Updates ─────────────────────────────────────────────────────

    socket.on("location:driver", async (data: { lat: number; lng: number; token: string }) => {
      const driverId = (socket as any).driverId;
      if (!driverId) return;
      await updateDriverLocation(driverId, String(data.lat), String(data.lng));
      // Broadcast to dispatchers
      io?.to("dispatchers").emit("driver:location", {
        driverId,
        lat: data.lat,
        lng: data.lng,
        timestamp: Date.now(),
      });
      // Broadcast to client tracking this driver
      io?.to(`tracking:driver:${driverId}`).emit("driver:location:update", {
        driverId,
        lat: data.lat,
        lng: data.lng,
        timestamp: Date.now(),
      });
    });

    socket.on("location:client", async (data: { lat: number; lng: number }) => {
      const clientId = (socket as any).clientId;
      if (!clientId) {
        console.log(`[Socket.IO] location:client received but clientId not set for socket ${socket.id}`);
        return;
      }
      console.log(`[Socket.IO] Client ${clientId} location update: ${data.lat}, ${data.lng}`);
      await updateClientLocation(clientId, String(data.lat), String(data.lng));
      // Broadcast to dispatchers
      io?.to("dispatchers").emit("client:location", {
        clientId,
        lat: data.lat,
        lng: data.lng,
        timestamp: Date.now(),
      });
      // Also broadcast to driver tracking this client (for active ride)
      io?.to(`tracking:client:${clientId}`).emit("client:location:update", {
        clientId,
        lat: data.lat,
        lng: data.lng,
        timestamp: Date.now(),
      });
    });

    // ─── Client tracking driver ───────────────────────────────────────────────

    socket.on("track:driver", (data: { driverId: number }) => {
      socket.join(`tracking:driver:${data.driverId}`);
    });

    socket.on("untrack:driver", (data: { driverId: number }) => {
      socket.leave(`tracking:driver:${data.driverId}`);
    });

    // ─── Driver tracking client ───────────────────────────────────────────────

    socket.on("track:client", (data: { clientId: number }) => {
      socket.join(`tracking:client:${data.clientId}`);
    });

    socket.on("untrack:client", (data: { clientId: number }) => {
      socket.leave(`tracking:client:${data.clientId}`);
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      dispatcherSockets.delete(socket.id);
      const driverId = (socket as any).driverId;
      if (driverId) driverSockets.delete(driverId);
      const clientId = (socket as any).clientId;
      if (clientId) clientSockets.delete(clientId);
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

// ─── Timeout Management ──────────────────────────────────────────────────────────

export function setRideAcceptanceTimeout(rideId: number, onTimeout: () => void) {
  // Clear existing timeout if any
  if (rideTimeouts.has(rideId)) {
    clearTimeout(rideTimeouts.get(rideId));
  }
  // Set new 30-second timeout
  const timeout = setTimeout(() => {
    console.log(`[Socket.IO] Ride ${rideId} acceptance timeout - auto-reassigning`);
    rideTimeouts.delete(rideId);
    onTimeout();
  }, 30000); // 30 seconds
  rideTimeouts.set(rideId, timeout);
}

export function clearRideAcceptanceTimeout(rideId: number) {
  if (rideTimeouts.has(rideId)) {
    clearTimeout(rideTimeouts.get(rideId));
    rideTimeouts.delete(rideId);
  }
}

// ─── Emit helpers ─────────────────────────────────────────────────────────────

export function emitToDispatchers(event: string, data: unknown) {
  console.log(`[Socket.IO] Emitting to dispatchers: ${event}`, data);
  io?.to("dispatchers").emit(event, data);
}

export function emitToDriver(driverId: number, event: string, data: unknown) {
  io?.to(`driver:${driverId}`).emit(event, data);
}

export function emitToClient(clientId: number, event: string, data: unknown) {
  io?.to(`client:${clientId}`).emit(event, data);
}
