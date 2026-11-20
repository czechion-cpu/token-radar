// Token Radar's entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), scores every
// rankable pre-token protocol with the comparable-multiples model in lib/model.ts, writes the
// ranked board to /output/board.json, writes the dashboard's data as /output/data.js, copies this
// repository's dashboard/ and screenshots/ to /output, and writes /output/dossier.json with the
// vendored make.fun library, so the gate can rebuild it byte for byte.
//
// The run is deterministic: the same snapshot bytes always produce the same /output bytes, because
// every sort has a slug tie-break, every number is rounded the same way, and nothing reads the
// clock, the network or a random source.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the dossier's bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

/** Whether `bytes` open as a PNG or a JPEG: the dossier takes nothing else. */
function imageType(bytes: Uint8Array): 'png' | 'jpeg' | null {
  const opensWith = (magic: readonly number[]): boolean =>
    bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);
  if (opensWith(PNG_MAGIC)) return 'png';
  if (opensWith(JPEG_MAGIC)) return 'jpeg';
  return null;
}

/**
 * The screenshots this run hands in, checked before anything is written: 3 or 4 of them,
 * each a whole PNG or JPEG inside the dossier's byte cap, each with a name the dossier
 * takes. A bad screenshots/ used to fail only at the dossier, after board.json, data.js
 * and the dashboard were already written; now it fails here, with the file named.
 */
function validateScreenshots(dir: string): void {
  if (!existsSync(dir)) {
    process.stderr.write(`token radar: no screenshots/ directory: hand in 3 images, the board, a detail view and a filtered view\n`);
    process.exit(1);
  }
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  if (names.length < 3) {
    process.stderr.write(`token radar: screenshots/ holds ${names.length} image${names.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
    process.exit(1);
  }
  if (names.length > SCREENSHOT_CAPS.max) {
    process.stderr.write(`token radar: screenshots/ holds ${names.length} images, over the ${SCREENSHOT_CAPS.max} the dossier takes\n`);
    process.exit(1);
  }
  for (const name of names) {
    if (!IMAGE_NAME.test(name)) {
      process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
      process.exit(1);
    }
    const bytes = readFileSync(join(dir, name));
    if (imageType(bytes) === null) {
      process.stderr.write(`token radar: screenshots/${name} is neither a PNG nor a JPEG\n`);
      process.exit(1);
    }
    if (bytes.length > SCREENSHOT_CAPS.max_bytes) {
      process.stderr.write(`token radar: screenshots/${name} is ${bytes.length} bytes, over the ${SCREENSHOT_CAPS.max_bytes} the dossier takes\n`);
      process.exit(1);
    }
  }
}

validateScreenshots(join(here, 'screenshots'));

// A run owns its output directory: drop what an earlier run left, so this run's /output
// depends only on this run's inputs and never on a stale board, dashboard or screenshot.
for (const owned of ['board.json', 'data.js', 'dashboard', 'screenshots', 'dossier.json']) {
  rmSync(join(out, owned), { recursive: true, force: true });
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: SCREENSHOT_CAPS,
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside, ${radar.set_aside_size} set aside)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
