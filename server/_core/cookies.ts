import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  
  // Determine if we should set a domain for cross-subdomain cookies
  let domain: string | undefined = undefined;
  
  if (hostname && !LOCAL_HOSTS.has(hostname) && !isIpAddress(hostname)) {
    // For production domains, set domain to parent domain to allow subdomains
    // e.g., taxibucovina.eu instead of dispatcher.taxibucovina.eu
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      // Use the last 2 parts (domain.tld) for cookie domain
      domain = "." + parts.slice(-2).join(".");
    }
  }

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
