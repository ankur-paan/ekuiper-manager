/**
 * Prisma client singleton with safe initialization.
 * 
 * During build/prerender, @prisma/client may not be available if
 * prisma generate hasn't been run. This module gracefully handles
 * that case by returning null.
 * 
 * In production, ensure prisma generate is run before starting the app.
 */

// Type definition for the Prisma client (minimal interface for our use)
interface PrismaClientLike {
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    server: any;
    systemLog: any;
}

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientLike | null | undefined;
};

/**
 * Safely create Prisma client.
 * Returns null if @prisma/client is not available (e.g., during build without prisma generate).
 */
async function createPrismaClient(): Promise<PrismaClientLike | null> {
    try {
        // Dynamic import to handle cases where module isn't generated
        const { PrismaClient } = await import('@prisma/client');
        return new PrismaClient();
    } catch (e) {
        // This is expected during build if prisma generate hasn't been run
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Prisma client not available - database features disabled');
        }
        return null;
    }
}

// For synchronous access, we need to initialize lazily
let prismaPromise: Promise<PrismaClientLike | null> | null = null;

/**
 * Get the Prisma client instance.
 * Returns null if Prisma is not available.
 */
export async function getPrisma(): Promise<PrismaClientLike | null> {
    if (globalForPrisma.prisma !== undefined) {
        return globalForPrisma.prisma;
    }

    if (!prismaPromise) {
        prismaPromise = createPrismaClient().then(client => {
            if (process.env.NODE_ENV !== 'production' && client) {
                globalForPrisma.prisma = client;
            }
            return client;
        });
    }

    return prismaPromise;
}

// For backward compatibility - export a null placeholder
// Consumers should use getPrisma() async function instead
export const prisma = null;
