// Try to import node-pty at runtime without bundling it
// Use eval("require") so webpack does not attempt to bundle the native module
let pty: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dynamicRequire: any = eval('require');
  pty = dynamicRequire('node-pty');
  // Optionally sanity check property to ensure native loaded; if not, fall into catch
  if (!pty) {
    throw new Error('node-pty unresolved');
  }
} catch (error) {
  console.warn('node-pty not available, terminal features will be disabled');
  pty = null;
}

export { pty };
export const isPtyAvailable = (): boolean => pty !== null;
