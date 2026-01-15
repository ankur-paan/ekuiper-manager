import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Import stores after mocking localStorage
import { 
  useUserPreferencesStore, 
  useSavedConfigurationsStore, 
  useRecentActivityStore 
} from '@/stores/persistence-store';

describe('User Preferences Store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useUserPreferencesStore.setState({
      theme: 'system',
      sidebarCollapsed: false,
      defaultView: 'dashboard',
      editorFontSize: 14,
      autoSaveInterval: 30,
    });
  });

  it('should have default values', () => {
    const { result } = renderHook(() => useUserPreferencesStore());
    
    expect(result.current.theme).toBe('system');
    expect(result.current.sidebarCollapsed).toBe(false);
    expect(result.current.defaultView).toBe('dashboard');
    expect(result.current.editorFontSize).toBe(14);
    expect(result.current.autoSaveInterval).toBe(30);
  });

  it('should update theme preference', () => {
    const { result } = renderHook(() => useUserPreferencesStore());
    
    act(() => {
      result.current.setTheme('dark');
    });
    
    expect(result.current.theme).toBe('dark');
  });

  it('should toggle sidebar collapsed state', () => {
    const { result } = renderHook(() => useUserPreferencesStore());
    
    expect(result.current.sidebarCollapsed).toBe(false);
    
    act(() => {
      result.current.setSidebarCollapsed(true);
    });
    
    expect(result.current.sidebarCollapsed).toBe(true);
  });

  it('should update default view', () => {
    const { result } = renderHook(() => useUserPreferencesStore());
    
    act(() => {
      result.current.setDefaultView('sql-editor');
    });
    
    expect(result.current.defaultView).toBe('sql-editor');
  });

  it('should update editor font size', () => {
    const { result } = renderHook(() => useUserPreferencesStore());
    
    act(() => {
      result.current.setEditorFontSize(16);
    });
    
    expect(result.current.editorFontSize).toBe(16);
  });

  it('should update auto-save interval', () => {
    const { result } = renderHook(() => useUserPreferencesStore());
    
    act(() => {
      result.current.setAutoSaveInterval(60);
    });
    
    expect(result.current.autoSaveInterval).toBe(60);
  });
});

describe('Saved Configurations Store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useSavedConfigurationsStore.setState({
      streams: {},
      rules: {},
      plugins: {},
      templates: {},
      pipelines: {},
    });
  });

  describe('Streams', () => {
    it('should save a stream', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      const streamConfig = {
        name: 'test-stream',
        sql: 'CREATE STREAM test () WITH (DATASOURCE="demo")',
        options: { DATASOURCE: 'demo' },
      };
      
      act(() => {
        result.current.saveStream(streamConfig);
      });
      
      expect(result.current.streams['test-stream']).toBeDefined();
      expect(result.current.streams['test-stream'].name).toBe('test-stream');
    });

    it('should update an existing stream', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      act(() => {
        result.current.saveStream({ name: 'test', sql: 'v1', options: {} });
      });
      
      const originalUpdatedAt = result.current.streams['test'].updatedAt;
      
      // Wait a bit to ensure different timestamp
      setTimeout(() => {
        act(() => {
          result.current.saveStream({ name: 'test', sql: 'v2', options: {} });
        });
        
        expect(result.current.streams['test'].sql).toBe('v2');
        expect(result.current.streams['test'].updatedAt).not.toBe(originalUpdatedAt);
      }, 10);
    });

    it('should delete a stream', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      act(() => {
        result.current.saveStream({ name: 'to-delete', sql: '', options: {} });
      });
      
      expect(result.current.streams['to-delete']).toBeDefined();
      
      act(() => {
        result.current.deleteStream('to-delete');
      });
      
      expect(result.current.streams['to-delete']).toBeUndefined();
    });
  });

  describe('Rules', () => {
    it('should save a rule', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      const ruleConfig = {
        id: 'rule1',
        sql: 'SELECT * FROM demo',
        actions: [{ mqtt: { server: 'tcp://localhost:1883' } }],
      };
      
      act(() => {
        result.current.saveRule(ruleConfig);
      });
      
      expect(result.current.rules['rule1']).toBeDefined();
      expect(result.current.rules['rule1'].sql).toBe('SELECT * FROM demo');
    });

    it('should delete a rule', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      act(() => {
        result.current.saveRule({ id: 'test-rule', sql: '', actions: [] });
        result.current.deleteRule('test-rule');
      });
      
      expect(result.current.rules['test-rule']).toBeUndefined();
    });
  });

  describe('Plugins', () => {
    it('should save a plugin configuration', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      const pluginConfig = {
        name: 'my-plugin',
        type: 'source',
        file: 'plugin.so',
      };
      
      act(() => {
        result.current.savePlugin(pluginConfig);
      });
      
      expect(result.current.plugins['my-plugin']).toBeDefined();
    });

    it('should delete a plugin configuration', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      act(() => {
        result.current.savePlugin({ name: 'test-plugin', type: 'sink', file: '' });
        result.current.deletePlugin('test-plugin');
      });
      
      expect(result.current.plugins['test-plugin']).toBeUndefined();
    });
  });

  describe('Templates', () => {
    it('should save a data template', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      const templateConfig = {
        name: 'json-template',
        template: '{"value": {{.value}}}',
        format: 'json',
      };
      
      act(() => {
        result.current.saveTemplate(templateConfig);
      });
      
      expect(result.current.templates['json-template']).toBeDefined();
    });
  });

  describe('Pipelines', () => {
    it('should save a pipeline', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      const pipelineConfig = {
        name: 'my-pipeline',
        nodes: [],
        edges: [],
      };
      
      act(() => {
        result.current.savePipeline(pipelineConfig);
      });
      
      expect(result.current.pipelines['my-pipeline']).toBeDefined();
    });
  });

  describe('Export/Import', () => {
    it('should export all configurations', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      act(() => {
        result.current.saveStream({ name: 's1', sql: '', options: {} });
        result.current.saveRule({ id: 'r1', sql: '', actions: [] });
      });
      
      const exported = result.current.exportConfigurations();
      
      expect(exported.streams).toBeDefined();
      expect(exported.rules).toBeDefined();
      expect(exported.plugins).toBeDefined();
      expect(exported.templates).toBeDefined();
      expect(exported.pipelines).toBeDefined();
      expect(exported.exportedAt).toBeDefined();
    });

    it('should import configurations', () => {
      const { result } = renderHook(() => useSavedConfigurationsStore());
      
      const importData = {
        streams: {
          'imported-stream': {
            name: 'imported-stream',
            sql: 'CREATE STREAM imported',
            options: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        rules: {},
        plugins: {},
        templates: {},
        pipelines: {},
        exportedAt: new Date().toISOString(),
      };
      
      act(() => {
        result.current.importConfigurations(importData);
      });
      
      expect(result.current.streams['imported-stream']).toBeDefined();
    });
  });
});

describe('Recent Activity Store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useRecentActivityStore.setState({ activities: [] });
  });

  it('should add an activity', () => {
    const { result } = renderHook(() => useRecentActivityStore());
    
    act(() => {
      result.current.addActivity('stream', 'create', 'test-stream', true);
    });
    
    expect(result.current.activities.length).toBe(1);
    expect(result.current.activities[0].resourceType).toBe('stream');
    expect(result.current.activities[0].action).toBe('create');
  });

  it('should add activity with error message', () => {
    const { result } = renderHook(() => useRecentActivityStore());
    
    act(() => {
      result.current.addActivity('rule', 'deploy', 'my-rule', false, 'Connection failed');
    });
    
    expect(result.current.activities[0].success).toBe(false);
    expect(result.current.activities[0].errorMessage).toBe('Connection failed');
  });

  it('should get recent activities', () => {
    const { result } = renderHook(() => useRecentActivityStore());
    
    act(() => {
      result.current.addActivity('stream', 'create', 's1', true);
      result.current.addActivity('rule', 'update', 'r1', true);
      result.current.addActivity('plugin', 'install', 'p1', true);
    });
    
    const recent = result.current.getRecentActivities(2);
    
    expect(recent.length).toBe(2);
    // Most recent first
    expect(recent[0].resourceType).toBe('plugin');
    expect(recent[1].resourceType).toBe('rule');
  });

  it('should clear activities', () => {
    const { result } = renderHook(() => useRecentActivityStore());
    
    act(() => {
      result.current.addActivity('stream', 'create', 'test', true);
      result.current.clearActivities();
    });
    
    expect(result.current.activities.length).toBe(0);
  });

  it('should limit activities to 100', () => {
    const { result } = renderHook(() => useRecentActivityStore());
    
    act(() => {
      for (let i = 0; i < 110; i++) {
        result.current.addActivity('stream', 'create', `stream-${i}`, true);
      }
    });
    
    expect(result.current.activities.length).toBe(100);
    // Should keep most recent
    expect(result.current.activities[0].resourceName).toBe('stream-109');
  });

  it('should generate unique IDs for activities', () => {
    const { result } = renderHook(() => useRecentActivityStore());
    
    act(() => {
      result.current.addActivity('stream', 'create', 's1', true);
      result.current.addActivity('stream', 'create', 's2', true);
    });
    
    const ids = result.current.activities.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
