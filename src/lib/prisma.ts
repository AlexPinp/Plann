import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing environment variable: DATABASE_URL");
}

// Supabase pooler (port 6543) uses an intermediate CA not in the Node.js default bundle.
// In production, set DATABASE_SSL_REJECT_UNAUTHORIZED=true and provide the CA via
// DATABASE_SSL_CA env var, or use sslmode=require in the connection string with the
// Supabase CA certificate. Local dev keeps rejectUnauthorized off for convenience.
const sslRejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true";
const adapter = new PrismaPg({
  connectionString,
  ssl: { rejectUnauthorized: sslRejectUnauthorized },
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
