export function getMode() {
  const host = globalThis.location?.hostname ?? '';
  return host.endsWith('github.io') ? 'cloud' : 'local';
}
