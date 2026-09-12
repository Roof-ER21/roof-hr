#!/usr/bin/env node
/**
 * Quality ratchet.
 *
 * Roof HR carries inherited lint and type errors. A gate that simply fails on
 * them would be red on its first run, and a gate that is always red is a gate
 * everybody learns to bypass — which is how this repo ended up with a typecheck
 * script and an oxlint config that nobody had run in months.
 *
 * So this does not demand zero. It demands "no worse than the committed
 * baseline", and it rewrites the baseline downward whenever you improve things,
 * so the number can only travel one direction.
 *
 *   node scripts/quality-gate.mjs          # check against the baseline
 *   node scripts/quality-gate.mjs --update # accept the current counts
 *
 * Baseline lives in .quality-baseline.json and is committed.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASELINE = '.quality-baseline.json';
const update = process.argv.includes('--update');

// Both tools exit non-zero when they find something, which is the normal case
// here. Capture stdout only — oxlint writes its summary to stderr, and mixing
// the two produces a string that is not valid JSON.
function run(cmd) {
  try {
    return { out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }), code: 0 };
  } catch (e) {
    return { out: e.stdout ?? '', code: e.status ?? 1 };
  }
}

// oxlint: count severity==="error" from its JSON, not from parsing human output.
function lintErrors() {
  const { out } = run('npx oxlint --format=json');
  try {
    const parsed = JSON.parse(out);
    const diags = parsed.diagnostics ?? parsed;
    return diags.filter((d) => d.severity === 'error').length;
  } catch {
    console.error('quality-gate: could not parse oxlint JSON output');
    process.exit(2);
  }
}

// tsc: count "error TS" lines. tsc exits non-zero, which is expected here.
function typeErrors() {
  const { out } = run('npx tsc --noEmit');
  return (out.match(/error TS\d+/g) ?? []).length;
}

const current = { lintErrors: lintErrors(), typeErrors: typeErrors() };

if (update || !existsSync(BASELINE)) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  console.log('quality-gate: baseline written', current);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
let failed = false;
const improved = {};

for (const key of ['lintErrors', 'typeErrors']) {
  const now = current[key];
  const was = base[key];
  if (now > was) {
    console.error(`quality-gate: ${key} went UP: ${was} -> ${now}`);
    failed = true;
  } else if (now < was) {
    console.log(`quality-gate: ${key} improved: ${was} -> ${now}`);
    improved[key] = now;
  } else {
    console.log(`quality-gate: ${key} holding at ${now}`);
  }
}

if (failed) {
  console.error('\nFix the new errors, or run `npm run gate:update` if you have a reason to accept them.');
  process.exit(1);
}

// Ratchet down automatically so the floor follows the work.
if (Object.keys(improved).length) {
  writeFileSync(BASELINE, JSON.stringify({ ...base, ...improved }, null, 2) + '\n');
  console.log('quality-gate: baseline ratcheted down. Commit .quality-baseline.json');
}
