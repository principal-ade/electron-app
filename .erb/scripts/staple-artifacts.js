#!/usr/bin/env node

/**
 * Staple notarization tickets to built artifacts (.app, .dmg, .zip)
 */
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execAsync = promisify(exec);

async function staple(targetPath) {
  try {
    console.log(`Stapling: ${targetPath}`);
    await execAsync(`xcrun stapler staple -v "${targetPath}"`, { shell: true });
    console.log(`✓ Stapled: ${path.basename(targetPath)}`);
  } catch (e) {
    console.warn(`Stapling failed for ${targetPath}: ${e?.message || e}`);
  }
}

async function main() {
  const root = path.resolve(__dirname, "..", "..");
  const outDir = path.join(root, "release", "build");
  if (!fs.existsSync(outDir)) {
    console.log("No output directory found to staple");
    return;
  }

  const queue = [];

  const enqueueIfMatch = (p) => {
    if (p.endsWith(".dmg") || p.endsWith(".zip") || p.endsWith(".app")) {
      queue.push(p);
    }
  };

  const entries = fs.readdirSync(outDir);
  for (const entry of entries) {
    const full = path.join(outDir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const inner = fs.readdirSync(full);
      for (const f of inner) enqueueIfMatch(path.join(full, f));
    } else {
      enqueueIfMatch(full);
    }
  }

  if (queue.length === 0) {
    console.log("No .app/.dmg/.zip artifacts found to staple");
    return;
  }

  for (const target of queue) {
    // eslint-disable-next-line no-await-in-loop
    await staple(target);
  }
}

main().catch((e) => {
  console.error("Staple script error:", e);
  process.exit(1);
});


