/** Barrel for tool internals shared between the shell, components and tests. */
export { default as toolConfig, templateBaseVersion, toolVersion } from './tool.config';
export { templateMetadata, getPublicSiteUrl } from './template-metadata';
export {
  hashDiffTool,
  serializeState,
  deserializeState,
  roundTrips,
  withSnapshot,
  isAlgorithm,
  MAX_SNAPSHOTS,
  DEFAULT_STATE,
} from './tool-definition';
export * from './hash-utils';
export type {
  ToolState,
  Algorithm,
  DigestResult,
  InputFacts,
  ComparisonVerdict,
  ReportLine,
  Snapshot,
} from './types';
export { Canvas } from './components/Canvas';
export { Toolbar } from './components/Toolbar';
export { Sidebar } from './components/Sidebar';
