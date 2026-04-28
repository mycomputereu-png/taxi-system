export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Get env vars from import.meta.env (Vite) or window (runtime injection)
const getEnvVar = (key: string): string => {
  // First try import.meta.env (Vite build time)
  const viteKey = `VITE_${key}` as const;
  const viteValue = (import.meta.env as any)[viteKey];
  if (viteValue) return viteValue;
  
  // Fallback to window.__ENV__ (runtime injection on Oracle Cloud)
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    return (window as any).__ENV__[key] || '';
  }
  
  // Fallback to hardcoded values for production
  const fallbacks: Record<string, string> = {
    'OAUTH_PORTAL_URL': 'https://manus.im',
    'APP_ID': 'FApkkAp36mtLJRkdYvRwff',
  };
  
  return fallbacks[key] || '';
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = getEnvVar('OAUTH_PORTAL_URL');
  const appId = getEnvVar('APP_ID');
  
  // Get the base domain (remove subdomain if present)
  let redirectOrigin = window.location.origin;
  const hostname = window.location.hostname;
  
  // If we're on a subdomain, redirect to the main domain for OAuth
  // e.g., dispatcher.taxibucovina.eu -> taxibucovina.eu
  if (hostname.includes('.')) {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      // Remove subdomain
      const baseDomain = parts.slice(-2).join('.');
      redirectOrigin = `${window.location.protocol}//${baseDomain}`;
    }
  }
  
  const redirectUri = `${redirectOrigin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
