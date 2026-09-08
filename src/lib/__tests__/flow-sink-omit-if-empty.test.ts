import { compileFlowToEkuiperGraph } from '@/lib/flows/compiler/ekuiper/compile-graph';
import type { FlowDocument } from '@/lib/flows/model/flow-document';

/**
 * AC-D003. An idle tumbling window emits an empty batch to the sink every interval, so an
 * idle machine produces steady downstream traffic. eKuiper's common `omitIfEmpty` sink
 * property suppresses exactly that, and no Flow Studio sink exposed it.
 *
 * The property must stay absent from the compiled output unless the user turns it on: an
 * always-emitted `omitIfEmpty: false` would change every existing flow's semantic hash.
 */
function documentWithSink(sinkConfig: Record<string, unknown>): FlowDocument {
  return {
    apiVersion: 'flow.ekuiper-manager.io/v1alpha1',
    metadata: { id: 'flow-1', name: 'Flow' },
    spec: {
      nodes: [
        { id: 'src', type: 'memory-source', typeVersion: 1, name: 'Source', config: { topic: 'in' } },
        { id: 'snk', type: 'memory-sink', typeVersion: 1, name: 'Sink', config: { topic: 'out', ...sinkConfig } },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'src', sourcePortId: 'out', targetNodeId: 'snk', targetPortId: 'in' },
      ],
    },
    layout: { nodes: { src: { x: 0, y: 0 }, snk: { x: 320, y: 0 } }, viewport: { x: 0, y: 0, zoom: 1 } },
  } as FlowDocument;
}

function sinkProps(document: FlowDocument): Record<string, unknown> {
  const result = compileFlowToEkuiperGraph(document);
  if (!result.ok) {
    throw new Error(`compile failed: ${JSON.stringify(result).slice(0, 400)}`);
  }
  const graph = result.artifact.ruleDefinition.graph as {
    nodes: Record<string, { type?: string; props?: Record<string, unknown> }>;
  };
  const sink = Object.values(graph.nodes).find((node) => node.type === 'sink');
  if (!sink) throw new Error(`no sink node in ${JSON.stringify(Object.keys(graph.nodes))}`);
  return sink.props ?? {};
}

describe('sink omitIfEmpty', () => {
  it('is absent when the user has not enabled it', () => {
    expect(sinkProps(documentWithSink({}))).not.toHaveProperty('omitIfEmpty');
  });

  it('is absent when explicitly false, so eKuiper keeps its own default', () => {
    expect(sinkProps(documentWithSink({ omitIfEmpty: false }))).not.toHaveProperty('omitIfEmpty');
  });

  it('is emitted when the user enables it', () => {
    expect(sinkProps(documentWithSink({ omitIfEmpty: true }))).toMatchObject({ omitIfEmpty: true });
  });

  it('ignores a non-boolean value rather than forwarding it', () => {
    expect(sinkProps(documentWithSink({ omitIfEmpty: 'yes' }))).not.toHaveProperty('omitIfEmpty');
  });
});
