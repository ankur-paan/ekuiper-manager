import { ApiError } from '@/lib/api';
import { assertSafeNodeDestination } from '@/lib/network';
import { getNodeWithAuthorization } from '@/lib/nodes';
import type { FlowDiagnostic } from '../model/diagnostic';

/**
 * Official eKuiper validation adapter for a compiled Flow artifact (FS-0086).
 *
 * Mirrors the existing `EKuiperClient.validateRule` convention
 * (`src/lib/ekuiper/client.ts`: `POST /rules/validate`, any 2xx means the
 * rule is accepted) but uses the server-side registered-node transport from
 * `src/app/api/ekuiper/[[...path]]/route.ts`:
 * - `getNodeWithAuthorization(targetNodeId)` resolves the registered node
 *   and its stored credential; the caller can never supply a URL.
 * - `assertSafeNodeDestination` enforces the same SSRF boundary.
 *
 * Audited contract: `public/ekuiper-openapi.json` (eKuiper 2.4.1)
 * `POST /rules/validate` takes a `RuleCreateRequest` body (for graph rules
 * `{id, graph}`) and answers HTTP 200 with a text/plain JSON body
 * `{sources, valid: true}` (`RuleValidationResponse`); a body that parses
 * but is invalid answers 400/422.
 *
 * The adapter never deploys: it only POSTs to `/rules/validate` and never
 * calls rule create/update. The compiled `ruleDefinition` is spread into a
 * fresh request body and never mutated.
 */

/** Stable diagnostic code for an eKuiper-side rejection of the artifact. */
export const FLOW_EKUIPER_VALIDATION_FAILED = 'FLOW_EKUIPER_VALIDATION_FAILED' as const;

/** Server path for official rule validation; never caller-supplied. */
export const EKUIPER_RULE_VALIDATION_PATH = '/rules/validate' as const;

/** Upper bound for upstream detail carried into a diagnostic/message. */
export const MAX_EKUIPER_VALIDATION_ERROR_CHARS = 2000 as const;

export interface ValidateCompiledArtifactInput {
  /** Registered managed-node id; never a URL. */
  targetNodeId: unknown;
  /** Deterministic rule id from the compiler artifact. */
  ruleId: unknown;
  /** Compiled eKuiper rule payload (`{graph}` envelope); never mutated. */
  ruleDefinition: unknown;
}

export interface EkuiperValidationSuccess {
  valid: true;
  diagnostics: [];
  sources: string[];
}

export interface EkuiperValidationFailure {
  valid: false;
  diagnostics: [FlowDiagnostic, ...FlowDiagnostic[]];
}

export type EkuiperValidationResult = EkuiperValidationSuccess | EkuiperValidationFailure;

export type EkuiperValidationFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function normalizeRequiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function normalizeRuleDefinition(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('ruleDefinition must be an object');
  }
  return value as Record<string, unknown>;
}

/**
 * Bounds and redacts upstream validation detail before it reaches a
 * diagnostic or thrown server-safe error. The compiled request body is
 * never echoed here; only the bounded upstream response text is carried.
 */
export function sanitizeEkuiperValidationDetail(value: unknown): string {
  let message: string;
  if (value instanceof Error) {
    message = value.message;
  } else if (typeof value === 'string') {
    message = value;
  } else if (value === null || value === undefined) {
    message = 'eKuiper rejected the compiled rule';
  } else {
    try {
      message = JSON.stringify(value);
    } catch {
      message = 'eKuiper rejected the compiled rule';
    }
  }
  message = message.trim();
  if (message.length === 0) {
    message = 'eKuiper rejected the compiled rule';
  }
  message = message
    .replace(
      /("(?:password|passwd|token|authorization|credential|secret|private[_-]?key|api[_-]?key)"\s*:\s*)"(?:\\.|[^"\\])*"/gi,
      '$1"[redacted]"',
    )
    .replace(/(\bBearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]')
    .replace(
      /((?:password|passwd|token|secret|authorization)\s*[:=]\s*)([^\s,;}\]]+)/gi,
      '$1[redacted]',
    )
    .replace(/(https?:\/\/[^\s:/]+:)([^@\s/]+)(@)/gi, '$1[redacted]$3');
  if (message.length > MAX_EKUIPER_VALIDATION_ERROR_CHARS) {
    message = message.slice(0, MAX_EKUIPER_VALIDATION_ERROR_CHARS);
  }
  return message;
}

function readUpstreamDetail(bodyText: string): string | null {
  const trimmed = bodyText.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      for (const key of ['error', 'message']) {
        const entry = record[key];
        if (typeof entry === 'string' && entry.trim().length > 0) {
          return entry;
        }
      }
    }
  } catch {
    // Fall through to raw text; eKuiper 422 bodies are often plain text.
  }
  return trimmed;
}

function toValidationDiagnostic(detail: string | null): FlowDiagnostic {
  const bounded = detail === null ? null : sanitizeEkuiperValidationDetail(detail);
  return {
    code: FLOW_EKUIPER_VALIDATION_FAILED,
    severity: 'error',
    message:
      bounded === null
        ? 'eKuiper rejected the compiled rule.'
        : `eKuiper rejected the compiled rule: ${bounded}`,
  };
}

function readSources(parsed: unknown): string[] {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return [];
  }
  const sources = (parsed as Record<string, unknown>).sources;
  if (!Array.isArray(sources)) return [];
  return sources.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Submit one compiled rule definition to official eKuiper validation on a
 * registered node. Accepts only a registered node id plus the compiled
 * definition; there is no URL/baseUrl/endpoint parameter by design.
 *
 * - HTTP 2xx mirrors `EKuiperClient.validateRule`: the artifact is accepted
 *   (`{valid: true}` with parsed `sources` when present).
 * - HTTP 400/422 means eKuiper parsed the body but judged the rule invalid:
 *   returns `{valid: false}` with one bounded, redacted `FlowDiagnostic`.
 * - Any other HTTP status or transport failure throws a server-safe
 *   `ApiError` (never a diagnostic, never the raw upstream body).
 */
export async function validateCompiledArtifactWithEkuiper(
  input: ValidateCompiledArtifactInput,
  dependencies?: { fetcher?: EkuiperValidationFetcher },
): Promise<EkuiperValidationResult> {
  const targetNodeId = normalizeRequiredText(input.targetNodeId, 'targetNodeId');
  const ruleId = normalizeRequiredText(input.ruleId, 'ruleId');
  const ruleDefinition = normalizeRuleDefinition(input.ruleDefinition);
  const fetcher = dependencies?.fetcher ?? globalThis.fetch.bind(globalThis);

  const { node, authorization } = await getNodeWithAuthorization(targetNodeId);
  const target = new URL(EKUIPER_RULE_VALIDATION_PATH, node.baseUrl);
  await assertSafeNodeDestination(target);

  // Fresh envelope per the audited `RuleCreateRequest` shape for graph
  // rules (`{id, graph}`); the caller's `ruleDefinition` object is only
  // spread, never mutated.
  const requestBody = { id: ruleId, ...ruleDefinition };

  let response: Response;
  try {
    response = await fetcher(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain;q=0.9',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(Number(process.env.EKUIPER_API_TIMEOUT ?? 30_000)),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiError(504, 'eKuiper did not respond in time', 'NODE_TIMEOUT');
    }
    if (error instanceof TypeError) {
      throw new ApiError(502, 'eKuiper could not be reached', 'NODE_UNREACHABLE');
    }
    throw new ApiError(
      502,
      sanitizeEkuiperValidationDetail(error instanceof Error ? error.message : 'eKuiper validation failed'),
      'EKUIPER_VALIDATION_FAILED',
    );
  }

  const bodyText = await response.text().catch(() => '');

  if (response.ok) {
    let parsed: unknown = null;
    try {
      parsed = bodyText.trim().length > 0 ? (JSON.parse(bodyText) as unknown) : null;
    } catch {
      parsed = null;
    }
    return { valid: true, diagnostics: [], sources: readSources(parsed) };
  }

  if (response.status === 400 || response.status === 422) {
    return { valid: false, diagnostics: [toValidationDiagnostic(readUpstreamDetail(bodyText))] };
  }

  throw new ApiError(
    502,
    sanitizeEkuiperValidationDetail(
      `eKuiper validation returned HTTP ${response.status}${readUpstreamDetail(bodyText) ? `: ${readUpstreamDetail(bodyText)}` : ''}`,
    ),
    'EKUIPER_VALIDATION_FAILED',
  );
}
