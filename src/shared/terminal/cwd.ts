/** OSC 7 is untrusted terminal output, never a command or a filesystem action. */
export function isTerminalCwd(cwd: unknown, platform: string): cwd is string {
  return (
    typeof cwd === 'string' &&
    cwd.length > 0 &&
    cwd.length <= 4096 &&
    !/\p{Cc}/u.test(cwd) &&
    (platform === 'win32'
      ? /^[a-z]:[\\/]/i.test(cwd)
      : cwd.startsWith('/') && !cwd.startsWith('//'))
  );
}

/** Accept only absolute file URIs for this machine, with decoded path text. */
export function parseTerminalCwd(
  payload: string,
  localHostname: string,
  platform: string,
): string | null {
  if (
    payload.length > 4096 ||
    !/^file:\/\//i.test(payload) ||
    /[\p{Cc}\\]/u.test(payload)
  ) {
    return null;
  }

  try {
    const uri = new URL(payload);
    if (
      uri.protocol !== 'file:' ||
      uri.username ||
      uri.password ||
      uri.port ||
      uri.search ||
      uri.hash ||
      (uri.hostname &&
        uri.hostname.toLowerCase() !== localHostname.toLowerCase())
    ) {
      return null;
    }

    let cwd = decodeURIComponent(uri.pathname);
    if (platform === 'win32') {
      if (!/^\/[a-z]:\//i.test(cwd)) return null;
      cwd = cwd.slice(1).replace(/\//g, '\\');
    }
    return isTerminalCwd(cwd, platform) ? cwd : null;
  } catch {
    return null;
  }
}
