import { describe, test, expect } from 'vitest';

type JsonRecord = { [key: string]: unknown };

function collectKeyPaths(value: JsonRecord, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      return collectKeyPaths(nested as JsonRecord, path);
    }
    return [path];
  });
}

const enModules = import.meta.glob('../locales/en/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, JsonRecord>;
const bgModules = import.meta.glob('../locales/bg/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, JsonRecord>;

function namespaceFromPath(path: string): string {
  return path.split('/').pop()!.replace('.json', '');
}

const enByNamespace = new Map(
  Object.entries(enModules).map(([path, module]) => [namespaceFromPath(path), module])
);
const bgByNamespace = new Map(
  Object.entries(bgModules).map(([path, module]) => [namespaceFromPath(path), module])
);

describe('locale parity', () => {
  test('every en namespace has a matching bg namespace, and vice versa', () => {
    expect(new Set(bgByNamespace.keys())).toEqual(new Set(enByNamespace.keys()));
  });

  test.each([...enByNamespace.keys()])('%s namespace has matching keys in en and bg', (namespace: string) => {
    const enKeys = collectKeyPaths(enByNamespace.get(namespace)!).sort();
    const bgKeys = collectKeyPaths(bgByNamespace.get(namespace)!).sort();
    expect(bgKeys).toEqual(enKeys);
  });
});
