import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EKuiperClient } from '@/lib/ekuiper-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EKuiperClient', () => {
  let client: EKuiperClient;
  const baseUrl = '/api/connections/test-server/ekuiper';

  beforeEach(() => {
    client = new EKuiperClient('test-server');
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create client with connection ID', () => {
      const testClient = new EKuiperClient('my-connection');
      expect(testClient).toBeDefined();
    });
  });

  describe('Streams API', () => {
    it('should list streams', async () => {
      const mockStreams = ['stream1', 'stream2'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStreams),
      });

      const streams = await client.listStreams();
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/streams`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(streams).toEqual(mockStreams);
    });

    it('should get stream details', async () => {
      const mockStream = { name: 'test', sql: 'SELECT * FROM demo' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStream),
      });

      const stream = await client.getStream('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/streams/test`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(stream).toEqual(mockStream);
    });

    it('should create stream', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const sql = 'CREATE STREAM test () WITH (DATASOURCE="demo")';
      await client.createStream(sql);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/streams`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sql }),
        })
      );
    });

    it('should delete stream', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.deleteStream('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/streams/test`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Rules API', () => {
    it('should list rules', async () => {
      const mockRules = [{ id: 'rule1' }, { id: 'rule2' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRules),
      });

      const rules = await client.listRules();
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/rules`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(rules).toEqual(mockRules);
    });

    it('should get rule', async () => {
      const mockRule = { id: 'test', sql: 'SELECT * FROM demo' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRule),
      });

      const rule = await client.getRule('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/rules/test`,
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should create rule', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const ruleConfig = {
        id: 'test-rule',
        sql: 'SELECT * FROM demo',
        actions: [{ log: {} }],
      };

      await client.createRule(ruleConfig);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/rules`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(ruleConfig),
        })
      );
    });

    it('should delete rule', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.deleteRule('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/rules/test`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should start rule', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.startRule('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/rules/test/start`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should stop rule', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.stopRule('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/rules/test/stop`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should restart rule', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.restartRule('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/rules/test/restart`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should get rule status', async () => {
      const mockStatus = { status: 'running', metrics: {} };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const status = await client.getRuleStatus('test');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/rules/test/status`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(status).toEqual(mockStatus);
    });
  });

  describe('Plugins API', () => {
    it('should list plugins by type', async () => {
      const mockPlugins = ['plugin1', 'plugin2'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlugins),
      });

      const plugins = await client.listPlugins('sources');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/plugins/sources`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(plugins).toEqual(mockPlugins);
    });

    it('should register plugin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.registerPlugin('sources', {
        name: 'test-plugin',
        file: 'http://example.com/plugin.zip',
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/plugins/sources`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should delete plugin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.deletePlugin('sources', 'test-plugin');
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/plugins/sources/test-plugin`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Tables API', () => {
    it('should list tables', async () => {
      const mockTables = ['table1', 'table2'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTables),
      });

      const tables = await client.listTables();
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/tables`,
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('Services API', () => {
    it('should list services', async () => {
      const mockServices = ['service1', 'service2'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServices),
      });

      const services = await client.listServices();
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/services`,
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Something went wrong' }),
      });

      await expect(client.listStreams()).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.listStreams()).rejects.toThrow('Network error');
    });
  });

  describe('SQL Execution', () => {
    it('should execute SQL query', async () => {
      const mockResult = [{ value: 1 }, { value: 2 }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const sql = 'SELECT * FROM demo';
      const result = await client.executeSql(sql);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/query`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sql }),
        })
      );
      expect(result).toEqual(mockResult);
    });
  });
});

describe('EKuiperClient URL Construction', () => {
  it('should construct correct base URL', () => {
    const client = new EKuiperClient('server-123');
    // Internal state check via mocked fetch call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });
    
    client.listStreams();
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/connections/server-123/ekuiper/streams',
      expect.any(Object)
    );
  });

  it('should handle special characters in connection ID', () => {
    const client = new EKuiperClient('server-with-special-chars');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });
    
    client.listStreams();
    
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/connections/server-with-special-chars/ekuiper/streams',
      expect.any(Object)
    );
  });
});
