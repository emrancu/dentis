import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/** Which layers a layer may import from (besides itself). See agentic-hub/principles.md, principle 2. */
const ALLOWED = {
  domain: [],
  application: ['domain'],
  infrastructure: ['domain', 'application'],
  interface: ['domain', 'application'],
};

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.js') ? [path] : [];
  });
}

const layerOf = (path) => relative(SRC, path).split(sep)[0];
/** Static imports, re-exports, side-effect imports and dynamic import() calls. */
const IMPORT = /(?:^\s*(?:import|export)\b[^'"`;]*?\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/gm;
const importsOf = (path) => [...readFileSync(path, 'utf8').matchAll(IMPORT)].map((m) => m[1]);

describe('layer dependencies point inward', () => {
  for (const [layer, allowed] of Object.entries(ALLOWED)) {
    it(`${layer} imports only from ${['itself', ...allowed].join(', ')}`, () => {
      for (const file of files(join(SRC, layer))) {
        for (const spec of importsOf(file)) {
          if (!spec.startsWith('.')) assert.fail(`${relative(SRC, file)} imports package "${spec}"; layers must not use third-party packages`);
          const target = layerOf(resolve(dirname(file), spec));
          assert.ok(target === layer || allowed.includes(target), `${relative(SRC, file)} (${layer}) must not import ${spec} (${target})`);
        }
      }
    });
  }

  it('the scan sees real files and imports (guards against a silently empty check)', () => {
    assert.ok(files(join(SRC, 'domain')).length > 10);
    assert.ok(importsOf(join(SRC, 'composition.js')).length >= 9);
  });

  it('only index.js and composition.js know both adapters and use cases', () => {
    for (const layer of Object.keys(ALLOWED)) {
      for (const file of files(join(SRC, layer))) {
        for (const spec of importsOf(file)) {
          assert.ok(!spec.endsWith('composition.js') && !spec.endsWith('/index.js'), `${relative(SRC, file)} must not import the composition root`);
        }
      }
    }
  });
});
