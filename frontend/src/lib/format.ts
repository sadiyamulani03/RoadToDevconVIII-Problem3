/** Format milliseconds as m:ss.mmm (e.g. 2350 -> "2.350" / 65430 -> "1:05.430"). */
export function formatTimeMs(timeMs: number): string {
  const ms = Math.max(0, Math.floor(timeMs));
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  return minutes > 0 ? `${minutes}:${ss}.${mmm}` : `${seconds}.${mmm}`;
}

export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function shortHex(bytes: Uint8Array): string {
  let hex = "0x";
  for (let i = 0; i < Math.min(bytes.length, 12); i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  if (bytes.length > 12) hex += `…(${bytes.length} bytes)`;
  return hex;
}

/** Signed delta in ms for race comparisons: negative = faster than ghost. */
export function formatDelta(deltaMs: number): string {
  const sign = deltaMs < 0 ? "−" : "+";
  return `${sign}${formatTimeMs(Math.abs(deltaMs))}`;
}
