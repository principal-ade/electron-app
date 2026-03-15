#!/usr/bin/env node

/**
 * Rebuild DMGs using hdiutil directly.
 * Works around electron-builder's dmg-builder dropping the Electron Framework binary.
 */
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execAsync = promisify(exec);

async function rebuildDmg(appPath, dmgPath) {
  const appName = path.basename(appPath, ".app");
  const dmgName = path.basename(dmgPath);
  const volName = dmgName.replace(/-arm64\.dmg$/, "").replace(/-x64\.dmg$/, "").replace(/\.dmg$/, "");

  console.log(`\nRebuilding DMG: ${dmgName}`);
  console.log(`  Source: ${appPath}`);
  console.log(`  Volume: ${volName}`);

  // Remove the broken DMG
  if (fs.existsSync(dmgPath)) {
    fs.unlinkSync(dmgPath);
    console.log(`  Removed old DMG`);
  }

  // Create new DMG with hdiutil
  const cmd = `hdiutil create -volname "${volName}" -srcfolder "${appPath}" -ov -format UDZO "${dmgPath}"`;

  try {
    await execAsync(cmd, { shell: true, maxBuffer: 10 * 1024 * 1024 });
    console.log(`  ✓ Created: ${dmgName}`);

    // Verify the framework exists in the new DMG
    const mountOutput = await execAsync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`, { shell: true });
    const volumePath = mountOutput.stdout.split("\t").pop().trim();

    const frameworkPath = path.join(volumePath, `${appName}.app`, "Contents", "Frameworks", "Electron Framework.framework", "Versions", "A", "Electron Framework");

    if (fs.existsSync(frameworkPath)) {
      const stats = fs.statSync(frameworkPath);
      console.log(`  ✓ Verified: Electron Framework (${Math.round(stats.size / 1024 / 1024)}MB)`);
    } else {
      console.error(`  ✗ Warning: Electron Framework still missing!`);
    }

    await execAsync(`hdiutil detach "${volumePath}" -quiet`, { shell: true }).catch(() => {});

  } catch (e) {
    console.error(`  ✗ Failed to create DMG: ${e.message}`);
    throw e;
  }
}

async function main() {
  console.log("\n=== Rebuilding DMGs with hdiutil ===\n");

  const root = path.resolve(__dirname, "..", "..");
  const outDir = path.join(root, "release", "build");

  if (!fs.existsSync(outDir)) {
    console.log("No output directory found");
    return;
  }

  // Find all .app directories and their corresponding DMGs
  const entries = fs.readdirSync(outDir);

  for (const entry of entries) {
    const full = path.join(outDir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory() && (entry.startsWith("mac-") || entry === "mac")) {
      // Look for .app in this directory
      const innerFiles = fs.readdirSync(full);
      for (const inner of innerFiles) {
        if (inner.endsWith(".app")) {
          const appPath = path.join(full, inner);
          const appName = inner.replace(".app", "");

          // Find corresponding DMG(s)
          const arch = entry.replace("mac-", "").replace("mac", "");
          const dmgPattern = arch ? `-${arch}.dmg` : ".dmg";

          for (const dmgEntry of entries) {
            if (dmgEntry.endsWith(".dmg") && dmgEntry.includes(appName.split(" ")[0])) {
              // Check if arch matches
              if (arch && dmgEntry.includes(`-${arch}.dmg`)) {
                await rebuildDmg(appPath, path.join(outDir, dmgEntry));
              } else if (!arch && !dmgEntry.includes("-arm64.dmg") && !dmgEntry.includes("-x64.dmg")) {
                await rebuildDmg(appPath, path.join(outDir, dmgEntry));
              }
            }
          }
        }
      }
    }
  }

  console.log("\n=== DMG Rebuild Complete ===\n");
}

main().catch((e) => {
  console.error("DMG rebuild error:", e);
  process.exit(1);
});
