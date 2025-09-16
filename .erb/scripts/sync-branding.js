#!/usr/bin/env node

/**
 * Syncs branding configuration from the core library to the electron app
 * This ensures consistent branding across all configurations
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Import branding from core
const coreBrandingPath = path.join(__dirname, '../../../core/src/constants/branding.ts');
const coreBrandingContent = fs.readFileSync(coreBrandingPath, 'utf8');

// Parse the branding constants from TypeScript
// This is a simple parser - for production, consider using a proper TypeScript parser
const brandingMatch = coreBrandingContent.match(/export const BRANDING = {([^}]+)}/s);
if (!brandingMatch) {
  console.error('Could not parse BRANDING from core');
  process.exit(1);
}

// Extract key branding values
const extractValue = (key) => {
  const regex = new RegExp(`${key}:\\s*['"]([^'"]+)['"]`);
  const match = brandingMatch[1].match(regex);
  return match ? match[1] : null;
};

const branding = {
  companyName: extractValue('COMPANY_NAME'),
  productName: extractValue('PRODUCT_NAME'),
  appName: extractValue('APP_NAME'),
  appVersion: extractValue('APP_VERSION'),
};

console.log('Extracted branding from core:', branding);

// For this electron app, we want to use custom branding
// You can modify this mapping as needed
const electronBranding = {
  productName: 'Specktor',  // Override with custom name
  appId: 'com.a24z.specktor',
  copyright: `Copyright © ${new Date().getFullYear()} Specktor`,
  companyName: 'Specktor',
};

console.log('Using electron branding:', electronBranding);

// Update package.json
const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

packageJson.build.productName = electronBranding.productName;
packageJson.build.appId = electronBranding.appId;
packageJson.build.copyright = electronBranding.copyright;

if (packageJson.build.win) {
  packageJson.build.win.legalTrademarks = electronBranding.copyright;
}

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✓ Updated package.json');

// Update electron-builder-fix.yml
const ymlPath = path.join(__dirname, '../../electron-builder-fix.yml');
if (fs.existsSync(ymlPath)) {
  const ymlContent = yaml.load(fs.readFileSync(ymlPath, 'utf8'));
  ymlContent.productName = electronBranding.productName;
  ymlContent.appId = electronBranding.appId;
  
  fs.writeFileSync(ymlPath, yaml.dump(ymlContent));
  console.log('✓ Updated electron-builder-fix.yml');
}

// Update hardcoded strings in source files
const replacements = [
  {
    file: path.join(__dirname, '../../src/main/menu.ts'),
    replacements: [
      { from: /label:\s*'principle\.md'/g, to: `label: '${electronBranding.productName}'` },
      { from: /About principle\.md/g, to: `About ${electronBranding.productName}` },
      { from: /Hide principle\.md/g, to: `Hide ${electronBranding.productName}` },
    ]
  },
  {
    file: path.join(__dirname, '../../src/renderer/index.ejs'),
    replacements: [
      { from: /<title>principle\.md<\/title>/g, to: `<title>${electronBranding.productName}</title>` }
    ]
  },
  {
    file: path.join(__dirname, '../../src/renderer/components/landing-page/SettingsModal.tsx'),
    replacements: [
      { from: /About principle\.md/g, to: `About ${electronBranding.productName}` },
      { from: />\s*principle\.md\s*</g, to: `>${electronBranding.productName}<` }
    ]
  },
  {
    file: path.join(__dirname, '../../src/main/window/specialWindows.ts'),
    replacements: [
      { from: /title:\s*'Talk to Principle/g, to: `title: 'Talk to ${electronBranding.productName}` },
      { from: /title:\s*`Principle View/g, to: `title: \`${electronBranding.productName} View` }
    ]
  },
  {
    file: path.join(__dirname, '../../src/main/services/ai/aiService.ts'),
    replacements: [
      { from: /'X-Title':\s*'Principle MD'/g, to: `'X-Title': '${electronBranding.productName}'` }
    ]
  }
];

replacements.forEach(({ file, replacements }) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    replacements.forEach(({ from, to }) => {
      const newContent = content.replace(from, to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(file, content);
      console.log(`✓ Updated ${path.basename(file)}`);
    }
  }
});

console.log('\n✨ Branding sync complete!');
console.log('Next steps:');
console.log('1. Review the changes');
console.log('2. Clean build directory: rm -rf release/build');
console.log('3. Rebuild the application');