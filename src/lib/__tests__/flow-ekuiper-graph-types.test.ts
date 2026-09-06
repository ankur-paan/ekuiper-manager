import {
  isEkuiperGraphNode,
  isEkuiperGraphRule,
  isEkuiperGraphTopo,
  type EkuiperGraphRule,
} from '@/lib/flows/compiler/ekuiper/graph-types';

/**
 * Minimal graph object whose SHAPE is manually confirmed against the
 * audited contract in `public/ekuiper-openapi.json` (eKuiper 2.4.1):
 * `RuleGraph` requires `nodes` + `topo`; each node entry carries `type`,
 * `nodeType`, `props`; `topo` carries `sources: string[]` and
 * `edges` (node name -> downstream node names).
 *
 * The `type`/`nodeType` string VALUES below are shape-fixture placeholders
 * only. They assert that the fields exist as strings, not that eKuiper
 * ships a node catalog entry with that name; exact catalog mapping is
 * confirmed separately in FS-0074.
 */
const SHAPE_FIXTURE: EkuiperGraphRule = {
  nodes: {
    fixtureSource: {
      type: 'source',
      nodeType: 'fixture-source',
      props: { datasource: 'demo' },
    },
    fixtureSink: {
      type: 'sink',
      nodeType: 'fixture-sink',
      props: {},
    },
  },
  topo: {
    sources: ['fixtureSource'],
    edges: {
      fixtureSource: ['fixtureSink'],
      fixtureSink: [],
    },
  },
};

const NODE_FIELD_ALLOWLIST = new Set(['type', 'nodeType', 'props', 'ui']);

describe('flow eKuiper graph types', () => {
  it('accepts the minimal manually confirmed graph object', () => {
    expect(isEkuiperGraphRule(SHAPE_FIXTURE)).toBe(true);
    expect(isEkuiperGraphTopo(SHAPE_FIXTURE.topo)).toBe(true);
    expect(isEkuiperGraphNode(SHAPE_FIXTURE.nodes.fixtureSource)).toBe(true);
  });

  it('preserves the audited node type/nodeType/props fields', () => {
    const node = SHAPE_FIXTURE.nodes.fixtureSource;
    expect(node.type).toBe('source');
    expect(node.nodeType).toBe('fixture-source');
    expect(node.props).toEqual({ datasource: 'demo' });
  });

  it('preserves topology sources and edges', () => {
    expect(SHAPE_FIXTURE.topo.sources).toEqual(['fixtureSource']);
    expect(SHAPE_FIXTURE.topo.edges).toEqual({
      fixtureSource: ['fixtureSink'],
      fixtureSink: [],
    });
  });

  it('carries no Flow-specific display fields', () => {
    expect('layout' in SHAPE_FIXTURE).toBe(false);
    for (const node of Object.values(SHAPE_FIXTURE.nodes)) {
      for (const key of Object.keys(node)) {
        expect(NODE_FIELD_ALLOWLIST.has(key)).toBe(true);
      }
    }
  });

  it('accepts eKuiper ui metadata without Flow layout content', () => {
    const withUi: EkuiperGraphRule = {
      nodes: {
        fixtureSource: {
          type: 'source',
          nodeType: 'fixture-source',
          props: {},
          ui: {},
        },
      },
      topo: { sources: ['fixtureSource'], edges: { fixtureSource: [] } },
    };

    expect(isEkuiperGraphRule(withUi)).toBe(true);
  });

  it('rejects graphs missing the audited envelope or node fields', () => {
    expect(isEkuiperGraphRule(null)).toBe(false);
    expect(isEkuiperGraphRule({})).toBe(false);
    expect(isEkuiperGraphRule({ nodes: {}, topo: undefined })).toBe(false);
    expect(
      isEkuiperGraphRule({
        nodes: { bad: { type: 'source', props: {} } },
        topo: { sources: [], edges: {} },
      }),
    ).toBe(false);
    expect(
      isEkuiperGraphRule({
        nodes: SHAPE_FIXTURE.nodes,
        topo: {
          sources: ['fixtureSource'],
          edges: { fixtureSource: [42] },
        },
      }),
    ).toBe(false);
  });
});
