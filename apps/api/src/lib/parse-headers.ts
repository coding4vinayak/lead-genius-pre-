export function parseHeaders(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = raw.split('\n');
  let currentKey = '';

  for (let line of lines) {
    line = line.replace(/\r$/, '');
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (currentKey) {
        result[currentKey] += ' ' + line.trim();
      }
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    currentKey = key;
    result[key] = val;
  }

  return result;
}
