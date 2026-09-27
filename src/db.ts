import { PrismaClient } from "@prisma/client";

// Reuse a single client across the app (avoids exhausting DB connections
// during ts-node-dev hot reloads).
export const prisma = new PrismaClient();
