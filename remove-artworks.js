// =====================================================================
// remove-artworks.js
// Lists artworks and removes them from artworks.js (optionally deletes
// their image files too).
//
// RUN from the project folder (the one that contains artworks.js):
//   node remove-artworks.js --list                          show all image ids
//   node remove-artworks.js --list --group "Graphic Design" show ids of one group only
//   node remove-artworks.js img-001 img-002                 remove by id
//   node remove-artworks.js --src "Wall Paintings/Taroof"   remove everything in one sub-folder
//   node remove-artworks.js --group "Digital Works"         remove everything in one group
//
// Options:
//   --dry            show what would be removed, change nothing
//   --delete-files   also delete the image files in assets/thumb and assets/full
//                    (without it, only artworks.js is changed; the files stay)
//   --site           folder that contains artworks.js (defaults to the current folder)
//
// Notes:
//   - Group names: "BFA Studio Work", "Digital Works", "Graphic Design", "Wall Paintings"
//   - A backup of artworks.js is saved as artworks.js.bak before every change
//   - Deleting files with --delete-files cannot be undone
// =====================================================================

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    } else args._.push(argv[i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const siteDir = path.resolve(args.site && args.site !== true ? args.site : ".");
const dataFile = path.join(siteDir, "artworks.js");

if (!fs.existsSync(dataFile)) {
  console.error("artworks.js not found: " + dataFile);
  process.exit(1);
}

const text = fs.readFileSync(dataFile, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(text, sandbox);
const all = sandbox.window.ARTWORKS;

const group = args.group && args.group !== true ? args.group : null;
const src = args.src && args.src !== true ? args.src : null;

// ---- Show the list ----
if (args.list) {
  const rows = all.filter((a) => !group || a.group === group);
  rows.forEach((a) => console.log(`${a.id}   [${a.group} / ${a.src_folder}]`));
  console.log(`\nTotal: ${rows.length}`);
  process.exit(0);
}

// ---- Decide which entries to remove ----
const ids = new Set(args._);
const targets = all.filter(
  (a) =>
    ids.has(a.id) ||
    (src && a.src_folder === src) ||
    (group && !src && a.group === group)
);

const unknown = [...ids].filter((id) => !all.some((a) => a.id === id));
if (unknown.length) {
  console.warn("These ids were not found: " + unknown.join(", "));
}

if (targets.length === 0) {
  console.log("Nothing to remove. (To see ids: node remove-artworks.js --list)");
  process.exit(0);
}

console.log("These will be removed:");
targets.forEach((a) => console.log(`  - ${a.id}  [${a.group} / ${a.src_folder}]`));

if (args.dry) {
  console.log(`\n[dry] ${targets.length} item(s) would be removed. Nothing was changed.`);
  process.exit(0);
}

// ---- Cut out only those entries and leave the rest of the text untouched ----
const m = text.match(/^([\s\S]*?\[\n)([\s\S]*?)(\n\];?\s*)$/);
if (!m) {
  console.error("artworks.js is not in the formatted style. Format the file first.");
  process.exit(1);
}
const [, head, body, tail] = m;
const removeIds = new Set(targets.map((t) => t.id));
const kept = body
  .split(/,\n(?=  \{\n)/)
  .filter((chunk) => !removeIds.has(JSON.parse(chunk).id));

fs.copyFileSync(dataFile, dataFile + ".bak");
fs.writeFileSync(dataFile, head + kept.join(",\n") + tail, "utf8");

// ---- Optionally delete the image files too ----
if (args["delete-files"]) {
  for (const a of targets) {
    for (const rel of [a.thumb, a.full]) {
      const p = path.join(siteDir, rel);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log("File deleted: " + rel);
      }
    }
  }
}

console.log(`\nDone: ${targets.length} removed. ${kept.length} remaining.`);
console.log("Backup: " + dataFile + ".bak");
