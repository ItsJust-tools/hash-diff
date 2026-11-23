import { ALGORITHMS, type Algorithm, type ComparisonVerdict, type ReportLine } from './types';

export { ALGORITHMS };
export type { Algorithm, ComparisonVerdict, ReportLine };

/** Encode a JavaScript string as UTF-8 bytes. */
export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
}

/** Human-readable byte size, e.g. "12 B", "1.5 KB", "3.2 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    unit = units[i + 1];
    i++;
  }
  return `${Number(value.toFixed(2))} ${unit}`;
}

/** Hex encoding of arbitrary bytes. */
export function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/** Compute a single digest via the Web Crypto API. Resolves to '' when the algorithm is unavailable. */
export async function computeDigest(algorithm: Algorithm, text: string): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return '';
    const data = encodeUtf8(text);
    const buffer = await subtle.digest(algorithm, data.buffer as ArrayBuffer);
    return toHex(buffer);
  } catch {
    return '';
  }
}

/** Digests for one input across all supported algorithms. */
export async function computeAllDigests(text: string): Promise<Record<Algorithm, string>> {
  const entries = await Promise.all(
    ALGORITHMS.map(async (algorithm) => [algorithm, await computeDigest(algorithm, text)] as const)
  );
  return Object.fromEntries(entries) as Record<Algorithm, string>;
}

/** Facts (byte length, char count, digests) for one input. */
export async function computeFacts(
  text: string
): Promise<{ byteLength: number; charCount: number; digests: Record<Algorithm, string> }> {
  const digests = await computeAllDigests(text);
  return {
    byteLength: encodeUtf8(text).byteLength,
    charCount: text.length,
    digests,
  };
}

/** First differing byte offset (0-based) between two UTF-8 encodings, or null when equal. */
export function firstDifferingByte(a: string, b: string): number | null {
  const bytesA = encodeUtf8(a);
  const bytesB = encodeUtf8(b);
  const max = Math.max(bytesA.length, bytesB.length);
  for (let i = 0; i < max; i++) {
    const left = bytesA[i];
    const right = bytesB[i];
    if (left !== right) {
      const min = Math.min(bytesA.length, bytesB.length);
      return i >= min ? min : i;
    }
  }
  return null;
}

/** Build context windows (hex byte slices) around a differing offset. */
export function diffContext(
  a: string,
  b: string,
  offset: number,
  radius = 8
): { contextA: string; contextB: string; withinA: boolean; withinB: boolean } {
  const bytesA = encodeUtf8(a);
  const bytesB = encodeUtf8(b);
  const start = Math.max(0, offset - radius);
  const end = Math.min(Math.max(bytesA.length, bytesB.length), offset + radius + 1);
  const hex = (bytes: Uint8Array): string =>
    Array.from(bytes.slice(start, end))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join(' ');
  return {
    contextA: hex(bytesA),
    contextB: hex(bytesB),
    withinA: offset < bytesA.length,
    withinB: offset < bytesB.length,
  };
}

/** Verdict for a comparison: MATCH, MISMATCH, or INCOMPLETE when an input is empty. */
export function computeVerdict(textA: string, textB: string, matches: boolean): ComparisonVerdict {
  if (!textA || !textB) return 'INCOMPLETE';
  return matches ? 'MATCH' : 'MISMATCH';
}

/** Per-algorithm report lines for the current comparison. */
export function buildReportLines(
  digestsA: Record<Algorithm, string>,
  digestsB: Record<Algorithm, string>
): ReportLine[] {
  return ALGORITHMS.map((algorithm) => ({
    algorithm,
    digestA: digestsA[algorithm],
    digestB: digestsB[algorithm],
    match: digestsA[algorithm] === digestsB[algorithm],
  }));
}

/** True when every algorithm matched and both inputs are non-empty. */
export function allMatch(lines: ReportLine[], textA: string, textB: string): boolean {
  if (!textA || !textB) return false;
  return lines.length > 0 && lines.every((line) => line.match);
}

/** Build the full multi-line copy/share report text. */
export function buildReport(params: {
  textA: string;
  textB: string;
  factsA: { byteLength: number; charCount: number };
  factsB: { byteLength: number; charCount: number };
  lines: ReportLine[];
  verdict: ComparisonVerdict;
  firstDiff: number | null;
}): string {
  const { textA, textB, factsA, factsB, lines, verdict, firstDiff } = params;
  const out: string[] = [];
  out.push('Hash Diff Report');
  out.push(`Verdict: ${verdict}`);
  out.push('Input A:');
  out.push(`  characters: ${factsA.charCount}`);
  out.push(`  bytes (UTF-8): ${factsA.byteLength}`);
  out.push('Input B:');
  out.push(`  characters: ${factsB.charCount}`);
  out.push(`  bytes (UTF-8): ${factsB.byteLength}`);
  if (firstDiff !== null) {
    out.push(`First differing byte offset: ${firstDiff}`);
  }
  if (!textA) out.push('Input A: (empty)');
  if (!textB) out.push('Input B: (empty)');
  out.push('Digests:');
  for (const line of lines) {
    out.push(
      `  ${line.algorithm}: ${line.match ? 'MATCH' : 'MISMATCH'}\n    A: ${line.digestA || '(unavailable)'}\n    B: ${line.digestB || '(unavailable)'}`
    );
  }
  out.push('Generated by Hash Diff — fully client-side comparison.');
  return out.join('\n');
}
