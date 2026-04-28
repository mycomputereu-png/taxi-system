import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Subdomain routing helper
function getSubdomain(req: any): string | null {
  const host = req.get('host') || '';
  const parts = host.split('.');
  
  // For localhost:3000 or 127.0.0.1:3000
  if (parts.length <= 2 || host.includes('localhost') || host.includes('127.0.0.1')) {
    return null;
  }
  
  // Extract subdomain (first part before first dot)
  const subdomain = parts[0];
  
  // Check if it's a valid subdomain (not the main domain)
  if (['client', 'driver', 'dispatcher'].includes(subdomain)) {
    return subdomain;
  }
  
  return null;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // Add subdomain detection to request
  app.use((req, res, next) => {
    (req as any).subdomain = getSubdomain(req);
    next();
  });
  
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    const subdomain = (req as any).subdomain;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      
      // Inject Google Maps API configuration into window object
      const googleMapsApiKey = process.env.VITE_FRONTEND_FORGE_API_KEY || "";
      const googleMapsApiUrl = process.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.manus.ai";
      const configScript = `
        <script>
          window.__GOOGLE_MAPS_CONFIG__ = {
            apiKey: "${googleMapsApiKey}",
            apiUrl: "${googleMapsApiUrl}"
          };
        </script>
      `;
      template = template.replace("</head>", `${configScript}</head>`);
      
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Use absolute path to dist/public directory
  // Calculate from current working directory
  const distPath = path.resolve(process.cwd(), "dist/public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Add subdomain detection to request
  app.use((req, res, next) => {
    (req as any).subdomain = getSubdomain(req);
    next();
  });

  // Serve subdomain-specific manifest.json
  app.get("/manifest.json", (req, res) => {
    const subdomain = (req as any).subdomain;
    let manifestFile = "manifest.json";
    
    if (subdomain === "client") {
      manifestFile = "manifest-client.json";
    } else if (subdomain === "driver") {
      manifestFile = "manifest-driver.json";
    } else if (subdomain === "dispatcher") {
      manifestFile = "manifest-dispatcher.json";
    }
    
    const manifestPath = path.resolve(distPath, manifestFile);
    if (fs.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json");
      res.sendFile(manifestPath);
    } else {
      res.status(404).json({ error: "Manifest not found" });
    }
  });

  // Serve static files but exclude index.html so we can inject config
  app.use(express.static(distPath, {
    index: false, // Don't serve index.html automatically
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    
    // Inject Google Maps config into production HTML
    const googleMapsApiKey = process.env.VITE_FRONTEND_FORGE_API_KEY || "";
    const googleMapsApiUrl = process.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.manus.ai";
    
    // Replace placeholders in the config script
    html = html.replace(/%VITE_FRONTEND_FORGE_API_KEY%/g, googleMapsApiKey);
    html = html.replace(/%VITE_FRONTEND_FORGE_API_URL%/g, googleMapsApiUrl);
    
    res.set("Content-Type", "text/html");
    res.send(html);
  });
}
