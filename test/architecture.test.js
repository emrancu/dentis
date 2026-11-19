import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/**
 * Code is grouped by part of the app. See agentic-hub/principles.md.
 * - `shared` is the common toolbox and imports nothing else.
 * - A business area (scheduling, knowledge, clinic, calls, agent) may use `shared` and the other business areas.
 * - `admin` and `website` are the two front doors. They use `shared` and the business areas, never each other.
 */
const AREAS = ['scheduling', 'knowledge', 'clinic', 'calls', 'agent'];
const ALLOWED = {
  shared: [],
  ...Object.fromEntries(AREAS.map((a) => [a, ['shared', ...AREAS]])),
  admin: ['shared', ...AREAS],
  website: ['shared', ...AREAS],
};
/** Files that talk to the outside (D1, OpenAI, WebCrypto). Only `index.js` may import them. */
const ADAPTERS = [/\/store\.js$/, /\/elevenlabs-voice\.js$/, /\/openai-brain\.js$/, /\/security\.js$/];
const ROOT_FILES = ['index.js', 'composition.js', 'app.js'];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.js') ? [path] : [];
  });
}

const areaOf = (path) => {
  const [first] = relative(SRC, path).split(sep);
  return first.endsWith('.js') ? 'root' : first;
};
/** Static imports, re-exports, side-effect imports and dynamic import() calls. */
const IMPORT = /(?:^\s*(?:import|export)\b[^'"`;]*?\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/gm;
const importsOf = (path) => [...readFileSync(path, 'utf8').matchAll(IMPORT)].map((m) => m[1]);

describe('code is grouped by part of the app', () => {
  it('every folder in src is a known part', () => {
    const folders = readdirSync(SRC).filter((n) => statSync(join(SRC, n)).isDirectory());
    assert.deepEqual(folders.sort(), Object.keys(ALLOWED).sort());
  });

  for (const [area, allowed] of Object.entries(ALLOWED)) {
    it(`${area} imports only from ${['itself', ...allowed].join(', ')}`, () => {
      for (const file of files(join(SRC, area))) {
        for (const spec of importsOf(file)) {
          if (!spec.startsWith('.')) assert.fail(`${relative(SRC, file)} imports package "${spec}"; the code uses no third-party packages`);
          const target = areaOf(resolve(dirname(file), spec));
          assert.ok(target === area || allowed.includes(target), `${relative(SRC, file)} (${area}) must not import ${spec} (${target})`);
        }
      }
    });
  }

  it('the scan sees real files and imports (guards against a silently empty check)', () => {
    assert.ok(files(join(SRC, 'scheduling')).length > 5);
    assert.ok(importsOf(join(SRC, 'composition.js')).length >= 9);
  });

  it('only index.js imports the outside adapters (D1 stores, OpenAI, WebCrypto)', () => {
    for (const file of files(SRC)) {
      if (relative(SRC, file) === 'index.js') continue;
      for (const spec of importsOf(file)) {
        assert.ok(!ADAPTERS.some((re) => re.test(spec)), `${relative(SRC, file)} must not import the adapter ${spec}`);
      }
    }
  });

  it('only index.js and app.js know the wiring files', () => {
    for (const file of files(SRC)) {
      if (areaOf(file) === 'root') continue;
      for (const spec of importsOf(file)) {
        assert.ok(!ROOT_FILES.some((r) => spec.endsWith(`/${r}`)), `${relative(SRC, file)} must not import ${spec}`);
      }
    }
  });
});
