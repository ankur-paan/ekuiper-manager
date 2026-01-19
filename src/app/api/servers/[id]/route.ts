import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const prisma = await getPrisma();
    if (!prisma) {
        return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    try {
        const { id } = await params;
        await prisma.server.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete server:', error);
        return NextResponse.json({ error: 'Failed to delete server' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const prisma = await getPrisma();
    if (!prisma) {
        return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    try {
        const { id } = await params;
        const body = await request.json();
        const server = await prisma.server.update({
            where: { id },
            data: body,
        });
        return NextResponse.json(server);
    } catch (error) {
        console.error('Failed to update server:', error);
        return NextResponse.json({ error: 'Failed to update server' }, { status: 500 });
    }
}
