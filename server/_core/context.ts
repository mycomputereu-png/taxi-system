import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  dispatcherToken?: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let dispatcherToken: string | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Extract dispatcher token from headers if present
  const headerToken = opts.req.headers['x-dispatcher-token'];
  if (headerToken && typeof headerToken === 'string') {
    dispatcherToken = headerToken;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    dispatcherToken,
  };
}
