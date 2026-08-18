import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, requireUser } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, { allowPasswordChange: true });
    return NextResponse.json({ user });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
