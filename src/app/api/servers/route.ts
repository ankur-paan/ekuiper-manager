import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    if (!prisma) {
        return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    try {
        const servers = await prisma.server.findMany({
            orderBy: { createdAt: 'asc' },
        });
        return NextResponse.json(servers);
    } catch (error) {
        console.error('Failed to fetch servers:', error);
        return NextResponse.json({ error: 'Failed to fetch servers' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!prisma) {
        return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    try {
        const body = await request.json();
        const { name, url, description } = body;

        // Basic validation
        if (!name || !url) {
            return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
        }

        const server = await prisma.server.create({
            data: {
                name,
                url,
                description,
                status: 'unknown',
            },
        });

        return NextResponse.json(server);
    } catch (error) {
        console.error('Failed to create server:', error);
        return NextResponse.json({ error: 'Failed to create server' }, { status: 500 });
    }
}
