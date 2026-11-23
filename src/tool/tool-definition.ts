import type { DeserializeResult, Tool } from '@itsjust/core';
import toolConfig from './tool.config';
import { ALGORITHMS, type Algorithm, type Snapshot, type ToolState } from './types';

export const MAX_SNAPSHOTS = 20;

export const DEFAULT_STATE: ToolState = {
  textA: '',
  textB: '',
  lastRunAt: '',
  snapshots: [],
};

const VALID_ALGORITHMS: readonly string[] = ALGORITHMS;

/** True when the value is a supported algorithm name. */
export function isAlgorithm(value: unknown): value is Algorithm {
  return typeof value === 'string' && VALID_ALGORITHMS.includes(value);
}

function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.label !== 'string' || typeof v.createdAt !== 'string') return false;
  if (typeof v.payload !== 'object' || v.payload === null) return false;
  const payload = v.payload as Record<string, unknown>;
  return typeof payload.textA === 'string' && typeof payload.textB === 'string';
}

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    textA: state.textA,
    textB: state.textB,
    lastRunAt: state.lastRunAt,
    snapshots: state.snapshots,
  });
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null) {
    return {
      success: false,
      error: 'Invalid data format: expected Hash Diff state object',
    };
  }
  const v = data as Record<string, unknown>;
  const textA = typeof v.textA === 'string' ? v.textA : DEFAULT_STATE.textA;
  const textB = typeof v.textB === 'string' ? v.textB : DEFAULT_STATE.textB;
  const lastRunAt = typeof v.lastRunAt === 'string' ? v.lastRunAt : DEFAULT_STATE.lastRunAt;
  const snapshots = Array.isArray(v.snapshots)
    ? v.snapshots.filter(isSnapshot).slice(0, MAX_SNAPSHOTS)
    : DEFAULT_STATE.snapshots;
  return {
    success: true,
    data: { textA, textB, lastRunAt, snapshots },
  };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

/** Append a snapshot (newest first), capped at MAX_SNAPSHOTS. */
export function withSnapshot(state: ToolState, snapshot: Snapshot): ToolState {
  return { ...state, snapshots: [snapshot, ...state.snapshots].slice(0, MAX_SNAPSHOTS) };
}

export const hashDiffTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { toolConfig };
