// Turns the raw coverage of the workouts (coverage/raw/*.json) into line
// coverage per puzzle and for the shared code in src/.
//
//   node tests/coverage-report.js            table, worst first
//   node tests/coverage-report.js masyu      also list the missed lines
//
// Writes coverage/summary.txt and coverage/missed.txt (all missed lines).
// A line counts as run if any of its code ran. Comment and blank lines
// and lines with only brackets do not count.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const RAW = path.join(root, 'coverage', 'raw');

// Per file: one flag per character, true = this code ran.
const files = new Map(); // url -> { source, ran: Uint8Array }

function paint(entry) {
  const { url, source, functions } = entry;
  if (typeof source !== 'string') return;
  // Only runs of the current file count (older runs saw older code).
  const disk = path.join(root, url);
  if (!fs.existsSync(disk) || fs.readFileSync(disk, 'utf8') !== source) return;
  const count = new Int32Array(source.length).fill(1);
  // Outer ranges first, inner ranges last: the innermost range wins.
  const ranges = functions.flatMap((f) => f.ranges).sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
  for (const r of ranges) count.fill(r.count, r.startOffset, Math.min(r.endOffset, source.length));
  let f = files.get(url);
  if (!f) { f = { source, ran: new Uint8Array(source.length) }; files.set(url, f); }
  if (f.source !== source) return; // file changed between runs
  for (let i = 0; i < source.length; i++) if (count[i] > 0) f.ran[i] = 1;
}

// Code lines and whether each ran.
function lines(f) {
  const out = [];
  let pos = 0, inComment = false;
  for (const [i, text] of f.source.split('\n').entries()) {
    const start = pos;
    pos += text.length + 1;
    let code = text;
    if (inComment) {
      const e = code.indexOf('*/');
      if (e < 0) continue;
      inComment = false;
      code = ' '.repeat(e + 2) + code.slice(e + 2);
    }
    const b = code.indexOf('/*');
    if (b >= 0 && code.indexOf('*/', b) < 0) { inComment = true; code = code.slice(0, b); }
    code = code.replace(/\/\/.*$/, (m) => (/['"`]/.test(m) ? m : ''));
    if (!/[A-Za-z0-9_$'"`]/.test(code)) continue; // blank, comment or brackets only
    let ran = false;
    for (let c = 0; c < code.length && !ran; c++) if (code[c].trim() && f.ran[start + c]) ran = true;
    out.push({ line: i + 1, ran, text: text.trim() });
  }
  return out;
}

function main() {
  const raws = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter((f) => f.endsWith('.json')) : [];
  if (!raws.length) { console.log('No coverage data. Run: npm run test:coverage'); process.exit(1); }
  for (const f of raws) for (const e of JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'))) paint(e);

  const stats = new Map(); // group -> { total, ran, missed: [] }
  const add = (group, url, ls) => {
    const s = stats.get(group) || { total: 0, ran: 0, missed: [] };
    for (const l of ls) {
      s.total++;
      if (l.ran) s.ran++; else s.missed.push(`${url}:${l.line}  ${l.text.slice(0, 100)}`);
    }
    stats.set(group, s);
  };
  for (const [url, f] of files) {
    const group = url.startsWith('src/') ? 'src (shared)' : url.split('/')[0];
    add(group, url, lines(f));
  }
  const rows = [...stats].map(([g, s]) => ({ g, ...s, pct: s.total ? (100 * s.ran) / s.total : 100 }))
    .sort((a, b) => a.pct - b.pct || a.g.localeCompare(b.g));
  const all = rows.reduce((a, r) => ({ total: a.total + r.total, ran: a.ran + r.ran }), { total: 0, ran: 0 });
  const table = rows.map((r) => `${r.pct.toFixed(1).padStart(6)}%  ${String(r.total - r.ran).padStart(4)} missed  ${r.g}`);
  const full = rows.filter((r) => r.ran === r.total).length;
  const head = `Line coverage: ${((100 * all.ran) / all.total).toFixed(2)}% (${all.ran}/${all.total} lines), ${full}/${rows.length} groups at 100%`;
  fs.writeFileSync(path.join(root, 'coverage', 'summary.txt'), head + '\n' + table.join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'coverage', 'missed.txt'), rows.flatMap((r) => r.missed).join('\n') + '\n');
  console.log(head);
  const show = process.argv.slice(2);
  if (show.length) for (const g of show) console.log((stats.get(g) || { missed: [] }).missed.join('\n'));
  else console.log(table.filter((t) => !t.startsWith('100.0')).slice(0, 40).join('\n'));
}

main();
