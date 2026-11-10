# Changelog

All notable changes, engine updates, and feature history for Lichess AutoPlayer are documented in this file.

---

## [Unreleased]

### Added

- Native macOS CoreGraphics click helper executable in Swift (`server/click-helper.swift`) and local HTTP mouse bridge daemon (`server/mouse-bridge.js`) for OS-level mouse event synthesis.
- Automated unit test suites covering the mouse bridge server (`test/mouse-bridge.test.js`) and userscript logic (`test/userscript.test.js`) including clock parsing, move budget scaling, board geometry, and engine variation rankings.
- Automated `npm test` verification step integrated into GitHub Actions CI pipeline (`.github/workflows/ci.yml`).

### Changed

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
