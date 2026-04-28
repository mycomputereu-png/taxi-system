import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initSocketIO } from "../socket";


function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // CORS middleware - allow requests from same domain and subdomains
  app.use((req, res, next) => {
    const origin = req.get('origin');
    
    // When credentials are included, we must use specific origin, not wildcard
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Dispatcher-Token, trpc-batch-mode');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Google Maps proxy - server-side fetch to avoid CORS/auth issues on client
  // MUST be before tRPC middleware to avoid interception
  app.get('/api/maps-js', async (req, res) => {
    try {
      const apiUrl = process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.ai';
      const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'Google Maps API key not configured' });
      }

      const MAPS_PROXY_URL = `${apiUrl}/v1/maps/proxy`;
      const scriptUrl = `${MAPS_PROXY_URL}/maps/api/js?key=${apiKey}&v=weekly&libraries=marker,places,geocoding,geometry`;

      // Server-side fetch - key is already in URL
      const response = await fetch(scriptUrl);

      if (!response.ok) {
        console.error(`[Maps Proxy] Failed to fetch from Forge: ${response.status} - URL: ${scriptUrl}`);
        return res.status(response.status).json({ error: `Failed to load Google Maps: ${response.status}` });
      }

      const scriptContent = await response.text();
      
      // Return with correct content type and cache headers
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.send(scriptContent);
    } catch (error) {
      console.error('[Maps Proxy] Error:', error);
      res.status(500).json({ error: 'Failed to load Google Maps script' });
    }
  });

  // Socket.IO for real-time communication with CORS
  initSocketIO(server);
  
  // tRPC API with CORS headers
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
    console.log(`CORS enabled for all origins`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
