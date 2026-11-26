# Changelog

All notable changes, engine updates, and feature history for Lichess AutoPlayer are documented in this file.

---

## [Unreleased]

### Changed

- **Adaptive Time Management & Modular Refactor (`2.7.6` / `package.json` `1.0.3`)**: replaced artificial move-submission delays and `MultiPV 3` variation randomization with `adaptiveBudget()` (`gamePhaseFactor`, `complexityFactor`, `opponentMs`, and remaining clock reserve), centralized `cleanupWorker()` lifecycle helpers, and bumped patch versions (`2.7.6` userscript, `1.0.3` package).
- Standardized `.gitignore` to the two-section whitelist and artifact ignore template while preserving Stockfish engine and local checkout exclusions.

### Fixed

- **Engine Download Progress, Caching & Fallback (`lichess-autoplayer.user.js`, `test/userscript.test.js`)**: added `onprogress` percentage/KB reporting, `onabort` handling, automatic retries with `fetch()` CORS fallback, `GM_setValue` + in-memory script caching (`patchEngineSource`), and deferred `URL.revokeObjectURL` until `uciok` so fresh and cached starts never stall at `downloading engine…`.
- **Reliability & Error Recovery (`lichess-autoplayer.user.js`, `test/userscript.test.js`)**: added state-verified unconfirmed-move retries (`classifyMoveTimeout`, max 2 retries, preventing duplicate submissions), automatic Stockfish worker recovery (`recoverEngine` on search/drain timeout, dynamic search watchdog), aborted/short-game analysis bypass (`shouldRequestAnalysis`), `429`/5xx backoff handling so matchmaking resumes cleanly, and transient DOM move-parse tolerance (`parseFailures`).
- **1+0 Bullet Time Management & Latency (`lichess-autoplayer.user.js`, `server/mouse-bridge.js`, `server/click-helper.swift`)**: added adaptive `1+0` bullet search budgeting (zero artificial delay, `MultiPV 1` in bullet/low-time, `650 ms` initial `submitMs` baseline), `MutationObserver`-driven instant turn detection with a `200 ms` fallback poll, cached `swiftc -O` compilation of `click-helper.swift` at bridge startup, and tighter `bullet`/`quick` pointer profiles.
- Added the `stockfish` npm dependency (`^19.0.1`), updated `server/engine-bridge.js` and `test/engine-bridge.test.js` to resolve Stockfish across environment, local, Homebrew, and npm paths, and documented Engine Bridge setup in `readme.md`.

---

## [2.7.5] - Desktop Connection Startup

- Make the desktop helper the default for `npm start`. The separate Stockfish bridge is available through `npm run engine`.
- Check desktop helper readiness before loading the browser engine and show how to recover from missing keys, timeouts, and occupied ports.

---

## [2.7.4] - Clock-Aware Reply Timing

- Use the opponent's last clock spend to set a reply target, with reserves for the desktop helper and low clocks.

---

## [2.7.3] - Opening Move Timing

- Shorten engine thinking time and the wait before submitting moves during the first three moves per side.

---

## [2.7.2] - Post-Game Analysis

- Detect finished games before parsing the move list and retrieve analysis through the signed-in Lichess session without reusing cached exports.

## [2.7.1] - AutoPlayer Patch Release

The userscript is v2.7.1 and the macOS companion package is v1.0.1.

- Includes browser Stockfish, clock-aware move timing, quick pairing, session stop controls, and post-game analysis.
- Includes the installable macOS mouse companion and its authenticated local connection. The project owner confirmed the setup works on their machine.
- Adds local Premove Practice on the project site. Its single-move queue supports replacement, cancellation, and promotion.

---

## [2.7.0] - Clock-Aware Play And Desktop Companion

### Added

- Native macOS CoreGraphics click helper executable in Swift (`server/click-helper.swift`) and local HTTP mouse bridge daemon (`server/mouse-bridge.js`) for OS-level mouse event synthesis.
- Automated unit test suites covering the mouse bridge server (`test/mouse-bridge.test.js`) and userscript logic (`test/userscript.test.js`) including clock parsing, move budget scaling, board geometry, and engine variation rankings.
- Automated `npm test` verification step integrated into GitHub Actions CI pipeline (`.github/workflows/ci.yml`).

### Changed

- Restored the Star History chart section and links in `readme.md` and `website/src/main.ts`.
- Overhauled `lichess-autoplayer.user.js` to version 2.7.0 with clock-dependent dynamic search budgets, engine multi-PV variation selection, automatic game analysis tracking, and hardware mouse event routing.
- Updated submodule pointer for modern dependencies.

### Fixed

- Removed and sanitized direct binary links in documentation to ensure full policy compliance.

---

## [1.2.0] - Engine Integration And Input Stability

### Added

- **WebAssembly Stockfish Engine**: Integrated client-side WebAssembly Stockfish evaluation running smoothly inside Web Workers.
- **Enhanced Board Input Simulation**: Upgraded mouse drag, click, and drop event simulation to maintain compatibility with modern Lichess board updates.

### Fixed

- **Timing Jitter Precision**: Refined gaussian delay jitter algorithm to prevent sub-millisecond execution anomalies.
- **Script Description Alignment**: Cleaned up userscript headers and metadata descriptors.

---

## [1.1.0] - Matchmaking Automation And ELO Scaling

### Added

- **Automated Re-Queueing**: Automatic detection of match completion and trigger for "New Opponent" seeking.
- **Dynamic Difficulty Scaling**: Configurable search depth (`depth 1-20`) and UCI_Elo skill level caps.
- **Format Filtering**: Support for automatic rated game creation across Bullet, Blitz, and Rapid time controls.

---

## [1.0.0] - Initial Production Release

An automated move calculation and game execution userscript designed for authorized bot accounts and educational research.

### Added

#### Engine And Move Execution

- **Browser-Side Calculation**: In-browser move evaluation with zero external API dependencies.
- **Clean Board Rendering**: Executes moves directly without displaying visual overlays or arrows.

#### Control Interface

- **Interactive Floating Panel**: Configurable UI panel for timing controls, game limits, and difficulty sliders.
- **Customizable Turn Delays**: Base move delay configuration combined with randomized humanized jitter intervals.
