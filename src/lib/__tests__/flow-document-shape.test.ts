import { createMinimalFlowDocument } from '@/lib/flows/testing/flow-fixtures';
import { validateFlowDocumentShape } from '@/lib/flows/validation/document-shape';

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

describe('validateFlowDocumentShape', () => {
  it('returns no diagnostics for a correct fixture', () => {
    expect(validateFlowDocumentShape(createMinimalFlowDocument())).toEqual([]);
  });

  it('reports a wrong apiVersion', () => {
    const doc = createMinimalFlowDocument();
    const diagnostics = validateFlowDocumentShape({ ...doc, apiVersion: 'v2' });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.some((item) => item.propertyPath === 'apiVersion')).toBe(true);
  });

  it('reports missing metadata, spec, and layout', () => {
    const doc = asRecord(createMinimalFlowDocument());

    const missingMetadata = validateFlowDocumentShape({ ...doc, metadata: undefined });
    expect(missingMetadata.some((item) => item.propertyPath === 'metadata')).toBe(true);

    const missingSpec = validateFlowDocumentShape({ ...doc, spec: undefined });
    expect(missingSpec.some((item) => item.propertyPath === 'spec')).toBe(true);

    const missingLayout = validateFlowDocumentShape({ ...doc, layout: undefined });
    expect(missingLayout.some((item) => item.propertyPath === 'layout')).toBe(true);
  });

  it('reports non-array spec nodes and edges', () => {
    const doc = asRecord(createMinimalFlowDocument());
    const spec = asRecord(doc['spec']);

    const badNodes = validateFlowDocumentShape({
      ...doc,
      spec: { ...spec, nodes: {} },
    });
    expect(badNodes.some((item) => item.propertyPath === 'spec.nodes')).toBe(true);

    const badEdges = validateFlowDocumentShape({
      ...doc,
      spec: { ...spec, edges: 'edge-1' },
    });
    expect(badEdges.some((item) => item.propertyPath === 'spec.edges')).toBe(true);
  });

  it('reports missing required primitive node and edge fields', () => {
    const doc = asRecord(createMinimalFlowDocument());
    const spec = asRecord(doc['spec']);

    const badNode = validateFlowDocumentShape({
      ...doc,
      spec: { ...spec, nodes: [{ type: 'x' }] },
    });
    expect(badNode.length).toBeGreaterThan(0);

    const badEdge = validateFlowDocumentShape({
      ...doc,
      spec: { ...spec, edges: [{ id: 'edge-1' }] },
    });
    expect(badEdge.length).toBeGreaterThan(0);
  });

  it('does not throw for non-object input', () => {
    expect(validateFlowDocumentShape(null)).toHaveLength(1);
    expect(validateFlowDocumentShape('flow')).toHaveLength(1);
    expect(validateFlowDocumentShape([])).toHaveLength(1);
  });

  it('does not mutate its input', () => {
    const doc = createMinimalFlowDocument();
    const snapshot = JSON.stringify(doc);

    validateFlowDocumentShape(doc);

    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
