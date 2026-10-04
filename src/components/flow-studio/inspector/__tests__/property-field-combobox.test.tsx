/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { PropertyField } from '../property-field';
import type { FlowPropertyDefinition } from '@/lib/flows/registry/node-definition';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buildSelectDefinition(optionCount: number): FlowPropertyDefinition {
  return {
    key: 'stream',
    label: 'Stream',
    type: 'select',
    options: Array.from({ length: optionCount }, (_, index) => ({
      label: `Stream ${index + 1}`,
      value: `stream-${index + 1}`,
    })),
  };
}

const mounted: { container: HTMLElement; root: Root }[] = [];

async function renderField(
  definition: FlowPropertyDefinition,
  value: unknown,
  onChange: (next: unknown) => void,
): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(async () => {
    root.render(<PropertyField definition={definition} value={value} onChange={onChange} />);
  });
  return container;
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

afterEach(async () => {
  await act(async () => {
    for (const entry of mounted.splice(0)) {
      entry.root.unmount();
      entry.container.remove();
    }
  });
  jest.restoreAllMocks();
});

describe('UX-0001: searchable select combobox', () => {
  it('shows the current value on the trigger and filters 50 options by typing', async () => {
    const onChange = jest.fn();
    const container = await renderField(buildSelectDefinition(50), 'stream-2', onChange);

    const trigger = container.querySelector('[data-testid="property-field-select-stream"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('role')).toBe('combobox');
    expect(trigger?.textContent).toContain('Stream 2');

    await act(async () => {
      (trigger as HTMLButtonElement).click();
    });
    await flushEffects();

    const search = container.querySelector(
      '[data-testid="property-field-search-stream"]',
    ) as HTMLInputElement | null;
    expect(search).not.toBeNull();
    // Focus moves into the filter field on open.
    expect(document.activeElement).toBe(search);

    await act(async () => {
      search!.focus();
      // React 19 controlled input: set native value then dispatch input.
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'Stream 42');
      search!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('Stream 42');

    await act(async () => {
      (options[0] as HTMLButtonElement).click();
    });
    expect(onChange).toHaveBeenCalledWith('stream-42');
  });

  it('supports keyboard-only use and Escape closes without changing the value', async () => {
    const onChange = jest.fn();
    const container = await renderField(buildSelectDefinition(50), undefined, onChange);

    const trigger = container.querySelector(
      '[data-testid="property-field-select-stream"]',
    ) as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });
    await flushEffects();

    const search = container.querySelector(
      '[data-testid="property-field-search-stream"]',
    ) as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'Stream 7');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const filtered = container.querySelectorAll('[role="option"]');
    expect(filtered.length).toBeGreaterThan(0);

    // ArrowDown + Enter picks the highlighted row.
    await act(async () => {
      search.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
    });
    await act(async () => {
      search.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    // Reopen then Escape: popup closes and no additional change is emitted.
    await act(async () => {
      trigger.click();
    });
    await flushEffects();
    const reopened = container.querySelector(
      '[data-testid="property-field-search-stream"]',
    ) as HTMLInputElement;
    expect(reopened).not.toBeNull();
    await act(async () => {
      reopened.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="property-field-search-stream"]'),
    ).toBeNull();
  });

  it('shows a plain manual input when the option provider request fails', async () => {
    const originalFetch = (globalThis as Record<string, unknown>)['fetch'];
    (globalThis as Record<string, unknown>)['fetch'] = jest
      .fn()
      .mockRejectedValue(new Error('boom'));
    try {
    const onChange = jest.fn();
    const definition: FlowPropertyDefinition = {
      key: 'stream',
      label: 'Stream',
      type: 'select',
      optionsProvider: 'streams',
      options: [{ label: 'Static', value: 'static-1' }],
    };
    const container = await renderField(definition, 'static-1', onChange);
    await flushEffects();

    // Trigger still shows the saved static value.
    const trigger = container.querySelector('[data-testid="property-field-select-stream"]');
    expect(trigger?.textContent).toContain('Static');

    const manual = container.querySelector(
      '[data-testid="property-field-manual-stream"]',
    ) as HTMLInputElement | null;
    expect(manual).not.toBeNull();

    await act(async () => {
      manual!.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(manual, 'typed-by-hand');
      manual!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('typed-by-hand');
    } finally {
      if (originalFetch === undefined) {
        delete (globalThis as Record<string, unknown>)['fetch'];
      } else {
        (globalThis as Record<string, unknown>)['fetch'] = originalFetch;
      }
    }
  });
});
