import type { PreparedRequest } from './preparedRequest';

/** No interpolation or parameter guessing: authored :id/{{id}} paths stay intact. */
function routeUrl(url: string): string {
  const address = url.split(/[?#]/, 1)[0];
  if (address.includes('{{')) return address;
  try {
    const parsed = new URL(address);
    return parsed.origin + parsed.pathname;
  } catch {
    return address;
  }
}

export function requestRouteKey(request: PreparedRequest): string {
  return JSON.stringify([
    request.target?.purl ?? null,
    request.target?.identifier ?? null,
    request.request.http.method.toUpperCase(),
    routeUrl(request.request.http.url),
  ]);
}
