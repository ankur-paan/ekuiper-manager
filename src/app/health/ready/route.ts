import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await query<{ count: string }>(
      'SELECT count(*)::text AS count FROM schema_migrations',
    );
    return NextResponse.json({ status: 'ready', migrations: Number(result.rows[0].count) });
  } catch {
    return NextResponse.json({ status: 'not_ready' }, { status: 503 });
  }
}
