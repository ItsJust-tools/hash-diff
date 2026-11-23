export const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

export type Algorithm = (typeof ALGORITHMS)[number];

/** Result of hashing one algorithm over one input's bytes. */
export interface DigestResult {
  algorithm: Algorithm;
  /** Lowercase hex digest, empty string when hashing failed. */
  digest: string;
  ok: boolean;
}

/** Per-input computed facts used across the comparison UI. */
export interface InputFacts {
  /** Byte length of the UTF-8 encoded input. */
  byteLength: number;
  /** Number of UTF-16 code units (JavaScript string length). */
  charCount: number;
  digests: Record<Algorithm, DigestResult>;
}

/** Verdict for the whole comparison. */
export type ComparisonVerdict = 'MATCH' | 'MISMATCH' | 'INCOMPLETE';

/** One line of the textual comparison report. */
export interface ReportLine {
  algorithm: Algorithm;
  digestA: string;
  digestB: string;
  match: boolean;
}

/** A saved snapshot from a previous comparison run. */
export interface Snapshot {
  /** Human label, defaults to input B prefix + timestamp. */
  label: string;
  createdAt: string;
  payload: ToolState;
}

/** Serializable state of the Hash Diff tool. */
export interface ToolState {
  /** Left (A) input text. */
  textA: string;
  /** Right (B) input text. */
  textB: string;
  /** Timestamp (ISO) from the last run, used for snapshot labels. */
  lastRunAt: string;
  /** Stored snapshot targets (oldest last, capped at MAX_SNAPSHOTS). */
  snapshots: Snapshot[];
}
