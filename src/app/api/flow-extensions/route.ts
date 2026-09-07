import { NextRequest, NextResponse } from 'next/server';
import {
  apiErrorResponse,
  assertSameOrigin,
  requireUser,
} from '@/lib/api';
import { loadAllLocalExtensions } from '@/lib/flows/extensions/load-local-extensions';
import type { FlowExtensionPackage } from '@/lib/flows/extensions/types';
import type { FlowDiagnostic } from '@/lib/flows/model/diagnostic';
import { createBuiltinNodeRegistry } from '@/lib/flows/registry/builtin-registry';
import type { FlowNodeDefinition } from '@/lib/flows/registry/node-definition';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** An extension node descriptor collides on (type, version) and is omitted. */
const FLOW_EXTENSION_NODE_COLLISION = 'FLOW_EXTENSION_NODE_COLLISION' as const;

interface FlowExtensionSummary {
  id: string;
  name: string;
  version: string;
  nodes: FlowNodeDefinition[];
}

/**
 * Omit one colliding extension package with a safe diagnostic.
 *
 * Pre-checks every descriptor of the package against the registry plus a
 * within-package identity set before registering anything, so a colliding
 * package never partially registers. Returns true when the whole package
 * was registered, false when it was omitted (diagnostic appended).
 */
function tryRegisterExtensionPackage(
  registry: ReturnType<typeof createBuiltinNodeRegistry>,
  extensionPackage: FlowExtensionPackage,
  diagnostics: FlowDiagnostic[],
): boolean {
  const extensionId = extensionPackage.manifest.id;
  const seen = new Set<string>();
  for (const definition of extensionPackage.nodes) {
    const key = `${definition.type}@${definition.version}`;
    if (seen.has(key) || registry.has(definition.type, definition.version)) {
      diagnostics.push({
        code: FLOW_EXTENSION_NODE_COLLISION,
        severity: 'error',
        message:
          `Extension "${extensionId}" node type="${definition.type}" version=${definition.version} ` +
          `collides with an existing definition and was omitted. ` +
          `Extension definitions cannot override built-ins or each other.`,
        propertyPath: extensionId,
      });
      return false;
    }
    seen.add(key);
  }
  for (const definition of extensionPackage.nodes) {
    registry.register(definition);
  }
  return true;
}

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    // Read-only GET follows the existing flow-route convention (auth is
    // mandatory). When the caller sends an Origin header, enforce the
    // same same-origin boundary as mutating flow routes.
    if (request.headers.get('origin') !== null) {
      assertSameOrigin(request);
    }
    const loaded = await loadAllLocalExtensions();
    const registry = createBuiltinNodeRegistry();
    const diagnostics: FlowDiagnostic[] = [...loaded.diagnostics];
    const extensions: FlowExtensionSummary[] = [];
    for (const extensionPackage of loaded.extensions) {
      if (!tryRegisterExtensionPackage(registry, extensionPackage, diagnostics)) {
        continue;
      }
      // Safe editor payload only: extension identity plus node definition
      // data. The manifest's package-relative descriptor paths and every
      // server filesystem path stay server-side by design.
      extensions.push({
        id: extensionPackage.manifest.id,
        name: extensionPackage.manifest.name,
        version: extensionPackage.manifest.version,
        nodes: extensionPackage.nodes,
      });
    }
    return NextResponse.json({ extensions, diagnostics });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
