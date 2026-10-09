// =====================================================================
// add-artworks.js
// Adds new images to the gallery: resizes them into assets/thumb and
// assets/full, then appends the new entries to artworks.js.
//
// SETUP (once):
//   npm install sharp
//
// RUN from the project folder (the one that contains artworks.js):
//   node add-artworks.js "D:\new-images" --group "Wall Paintings" --src "Wall Paintings/Taroof"
//
// Preview first (writes nothing):
//   node add-artworks.js "D:\new-images" --group "Wall Paintings" --src "Wall Paintings/Taroof" --dry
//
// Brand-new sub-folder (also set its display name and blurb):
//   node add-artworks.js "D:\new-images" --group "Wall Paintings" --src "Wall Paintings/New Place" --display "New Place" --blurb "Mural for the new place."
//
// Options:
//   --group    (required) group name, e.g. "Wall Paintings", "Digital Works"
//   --src      value stored in src_folder (defaults to the input folder name)
//   --display  display name (defaults to the previous entry with the same src_folder)
//   --blurb    short description (defaults to the previous entry with the same src_folder)
//   --site     folder that contains artworks.js and assets/ (defaults to the current folder)
//   --dry      write nothing, only show what would happen
//
// What it does:
//   1. Creates thumb (longest side 900px) and full (longest side 2400px) for each image
//   2. Creates an 18px placeholder (tiny base64 JPEG)
//   3. Appends the new entries to the end of artworks.js (backup: artworks.js.bak)
//   4. Skips images whose id already exists
// =====================================================================

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const sharp = require("sharp");

// ---- Settings (change if needed) ----
const THUMB_MAX = 900; // longest side of thumb
const FULL_MAX = 2400; // longest side of full (smaller originals are not enlarged)
const PLACEHOLDER_MAX = 18;
const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// ---- Read command-line arguments ----
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

function makeId(filename) {
  return path
    .parse(filename)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeTitle(filename) {
  return path.parse(filename).name.replace(/[_-]+/g, " ").trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputDir = args._[0];
  const group = args.group;

  if (!inputDir || !group || group === true) {
    console.error(
      'Usage: node add-artworks.js "path\\to\\images" --group "Group Name" [--src "..."] [--site "..."] [--dry]'
    );
    process.exit(1);
  }

  const siteDir = path.resolve(args.site && args.site !== true ? args.site : ".");
  const dataFile = path.join(siteDir, "artworks.js");
  const thumbDir = path.join(siteDir, "assets", "thumb");
  const fullDir = path.join(siteDir, "assets", "full");
  const dry = !!args.dry;

  if (!fs.existsSync(dataFile)) {
    console.error("artworks.js not found: " + dataFile);
    process.exit(1);
  }

  // Load the current data
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), sandbox);
  const artworks = sandbox.window.ARTWORKS;
  const existingIds = new Set(artworks.map((a) => a.id));

  const srcFolder =
    args.src && args.src !== true ? args.src : path.basename(path.resolve(inputDir));

  // display and blurb: first from an entry with the same src_folder, otherwise from the same group
  const similar =
    artworks.find((a) => a.group === group && a.src_folder === srcFolder) ||
    artworks.find((a) => a.group === group);
  const display =
    args.display && args.display !== true ? args.display : similar ? similar.display : group;
  const blurb =
    args.blurb && args.blurb !== true ? args.blurb : similar ? similar.blurb : "";
  if (!similar) {
    console.warn(`Warning: no existing group named "${group}". blurb will be empty (you can pass --blurb).`);
  } else if (!artworks.some((a) => a.group === group && a.src_folder === srcFolder)) {
    console.warn(
      `Warning: "${srcFolder}" is a new sub-folder. display ("${display}") and blurb were copied from an earlier entry. Pass --display and --blurb if needed.`
    );
  }

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => EXTS.has(path.extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error("No images found in the folder.");
    process.exit(1);
  }

  if (!dry) {
    fs.mkdirSync(thumbDir, { recursive: true });
    fs.mkdirSync(fullDir, { recursive: true });
  }

  const added = [];
  const skipped = [];

  for (const file of files) {
    const id = makeId(file);
    if (existingIds.has(id)) {
      skipped.push(file);
      continue;
    }

    const src = path.join(inputDir, file);
    const base = sharp(src).rotate(); // apply EXIF rotation

    const { info } = await base.clone().toBuffer({ resolveWithObject: true });
    const ow = info.width;
    const oh = info.height;

    const scale = THUMB_MAX / Math.max(ow, oh);
    const w = Math.round(ow * scale);
    const h = Math.round(oh * scale);

    const thumbPath = path.join(thumbDir, id + ".jpg");
    const fullPath = path.join(fullDir, id + ".jpg");

    if (!dry) {
      await base
        .clone()
        .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(thumbPath);

      await base
        .clone()
        .resize(FULL_MAX, FULL_MAX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toFile(fullPath);
    }

    const tiny = await base
      .clone()
      .resize(PLACEHOLDER_MAX, PLACEHOLDER_MAX, { fit: "inside" })
      .jpeg({ quality: 40 })
      .toBuffer();

    const entry = {
      id,
      title: makeTitle(file),
      display,
      group,
      blurb,
      file,
      thumb: `assets/thumb/${id}.jpg`,
      full: `assets/full/${id}.jpg`,
      w,
      h,
      ow,
      oh,
      aspect: Number((ow / oh).toFixed(4)),
      orientation: ow >= oh ? "landscape" : "portrait",
      placeholder: "data:image/jpeg;base64," + tiny.toString("base64"),
      src_folder: srcFolder,
    };

    existingIds.add(id);
    artworks.push(entry);
    added.push(file);
    console.log(`${dry ? "[dry] Would add" : "Added"}: ${file}  ->  ${id}  (${ow}x${oh})`);
  }

  if (skipped.length) {
    console.log("\nAlready exist, skipped:");
    skipped.forEach((f) => console.log("  - " + f));
  }

  if (added.length === 0) {
    console.log("\nNothing new was added.");
    return;
  }

  if (dry) {
    console.log(`\n[dry] ${added.length} image(s) would be added. Nothing was written.`);
    return;
  }

  // Append the new entries and leave the existing text untouched
  const original = fs.readFileSync(dataFile, "utf8");
  const newEntries = artworks.slice(artworks.length - added.length);
  const block = newEntries
    .map((e) => JSON.stringify(e, null, 2).replace(/^/gm, "  "))
    .join(",\n");

  const closeIdx = original.lastIndexOf("\n]");
  let output;
  if (closeIdx !== -1) {
    output = original.slice(0, closeIdx) + ",\n" + block + original.slice(closeIdx);
  } else {
    // File is not in the formatted style: rewrite the whole file
    output = "window.ARTWORKS = " + JSON.stringify(artworks, null, 2) + ";\n";
  }

  fs.copyFileSync(dataFile, dataFile + ".bak");
  fs.writeFileSync(dataFile, output, "utf8");
  console.log(`\nDone: ${added.length} new image(s) added. Total: ${artworks.length}.`);
  console.log("Backup: " + dataFile + ".bak");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
