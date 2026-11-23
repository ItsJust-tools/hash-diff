# Hash Diff

Compare two files, texts or hash digests side by side and instantly see whether checksums, byte lengths and contents match, with hash computation over multiple algorithms.

**Live:** [hash-diff.itsjust.tools](https://hash-diff.itsjust.tools)

##Features

- Compute SHA-1, SHA-256, SHA-384 and SHA-512 digests for any entered text, fully client-side via the Web Crypto API
- Compare two texts side by side with a MATCH / MISMATCH verdict per algorithm plus an overall INCOMPLETE / MATCH / MISMATCH verdict
- Show byte length (UTF-8) and character count for each input
- Highlight the first differing byte position with hex context windows for both inputs
- Paste entire existing compare target digests from local JSON snapshots: save a snapshot after a run and restore its inputs later
- Copy a digest or the full comparison report to the clipboard
- Share a comparison state via URL parameters
- 100% client-side — no data ever leaves your browser

## Usage

1. Paste text or file contents into input A and input B.
2. Press `Compare` to hash both inputs with every algorithm.
3. Read the per-algorithm verdicts and the first differing byte offset.
4. Save a snapshot to keep both inputs and restore them later (`Load` next to the snapshot).

## Keyboard shortcuts

| Key                    | Action       |
| ---------------------- | ------------ |
| `Ctrl+Shift+C`         | Copy report  |
| `Ctrl+Shift+X`         | Swap inputs  |
| `Ctrl+Shift+Backspace` | Clear inputs |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-hash-diff .
docker run -p 3000:3000 itsjust-hash-diff
```

## Security

All hashing runs locally in your browser; nothing is uploaded. See [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
