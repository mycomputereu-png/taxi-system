import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";

// Helper to extract subdomain from host
function getSubdomain(req: any): string | null {
  const host = req.get("host") || "";
  const parts = host.split(".");

  // For localhost:3000 or 127.0.0.1:3000
  if (
    parts.length <= 2 ||
    host.includes("localhost") ||
    host.includes("127.0.0.1")
  ) {
    return null;
  }

  // Extract subdomain (first part before first dot)
  const subdomain = parts[0];

  // Check if it's a valid subdomain (not the main domain)
  if (["client", "driver", "dispatcher"].includes(subdomain)) {
    return subdomain;
  }

  return null;
}

describe("Subdomain Manifest Serving", () => {
  let app: express.Application;
  let server: any;

  beforeAll(() => {
    app = express();

    // Add subdomain detection middleware
    app.use((req, res, next) => {
      (req as any).subdomain = getSubdomain(req);
      next();
    });

    // Mock manifest serving
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

      res.json({
        manifestFile,
        subdomain,
        selected: true,
      });
    });

    server = createServer(app);
  });

  afterAll(() => {
    server.close();
  });

  it("should extract client subdomain from host", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "host") return "client.taxibucovina.eu";
        return "";
      },
    };

    const subdomain = getSubdomain(mockReq);
    expect(subdomain).toBe("client");
  });

  it("should extract driver subdomain from host", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "host") return "driver.taxibucovina.eu";
        return "";
      },
    };

    const subdomain = getSubdomain(mockReq);
    expect(subdomain).toBe("driver");
  });

  it("should extract dispatcher subdomain from host", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "host") return "dispatcher.taxibucovina.eu";
        return "";
      },
    };

    const subdomain = getSubdomain(mockReq);
    expect(subdomain).toBe("dispatcher");
  });

  it("should return null for localhost", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "host") return "localhost:3000";
        return "";
      },
    };

    const subdomain = getSubdomain(mockReq);
    expect(subdomain).toBeNull();
  });

  it("should return null for 127.0.0.1", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "host") return "127.0.0.1:3000";
        return "";
      },
    };

    const subdomain = getSubdomain(mockReq);
    expect(subdomain).toBeNull();
  });

  it("should return null for main domain without subdomain", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "host") return "taxibucovina.eu";
        return "";
      },
    };

    const subdomain = getSubdomain(mockReq);
    expect(subdomain).toBeNull();
  });

  it("should return null for invalid subdomain", () => {
    const mockReq = {
      get: (header: string) => {
        if (header === "host") return "invalid.taxibucovina.eu";
        return "";
      },
    };

    const subdomain = getSubdomain(mockReq);
    expect(subdomain).toBeNull();
  });

  it("should verify manifest files exist", () => {
    const publicDir = path.resolve(
      import.meta.dirname,
      "..",
      "client",
      "public"
    );

    const manifestFiles = [
      "manifest.json",
      "manifest-client.json",
      "manifest-driver.json",
      "manifest-dispatcher.json",
    ];

    for (const file of manifestFiles) {
      const filePath = path.resolve(publicDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it("should verify manifest-client.json has correct structure", () => {
    const publicDir = path.resolve(
      import.meta.dirname,
      "..",
      "client",
      "public"
    );
    const filePath = path.resolve(publicDir, "manifest-client.json");

    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    expect(content.name).toBe("Taxi Bucovina");
    expect(content.start_url).toBe("/client");
    expect(content.scope).toBe("/client");
    expect(content.theme_color).toBe("#2563eb");
  });

  it("should verify manifest-driver.json has correct structure", () => {
    const publicDir = path.resolve(
      import.meta.dirname,
      "..",
      "client",
      "public"
    );
    const filePath = path.resolve(publicDir, "manifest-driver.json");

    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    expect(content.name).toBe("Taxi Bucovina Șofer");
    expect(content.start_url).toBe("/driver");
    expect(content.scope).toBe("/driver");
    expect(content.theme_color).toBe("#dc2626");
  });

  it("should verify manifest-dispatcher.json has correct structure", () => {
    const publicDir = path.resolve(
      import.meta.dirname,
      "..",
      "client",
      "public"
    );
    const filePath = path.resolve(publicDir, "manifest-dispatcher.json");

    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    expect(content.name).toBe("Taxi Bucovina Dispatcher");
    expect(content.start_url).toBe("/dispatcher");
    expect(content.scope).toBe("/dispatcher");
    expect(content.theme_color).toBe("#f59e0b");
  });
});
