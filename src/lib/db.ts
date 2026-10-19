import { PrismaClient } from "@prisma/client";

// One client per process (Next.js dev reloads modules; reuse the client across reloads).
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
