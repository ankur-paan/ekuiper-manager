import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  readBoundedJsonObject,
  requireUser,
} from '@/lib/api';
import { recordAuditSafely } from '@/lib/audit';
import {
  parseAssistantRequest,
  readAssistantConfig,
  requestAssistantCompletion,
} from '@/lib/assistant/server';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let actorId: string | undefined;
  let pagePath: string | undefined;
  try {
    const user = await requireUser(request);
    actorId = user.id;
    assertSameOrigin(request);
    consumeRateLimit(`assistant:${user.id}`, { limit: 20, windowMs: 60_000 });

    const config = readAssistantConfig();
    if (!config) {
      throw new ApiError(
        503,
        'The AI assistant is not configured by this Manager owner',
        'AI_ASSISTANT_DISABLED',
      );
    }

    const { messages, context } = parseAssistantRequest(await readBoundedJsonObject(request, 64 * 1024));
    pagePath = context.path;
    const completion = await requestAssistantCompletion(config, messages, context);
    recordAuditSafely({
      actorId,
      action: 'assistant.chat',
      resourceType: 'assistant',
      success: true,
      metadata: { pagePath, model: completion.model },
    });
    return NextResponse.json({
      message: completion.content,
      model: completion.model,
      suggestions: completion.suggestions,
    });
  } catch (error) {
    recordAuditSafely({
      actorId,
      action: 'assistant.chat',
      resourceType: 'assistant',
      success: false,
      metadata: {
        pagePath,
        code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
      },
    });
    return apiErrorResponse(error);
  }
}
