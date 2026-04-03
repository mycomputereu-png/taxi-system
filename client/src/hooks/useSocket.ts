import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

let globalSocket: Socket | null = null;

function getSocket(): Socket {
  if (!globalSocket || !globalSocket.connected) {
    globalSocket = io(window.location.origin, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
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
    s.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    const s = socketRef.current || getSocket();
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
