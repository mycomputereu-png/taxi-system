import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

function getSocket(): Socket {
  if (!globalSocket || !globalSocket.connected) {
    console.log("[useSocket] Creating new Socket.IO connection");
    globalSocket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });
    globalSocket.on("connect", () => {
      console.log("[useSocket] Socket.IO connected:", globalSocket?.id);
    });
    globalSocket.on("disconnect", () => {
      console.log("[useSocket] Socket.IO disconnected");
    });
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = getSocket();
    return () => {
      // Don't disconnect on unmount - keep persistent connection
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    const s = socketRef.current || getSocket();
    console.log(`[useSocket] Emitting ${event}:`, data, "connected:", s.connected);
    s.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    const s = socketRef.current || getSocket();
    console.log(`[useSocket] Listening for ${event}`);
    s.on(event, handler);
    return () => s.off(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    const s = socketRef.current || getSocket();
    if (handler) s.off(event, handler);
    else s.off(event);
  }, []);

  return { emit, on, off, socket: socketRef };
}

export { getSocket };
