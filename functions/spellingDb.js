import { neon } from "@neondatabase/serverless";

export function getDb(env) {
  return neon(env.NEON_URL);
}
