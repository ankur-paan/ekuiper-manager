import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Safely create prisma client - may fail during build/prerender
function createPrismaClient() {
    try {
        return new PrismaClient();
    } catch (e) {
        console.warn('Failed to create PrismaClient:', e);
        return null;
    }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production' && prisma) {
    globalForPrisma.prisma = prisma;
}
