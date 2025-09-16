import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import webpackPaths from '../configs/webpack.paths';

export default function deleteSourceMaps() {
  // Use glob and fs.unlinkSync instead of rimraf
  if (fs.existsSync(webpackPaths.distMainPath)) {
    const files = glob.sync(path.join(webpackPaths.distMainPath, '*.js.map'));
    files.forEach((file) => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (err) {
        // Ignore errors for missing files
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    });
  }
  if (fs.existsSync(webpackPaths.distRendererPath)) {
    const files = glob.sync(
      path.join(webpackPaths.distRendererPath, '*.js.map'),
    );
    files.forEach((file) => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (err) {
        // Ignore errors for missing files
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    });
  }
}
