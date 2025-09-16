import { execSync } from 'child_process';
import fs from 'fs';
import webpackPaths from '../configs/webpack.paths';

const packageJson = JSON.parse(fs.readFileSync(webpackPaths.appPackagePath, 'utf8'));
const { dependencies } = packageJson;

if (
  Object.keys(dependencies || {}).length > 0 &&
  fs.existsSync(webpackPaths.appNodeModulesPath)
) {
  const electronRebuildCmd =
    'npx electron-rebuild --force --types prod,dev,optional --module-dir .';
  execSync(electronRebuildCmd, {
    cwd: webpackPaths.appPath,
    stdio: 'inherit',
  });
}
