# Changelog

All notable changes, engine updates, and feature history for Lichess AutoPlayer are documented in this file.

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
