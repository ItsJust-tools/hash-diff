'use client';

import React from 'react';
import { ALGORITHMS, type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="hash-diff-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Supported algorithms</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {ALGORITHMS.map((algorithm) => (
            <li key={algorithm} className="font-mono">
              {algorithm}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved snapshots</h3>
        <p
          className="text-xs text-gray-600 dark:text-gray-300"
          data-testid="sidebar-snapshot-count"
        >
          {state.snapshots.length} snapshot{state.snapshots.length === 1 ? '' : 's'} stored
          {state.snapshots.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">How it works</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>Paste two texts (A and B) or file contents.</li>
          <li>Press Compare to hash both inputs with every algorithm.</li>
          <li>Matching digests across all algorithms means the contents match byte for byte.</li>
          <li>The first differing byte offset helps you locate where the inputs diverge.</li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>Ctrl+Shift+C</kbd> — Copy report
          </li>
          <li>
            <kbd>Ctrl+Shift+X</kbd> — Swap inputs
          </li>
          <li>
            <kbd>Ctrl+Shift+Backspace</kbd> — Clear inputs
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current inputs; open it to
          restore this comparison.
        </p>
      </div>
    </div>
  );
};
