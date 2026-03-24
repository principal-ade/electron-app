#!/usr/bin/env node

/**
 * Rebuild DMGs using hdiutil directly.
 * Works around electron-builder's dmg-builder dropping the Electron Framework binary.
 * Creates proper installer-style DMG with Applications folder symlink.
 */
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const os = require("os");

const execAsync = promisify(exec);

async function rebuildDmg(appPath, dmgPath) {
  const appName = path.basename(appPath, ".app");
  const appFileName = path.basename(appPath);
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

  // Create a temporary staging folder with app and Applications symlink
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "dmg-staging-"));
  const tempDmgPath = dmgPath.replace(".dmg", "-temp.dmg");

  try {
    // Copy the app to staging
    console.log(`  Staging app...`);
    await execAsync(`cp -R "${appPath}" "${stagingDir}/"`, { shell: true });

    // Create Applications symlink
    await execAsync(`ln -s /Applications "${stagingDir}/Applications"`, { shell: true });
    console.log(`  Created Applications symlink`);

    // Create a temporary writable DMG
    const dmgSize = "500m"; // Will be compressed anyway
    await execAsync(
      `hdiutil create -volname "${volName}" -srcfolder "${stagingDir}" -ov -format UDRW -size ${dmgSize} "${tempDmgPath}"`,
      { shell: true, maxBuffer: 50 * 1024 * 1024 }
    );

    // Mount the writable DMG to customize appearance
    const mountOutput = await execAsync(`hdiutil attach "${tempDmgPath}" -readwrite -noverify -noautoopen`, { shell: true });
    const volumePath = mountOutput.stdout.split("\t").pop().trim();

    console.log(`  Configuring window layout...`);

    // Use AppleScript to set up the DMG window appearance
    const appleScript = `
      tell application "Finder"
        tell disk "${volName}"
          open
          set current view of container window to icon view
          set toolbar visible of container window to false
          set statusbar visible of container window to false
          set the bounds of container window to {100, 100, 640, 400}
          set viewOptions to the icon view options of container window
          set arrangement of viewOptions to not arranged
          set icon size of viewOptions to 80
          set position of item "${appFileName}" of container window to {130, 150}
          set position of item "Applications" of container window to {400, 150}
          close
          open
          update without registering applications
          delay 2
          close
        end tell
      end tell
    `;

    try {
      await execAsync(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`, { shell: true, timeout: 30000 });
      console.log(`  ✓ Window layout configured`);
    } catch (e) {
      console.log(`  ! Window layout partially configured (non-fatal): ${e.message}`);
    }

    // Ensure .DS_Store is written
    await execAsync(`sync`, { shell: true });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Detach the volume
    await execAsync(`hdiutil detach "${volumePath}" -force`, { shell: true }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 500));

    // Convert to compressed read-only DMG
    console.log(`  Compressing DMG...`);
    await execAsync(
      `hdiutil convert "${tempDmgPath}" -format UDZO -o "${dmgPath}"`,
      { shell: true, maxBuffer: 50 * 1024 * 1024 }
    );

    console.log(`  ✓ Created: ${dmgName}`);

    // Verify the framework exists in the new DMG
    const verifyOutput = await execAsync(`hdiutil attach "${dmgPath}" -nobrowse -readonly`, { shell: true });
    const verifyVolumePath = verifyOutput.stdout.split("\t").pop().trim();

    const frameworkPath = path.join(verifyVolumePath, `${appName}.app`, "Contents", "Frameworks", "Electron Framework.framework", "Versions", "A", "Electron Framework");

    if (fs.existsSync(frameworkPath)) {
      const stats = fs.statSync(frameworkPath);
      console.log(`  ✓ Verified: Electron Framework (${Math.round(stats.size / 1024 / 1024)}MB)`);
    } else {
      console.error(`  ✗ Warning: Electron Framework still missing!`);
    }

    // Verify Applications symlink exists
    const appsLink = path.join(verifyVolumePath, "Applications");
    if (fs.existsSync(appsLink)) {
      console.log(`  ✓ Verified: Applications symlink`);
    } else {
      console.error(`  ✗ Warning: Applications symlink missing!`);
    }

    await execAsync(`hdiutil detach "${verifyVolumePath}" -quiet`, { shell: true }).catch(() => {});

  } catch (e) {
    console.error(`  ✗ Failed to create DMG: ${e.message}`);
    throw e;
  } finally {
    // Clean up temporary files
    if (fs.existsSync(tempDmgPath)) {
      fs.unlinkSync(tempDmgPath);
    }
    if (fs.existsSync(stagingDir)) {
      await execAsync(`rm -rf "${stagingDir}"`, { shell: true }).catch(() => {});
    }
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
