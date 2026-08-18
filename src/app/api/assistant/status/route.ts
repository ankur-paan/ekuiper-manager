import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, requireUser } from '@/lib/api';
import { getAssistantStatus } from '@/lib/assistant/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    return NextResponse.json(getAssistantStatus(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
