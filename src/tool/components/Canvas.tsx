'use client';

import React from 'react';
import {
  ALGORITHMS,
  buildReport,
  buildReportLines,
  computeVerdict,
  diffContext,
  firstDifferingByte,
  formatBytes,
  type Algorithm,
  type ComparisonVerdict,
  type ReportLine,
} from '../hash-utils';
import type { ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
}

const textareaClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

const VERDICT_TESTIDS: Record<ComparisonVerdict, string> = {
  MATCH: 'verdict-match',
  MISMATCH: 'verdict-mismatch',
  INCOMPLETE: 'verdict-incomplete',
};

const VERDICT_CLASSES: Record<ComparisonVerdict, string> = {
  MATCH: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  MISMATCH: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  INCOMPLETE: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy value"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

interface Facts {
  byteLength: number;
  charCount: number;
  digests: Record<Algorithm, string>;
}

function FactsPanel({ label, facts }: { label: string; facts: Facts | null }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </h4>
      <dl className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
        <div className="flex justify-between gap-2">
          <dt>characters</dt>
          <dd data-testid="char-count" className="font-mono">
            {facts ? facts.charCount.toLocaleString() : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>bytes (UTF-8)</dt>
          <dd data-testid="byte-length" className="font-mono">
            {facts
              ? `${facts.byteLength.toLocaleString()} (${formatBytes(facts.byteLength)})`
              : '—'}
          </dd>
        </div>
        {ALGORITHMS.map((algorithm) => (
          <div key={algorithm} className="flex justify-between gap-2">
            <dt>{algorithm}</dt>
            <dd data-testid={`digest-${algorithm}`} className="max-w-[16rem] truncate font-mono">
              {facts?.digests[algorithm] || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const [factsA, setFactsA] = React.useState<Facts | null>(null);
  const [factsB, setFactsB] = React.useState<Facts | null>(null);
  const [running, setRunning] = React.useState(false);
  const runSeq = React.useRef(0);

  const run = React.useCallback(async () => {
    const seq = ++runSeq.current;
    setRunning(true);
    const { computeFacts: computeFactsLocal } = await import('../hash-utils');
    try {
      const [a, b] = await Promise.all([
        computeFactsLocal(state.textA),
        computeFactsLocal(state.textB),
      ]);
      if (runSeq.current !== seq) return;
      setFactsA({ byteLength: a.byteLength, charCount: a.charCount, digests: a.digests });
      setFactsB({ byteLength: b.byteLength, charCount: b.charCount, digests: b.digests });
      update({ lastRunAt: new Date().toISOString() });
    } finally {
      if (runSeq.current === seq) setRunning(false);
    }
  }, [state.textA, state.textB]);

  const hasRun = factsA !== null && factsB !== null;
  const lines: ReportLine[] = hasRun ? buildReportLines(factsA.digests, factsB.digests) : [];
  const noInputs = state.textA.length === 0 || state.textB.length === 0;
  const allMatched = hasRun && lines.length > 0 && lines.every((line) => line.match);
  const verdict: ComparisonVerdict = noInputs
    ? 'INCOMPLETE'
    : computeVerdict(state.textA, state.textB, allMatched);
  const firstDiff = React.useMemo(
    () => (!noInputs ? firstDifferingByte(state.textA, state.textB) : null),
    [state.textA, state.textB, noInputs]
  );

  const report = React.useMemo(
    () =>
      buildReport({
        textA: state.textA,
        textB: state.textB,
        factsA: factsA ?? { byteLength: 0, charCount: 0 },
        factsB: factsB ?? { byteLength: 0, charCount: 0 },
        lines,
        verdict,
        firstDiff,
      }),
    [state.textA, state.textB, factsA, factsB, lines, verdict, firstDiff]
  );

  const handleSaveSnapshot = React.useCallback(() => {
    const label = `B: ${state.textB.slice(0, 24) || '(empty)'} — ${new Date().toLocaleString()}`;
    update({
      snapshots: [
        { label, createdAt: new Date().toISOString(), payload: { ...state } },
        ...state.snapshots,
      ].slice(0, 20),
    });
  }, [state]);

  const handleRestoreSnapshot = React.useCallback(
    (index: number) => {
      const snapshot = state.snapshots[index];
      if (!snapshot) return;
      onChange?.({ ...state, ...snapshot.payload });
    },
    [state, onChange]
  );

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="hash-diff-canvas">
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="hash-input-a"
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Input A
          </label>
          <textarea
            id="hash-input-a"
            value={state.textA}
            onChange={(e) => update({ textA: e.target.value })}
            data-testid="input-text-a"
            rows={6}
            placeholder="Paste text or file contents..."
            className={textareaClass}
          />
        </div>
        <div>
          <label
            htmlFor="hash-input-b"
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Input B
          </label>
          <textarea
            id="hash-input-b"
            value={state.textB}
            onChange={(e) => update({ textB: e.target.value })}
            data-testid="input-text-b"
            rows={6}
            placeholder="Paste text or file contents..."
            className={textareaClass}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="btn-compare"
          onClick={() => void run()}
          disabled={running}
          className="rounded-md bg-violet-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {running ? 'Hashing…' : 'Compare'}
        </button>
        <button
          type="button"
          data-testid="btn-save-snapshot"
          onClick={handleSaveSnapshot}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Snapshot B digests
        </button>
      </div>

      <section
        className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900"
        data-testid="verdict-card"
        role="status"
      >
        <span className="mb-2 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Verdict
        </span>
        <span
          data-testid={VERDICT_TESTIDS[verdict]}
          className={`inline-block rounded-full px-4 py-1 text-sm font-bold ${VERDICT_CLASSES[verdict]}`}
        >
          {verdict}
        </span>
        {firstDiff !== null ? (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300" data-testid="first-diff">
            First differing byte offset: <span className="font-mono">{firstDiff}</span>
          </p>
        ) : null}
        {firstDiff !== null
          ? (() => {
              const ctx = diffContext(state.textA, state.textB, firstDiff);
              return (
                <div className="mt-2 flex flex-wrap justify-center gap-4 text-[10px] font-mono text-gray-500 dark:text-gray-400">
                  <span data-testid="diff-context-a">A: {ctx.contextA}</span>
                  <span data-testid="diff-context-b">B: {ctx.contextB}</span>
                </div>
              );
            })()
          : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <FactsPanel label="Input A facts" facts={factsA} />
        <FactsPanel label="Input B facts" facts={factsB} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Per-algorithm comparison
        </h3>
        {lines.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="report-empty">
            Press Compare to compute digests.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="report-list">
            {lines.map((line) => (
              <li
                key={line.algorithm}
                data-testid={`report-row-${line.algorithm}`}
                className="rounded-md border border-gray-200 bg-white p-2 text-xs dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {line.algorithm}
                  </span>
                  <span
                    data-testid={`verdict-${line.algorithm}`}
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      line.match
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                    }`}
                  >
                    {line.match ? 'MATCH' : 'MISMATCH'}
                  </span>
                </div>
                <p className="truncate font-mono text-gray-600 dark:text-gray-400">
                  A: {line.digestA || '—'}
                </p>
                <p className="truncate font-mono text-gray-600 dark:text-gray-400">
                  B: {line.digestB || '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
        {hasRun ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton value={report} testid="btn-copy-report" />
            {lines[0] ? <CopyButton value={lines[0].digestA} testid="btn-copy-digest-a" /> : null}
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Snapshots
        </h3>
        {state.snapshots.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="snapshots-empty">
            No snapshots yet. Save one after running a comparison.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="snapshots-list">
            {state.snapshots.map((snapshot, i) => (
              <li
                key={`${snapshot.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="truncate text-gray-700 dark:text-gray-300">{snapshot.label}</span>
                <button
                  type="button"
                  data-testid={`btn-restore-snapshot-${i}`}
                  onClick={() => handleRestoreSnapshot(i)}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Load
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All hashing runs locally in your browser via the Web Crypto API; nothing is uploaded.
      </p>
    </div>
  );
};
