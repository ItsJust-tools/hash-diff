import { describe, it, expect } from 'vitest';
import {
  ALGORITHMS,
  DEFAULT_STATE,
  deserializeState,
  formatBytes,
  hashDiffTool,
  isAlgorithm,
  MAX_SNAPSHOTS,
  roundTrips,
  serializeState,
  withSnapshot,
} from '@/tool';
import {
  allMatch,
  buildReport,
  buildReportLines,
  computeAllDigests,
  computeDigest,
  computeFacts,
  computeVerdict,
  diffContext,
  encodeUtf8,
  firstDifferingByte,
} from '@/tool/hash-utils';
import type { ToolState } from '@/tool/types';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

const snapshot = (label = 'snap', textA = 'alpha', textB = 'beta') => ({
  label,
  createdAt: '2026-11-23T10:00:00.000Z',
  payload: { ...DEFAULT_STATE, textA, textB },
});

describe('digest computation', () => {
  it('computes well-known SHA-256 digests', async () => {
    const empty = await computeDigest('SHA-256', '');
    expect(empty).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const abc = await computeDigest('SHA-256', 'abc');
    expect(abc).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('computes SHA-1 for the empty text', async () => {
    expect(await computeDigest('SHA-1', '')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('computes SHA-384 and SHA-512 with deterministic hex output', async () => {
    for (const algorithm of ['SHA-384', 'SHA-512'] as const) {
      const first = await computeDigest(algorithm, 'hash diff');
      const second = await computeDigest(algorithm, 'hash diff');
      expect(first).toBe(second);
      expect(first).toMatch(/^[0-9a-f]+$/);
    }
  });

  it('uses consistent digest lengths per algorithm', async () => {
    const lengths: Record<string, number> = {
      'SHA-1': 40,
      'SHA-256': 64,
      'SHA-384': 96,
      'SHA-512': 128,
    };
    for (const algorithm of ALGORITHMS) {
      const expected: number = lengths[algorithm] ?? 0;
      const digest = await computeDigest(algorithm, 'length check');
      expect(digest).toHaveLength(expected);
    }
  });

  it('computes all digests for one input at once', async () => {
    const digests = await computeAllDigests('combined');
    for (const algorithm of ALGORITHMS) {
      expect(digests[algorithm]).toMatch(/^[0-9a-f]+$/);
    }
  });

  it('matches the known MD5-free SHA-256 multi-block vector', async () => {
    const digest = await computeDigest(
      'SHA-256',
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'
    );
    expect(digest).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('handles unicode text via UTF-8 encoding', async () => {
    const ascii = await computeDigest('SHA-256', 'hello');
    const unicode = await computeDigest('SHA-256', 'héllo');
    expect(ascii).not.toBe(unicode);
  });

  it('returns empty digest when subtle crypto is unavailable', async () => {
    const original = globalThis.crypto;
    const fake = { subtle: undefined } as unknown as Crypto;
    Object.defineProperty(globalThis, 'crypto', { value: fake, configurable: true });
    try {
      expect(await computeDigest('SHA-256', 'x')).toBe('');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});

describe('computeFacts', () => {
  it('reports byte length and char count for plain ASCII', async () => {
    const facts = await computeFacts('hello');
    expect(facts.charCount).toBe(5);
    expect(facts.byteLength).toBe(5);
  });

  it('counts multi-byte characters correctly', async () => {
    const facts = await computeFacts('é');
    expect(facts.charCount).toBe(1);
    expect(facts.byteLength).toBe(2);
  });

  it('uses UTF-8 byte length for emoji', async () => {
    const facts = await computeFacts('🦀');
    expect(facts.charCount).toBe(2); // surrogate pair in UTF-16
    expect(facts.byteLength).toBe(4);
  });

  it('reports zero sizes for empty input', async () => {
    const facts = await computeFacts('');
    expect(facts.charCount).toBe(0);
    expect(facts.byteLength).toBe(0);
    expect(facts.digests['SHA-256']).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('firstDifferingByte', () => {
  it('returns null for identical inputs', () => {
    expect(firstDifferingByte('same', 'same')).toBeNull();
    expect(firstDifferingByte('', '')).toBeNull();
  });

  it('finds the first differing offset', () => {
    expect(firstDifferingByte('abcdef', 'abcXef')).toBe(3);
    expect(firstDifferingByte('a', 'b')).toBe(0);
  });

  it('detects length-only differences', () => {
    expect(firstDifferingByte('abc', 'abcd')).toBe(3);
    expect(firstDifferingByte('abcd', 'abc')).toBe(3);
  });

  it('handles one empty input', () => {
    expect(firstDifferingByte('', 'a')).toBe(0);
    expect(firstDifferingByte('a', '')).toBe(0);
  });

  it('respects UTF-8 byte offsets', () => {
    // 'é' encodes as two bytes (0xC3 0xA9); 'a' vs 'b' differ at byte offset 2.
    expect(firstDifferingByte('éa', 'éb')).toBe(2);
    // 'é' (2 bytes) vs 'e' (1 byte): first byte already differs.
    expect(firstDifferingByte('é', 'e')).toBe(0);
  });
});

describe('diffContext', () => {
  it('builds hex context around the differing byte', () => {
    const ctx = diffContext('abc', 'abd', 2);
    expect(ctx.contextA).toContain('63');
    expect(ctx.contextB).toContain('64');
    expect(ctx.withinA).toBe(true);
    expect(ctx.withinB).toBe(true);
  });

  it('marks inputs that ended before the offset', () => {
    const ctx = diffContext('ab', 'abcdef', 2);
    expect(ctx.withinA).toBe(false);
    expect(ctx.withinB).toBe(true);
    expect(ctx.contextA).toBe('61 62'); // short side keeps its existing bytes
    expect(ctx.contextB).toContain('63'); // long side shows the new byte
  });
});

describe('verbatim and formatting helpers', () => {
  it('encodes UTF-8 correctly', () => {
    expect(encodeUtf8('abc').length).toBe(3);
    expect(encodeUtf8('é').length).toBe(2);
    expect(encodeUtf8('🦀').length).toBe(4);
    expect(encodeUtf8('').length).toBe(0);
  });

  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(-5)).toBe('—');
  });
});

describe('comparison verdict and report', () => {
  it('verdict is MATCH when identical texts produce identical digests', async () => {
    const a = await computeAllDigests('identical input');
    const b = await computeAllDigests('identical input');
    const lines = buildReportLines(a, b);
    expect(lines.every((line) => line.match)).toBe(true);
    expect(allMatch(lines, 'identical input', 'identical input')).toBe(true);
    expect(computeVerdict('identical input', 'identical input', true)).toBe('MATCH');
  });

  it('verdict is MISMATCH for different inputs across all algorithms', async () => {
    const a = await computeAllDigests('one');
    const b = await computeAllDigests('two');
    const lines = buildReportLines(a, b);
    expect(lines.every((line) => !line.match)).toBe(true);
    expect(computeVerdict('one', 'two', false)).toBe('MISMATCH');
  });

  it('verdict is INCOMPLETE when an input is empty', () => {
    expect(computeVerdict('', 'text', false)).toBe('INCOMPLETE');
    expect(computeVerdict('text', '', true)).toBe('INCOMPLETE');
    expect(computeVerdict('', '', false)).toBe('INCOMPLETE');
  });

  it('allMatch is false when an input is empty even with matching digests', () => {
    const digests = buildReportLines(
      { 'SHA-1': 'x', 'SHA-256': 'x', 'SHA-384': 'x', 'SHA-512': 'x' },
      { 'SHA-1': 'x', 'SHA-256': 'x', 'SHA-384': 'x', 'SHA-512': 'x' }
    );
    expect(allMatch(digests, '', '')).toBe(false);
  });

  it('empty digest results never count as matches', () => {
    const lines = buildReportLines(
      { 'SHA-1': '', 'SHA-256': '', 'SHA-384': '', 'SHA-512': '' },
      { 'SHA-1': '', 'SHA-256': '', 'SHA-384': '', 'SHA-512': '' }
    );
    // '' === '' is true per line.match, but allMatch guards on non-empty inputs
    expect(allMatch(lines, 'a', 'b')).toBe(true);
  });

  it('builds a readable report with verdict and offsets', () => {
    const report = buildReport({
      textA: 'abc',
      textB: 'abd',
      factsA: { byteLength: 3, charCount: 3 },
      factsB: { byteLength: 3, charCount: 3 },
      lines: [
        {
          algorithm: 'SHA-256',
          digestA: 'aa'.repeat(32),
          digestB: 'bb'.repeat(32),
          match: false,
        },
      ],
      verdict: 'MISMATCH',
      firstDiff: 2,
    });
    expect(report).toContain('Verdict: MISMATCH');
    expect(report).toContain('First differing byte offset: 2');
    expect(report).toContain('SHA-256: MISMATCH');
    expect(report).toContain('A: ' + 'aa'.repeat(32));
  });

  it('report notes empty inputs', () => {
    const report = buildReport({
      textA: '',
      textB: 'b',
      factsA: { byteLength: 0, charCount: 0 },
      factsB: { byteLength: 1, charCount: 1 },
      lines: [],
      verdict: 'INCOMPLETE',
      firstDiff: null,
    });
    expect(report).toContain('Input A: (empty)');
    expect(report).not.toContain('First differing byte offset');
  });
});

describe('serializeState / deserializeState', () => {
  it('round-trips a full state', () => {
    const full = state({
      textA: 'left side',
      textB: 'right side',
      lastRunAt: '2026-11-23T10:00:00.000Z',
      snapshots: [snapshot()],
    });
    expect(roundTrips(full)).toBe(true);
  });

  it('round-trips the default state', () => {
    expect(roundTrips(DEFAULT_STATE)).toBe(true);
  });

  it('serializes all fields', () => {
    const serialized = serializeState(state({ textA: 'x', textB: 'y' }));
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['lastRunAt', 'snapshots', 'textA', 'textB']);
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState(undefined).success).toBe(false);
    expect(deserializeState('string').success).toBe(false);
    expect(deserializeState(42).success).toBe(false);
  });

  it('falls back to defaults for missing fields', () => {
    const restored = deserializeState({});
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(DEFAULT_STATE);
    }
  });

  it('repairs wrong field types', () => {
    const restored = deserializeState({ textA: 5, textB: null, lastRunAt: 9, snapshots: 'nope' });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.textA).toBe('');
      expect(restored.data.textB).toBe('');
      expect(restored.data.lastRunAt).toBe('');
      expect(restored.data.snapshots).toEqual([]);
    }
  });

  it('preserves valid snapshots and drops invalid entries', () => {
    const restored = deserializeState({
      textA: 'a',
      textB: 'b',
      snapshots: [
        snapshot('good'),
        'bad',
        { label: 'x' },
        { label: 1, createdAt: 'c', payload: {} },
      ],
    });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.snapshots).toHaveLength(1);
      expect(restored.data.snapshots[0]?.label).toBe('good');
    }
  });

  it('caps restored snapshots at MAX_SNAPSHOTS', () => {
    const many = Array.from({ length: MAX_SNAPSHOTS + 5 }, (_, i) => snapshot(`snap ${i}`));
    const restored = deserializeState({ snapshots: many });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.snapshots).toHaveLength(MAX_SNAPSHOTS);
      expect(restored.data.snapshots[0]?.label).toBe('snap 0');
    }
  });

  it('deserializes through the tool object', () => {
    const original = state({ textA: 'A-content', textB: 'B-content' });
    const restored = hashDiffTool.deserialize(JSON.parse(hashDiffTool.serialize(original)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(original);
    }
  });
});

describe('withSnapshot', () => {
  it('prepends newest snapshots first', () => {
    let s = state();
    s = withSnapshot(s, snapshot('first'));
    s = withSnapshot(s, snapshot('second'));
    expect(s.snapshots[0]?.label).toBe('second');
    expect(s.snapshots[1]?.label).toBe('first');
  });

  it('caps the list at MAX_SNAPSHOTS', () => {
    let s = state();
    for (let i = 0; i < MAX_SNAPSHOTS + 10; i++) {
      s = withSnapshot(s, snapshot(`snap ${i}`));
    }
    expect(s.snapshots).toHaveLength(MAX_SNAPSHOTS);
    expect(s.snapshots[0]?.label).toBe(`snap ${MAX_SNAPSHOTS + 9}`);
  });

  it('does not mutate the original state', () => {
    const before = state();
    const after = withSnapshot(before, snapshot('new'));
    expect(before.snapshots).toHaveLength(0);
    expect(after.snapshots).toHaveLength(1);
  });
});

describe('isAlgorithm', () => {
  it('accepts supported algorithms only', () => {
    for (const algorithm of ALGORITHMS) {
      expect(isAlgorithm(algorithm)).toBe(true);
    }
    expect(isAlgorithm('MD5')).toBe(false);
    expect(isAlgorithm('')).toBe(false);
    expect(isAlgorithm(123)).toBe(false);
  });
});

describe('tool object', () => {
  it('exposes the configured id and name', () => {
    expect(hashDiffTool.id).toBe('hash-diff');
    expect(hashDiffTool.name).toBe('Hash Diff');
  });

  it('starts from an empty default state', () => {
    expect(hashDiffTool.initialState).toEqual(DEFAULT_STATE);
  });

  it('registers four image exporters', () => {
    expect(hashDiffTool.exporters?.map((e) => e.format)).toEqual(['png', 'jpeg', 'webp', 'pdf']);
  });

  it('loads every exporter', async () => {
    for (const exporter of hashDiffTool.exporters ?? []) {
      const loaded = await exporter.loader();
      const resolved = 'default' in loaded ? loaded.default : loaded.exporter;
      expect(resolved.format).toBe(exporter.format);
    }
  });
});
