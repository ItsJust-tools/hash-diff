import type { ToolConfig } from '@itsjust/core';

export const templateBaseVersion = '1.4.0';

export const toolVersion = '1.0.0';

const toolConfig = {
  id: 'hash-diff',
  name: 'Hash Diff',
  description:
    'Compare two files, texts or hash digests side by side and instantly see whether checksums, byte lengths and contents match, with hash computation over multiple algorithms.',
  version: '1.0.0',
  exportFormats: ['json', 'png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#8b5cf6',
    accentHover: '#7c3aed',
    accentSubtle: 'rgba(139, 92, 246, 0.08)',
    brand: 'Hash Diff',
    icon: '\u{1F9F1}',
  },
  shortcuts: [
    {
      title: 'Hash Diff',
      shortcuts: [
        {
          keys: 'Ctrl+Shift+C',
          label: 'Copy report',
          description: 'copy the full comparison report to the clipboard',
        },
        {
          keys: 'Ctrl+Shift+X',
          label: 'Swap inputs',
          description: 'swap input A and input B',
        },
        {
          keys: 'Ctrl+Shift+Backspace',
          label: 'Clear',
          description: 'clear both inputs and snapshots',
        },
      ],
    },
  ],
} satisfies ToolConfig;

export default toolConfig;
