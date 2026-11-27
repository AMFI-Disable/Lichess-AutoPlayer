<div align="center">

# Lichess AutoPlayer - Automated Pairing & Chess Play

[中文文档](readme.zh-cn.md) · [Contributing](contributing.md)

**Browser Userscript Companion For Automated Pairing And Chess Engine Play**  
*In-page userscript powered by Stockfish WebAssembly, automated quick-pairing, dynamic search budgets, and optional native mouse companion.*

[![Website: Live](https://img.shields.io/badge/Website-Live-66BB6A.svg?style=flat-square)](https://amfi-disable.github.io/Lichess-AutoPlayer/)
[![Browser: Chrome / Firefox / Safari](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Safari-blue.svg?style=flat-square&logo=googlechrome)](https://google.com/chrome)
[![Manager: Tampermonkey](https://img.shields.io/badge/Manager-Tampermonkey%20%7C%20Violentmonkey-orange.svg?style=flat-square&logo=tampermonkey)](https://tampermonkey.net)
[![Engine: Stockfish](https://img.shields.io/badge/Engine-Stockfish.js%2010.0.2-blue.svg?style=flat-square)](https://stockfishchess.org)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg?style=flat-square)](license)
[![Privacy: 100% Client-Side](https://img.shields.io/badge/Privacy-100%25%20Client--Side-purple.svg?style=flat-square)](#overview-and-core-value)

[Changelog](changelog.md) · [Security Policy](security.md) · [GPL-3.0 License](license)

</div>

---

## Star History

<a href="https://www.star-history.com/?type=date&repos=amfi-disable%2Flichess-autoplayer">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=amfi-disable%2Flichess-autoplayer&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=amfi-disable%2Flichess-autoplayer&type=date&legend=top-left" />
    <img alt="AMFI-Disable/Lichess-AutoPlayer Star History Chart" src="https://api.star-history.com/chart?repos=amfi-disable%2Flichess-autoplayer&type=date&legend=top-left" />
  </picture>
</a>

---

## Educational & Fair-Play Disclaimer

> [!CAUTION]
> **IMPORTANT NOTICE & DISCLAIMER**:
> This codebase is provided strictly for educational, research, and personal productivity testing purposes in permitted environments.
> Lichess's [fair-play rules](https://lichess.org/page/fair-play) prohibit extensions that assist with playing moves during rated games. Automating play with this userscript in unauthorized contexts violates those terms and may lead to account penalties.
> For official online automated play, use the [official Bot API](https://lichess.org/api#tag/Bot) and a designated bot account instead.
> The developers and contributors accept no responsibility or liability for misuse or account sanctions.

---

## Overview And Core Value

Lichess AutoPlayer is a single userscript that experiments with automatic pairing and chess play using Stockfish in a browser worker. The panel provides a time control, game limit, approximate strength slider, connection status, and controls to stop immediately or finish the current game before stopping matchmaking. Controls can be collapsed; Recent games keeps up to ten games recorded after this update. By default the script requests Lichess computer analysis after each game and waits up to 90 seconds before continuing; disable this in Controls. Move-quality counts appear when Lichess analysis is available and can be refreshed. If analysis fails or is rate-limited, the script stops with an error.

---

## Installation And Setup

The userscript header and the [package manifest](package.json) record the respective component versions.

1. Install Tampermonkey or Violentmonkey.
2. Open the [userscript source](https://raw.githubusercontent.com/AMFI-Disable/Lichess-AutoPlayer/main/lichess-autoplayer.user.js) and confirm installation in your userscript manager.
3. Open the Lichess lobby. Select a time control, number of games, and strength, then press **Start**. Press **Stop** to cancel pending automation.

The userscript manager loads chess.js and Stockfish from cdnjs when installing or updating the script. If the installed Stockfish resource is unavailable, the script downloads it at startup. Stockfish runs in a browser worker. Engine errors are shown in the panel; press Start to retry. The separate Node engine bridge is not used by the userscript. The macOS mouse companion below handles native input.

---

## Behavior And Limitations

The script looks for the selected quick-pairing pool in the lobby, then reads a standard game's displayed move list and sends the position to Stockfish. The engine may choose a weaker evaluated legal move, bounded by a score threshold when ahead; shallow analysis cannot guarantee an advantage. The 1000–3000 slider maps to Stockfish skill levels and is not a calibrated Elo rating. The script limits engine search time based on the displayed player clock, with a short fallback when the clock cannot be read. A small reserve allows for mouse movement; the clock can still expire. The session continues across page navigation until stopped or the game limit is reached.

The desktop companion attempts native mouse input; this path has not been verified in a live game. Lichess can also change its page structure, restrict pools, or disconnect. The script stops with an error when it cannot confirm a pairing or submitted move; it cannot guarantee multiplayer availability or successful play. It assumes the board is oriented from the player's side and a standard starting position, and is not intended for variants, spectators, or analysis pages.

---

## macOS Desktop Companion (Experimental)

On macOS with Node.js and the Xcode Command Line Tools installed, run:

```sh
npm install -g git+https://github.com/AMFI-Disable/Lichess-AutoPlayer.git
lichess-autoplayer
```

To run from a clean clone, use Node.js 22 and the Xcode Command Line Tools:

```sh
git clone https://github.com/AMFI-Disable/Lichess-AutoPlayer.git
cd Lichess-AutoPlayer
npm ci
npm start
```

Paste the printed session key into the userscript panel. The userscript manager remembers the key across refreshes and stops. Clear the field to remove it; a new key is generated when the helper restarts. Keep the Lichess game visible and focused. Stop the script or press Ctrl+C in the terminal to disconnect. macOS Accessibility permission for the terminal process is required; grant it in System Settings if requested.

From a source checkout, `npm run mouse` also starts the mouse helper. If port 17349 is occupied, use the key from the existing helper terminal or stop that process and start a fresh helper to get a new key.

The helper accepts authenticated HTTP requests on localhost through the userscript manager; the session key is required for every request. It verifies the foreground application, its title, and window bounds before attempting input. It stops on focus loss or failure to confirm a move. This is experimental: browser window geometry, displays, permissions and native input have not been verified end to end. Promotion currently stops automation and must be played manually. Avoid starting a game until the setup has been verified in a permitted test environment.

---

## Local Premove Practice

Run `npm --prefix website ci` and `npm --prefix website run dev`, then choose **Premove Practice** on the local project site. Play White against a simple computer opponent. During Black’s turn, select a white piece and its destination. The board highlights the queued move and plays it only if it is legal after Black’s reply. Select a different move to replace it, or use **Cancel Premove** to clear it.

Run `npm --prefix website test` for the premove checks.

## Automated Testing And Verification

Run `npm test` for the local unit tests and `node --check lichess-autoplayer.user.js` for syntax validation. Tests do not establish that live pairing or board input works on Lichess.

### Engine Bridge Setup

To run the local WebSocket Stockfish bridge (`npm run engine`), install dependencies with `npm ci`. The bridge automatically resolves `STOCKFISH_PATH`, a locally compiled `stockfish/src/stockfish` binary, system/Homebrew `stockfish`, or the bundled lite single-threaded `stockfish` npm build, and verifies the UCI handshake before it starts listening. Run `npm run check:engine` to diagnose a setup: it prints the engine in use and its start-up time, or the exact failing stage (missing file, permissions, early exit, or timeout).

If the userscript reports an engine error, the message names the stage that failed: downloading the engine from cdnjs, starting the Web Worker, or waiting for the UCI handshake. These usually mean cdnjs.cloudflare.com is unreachable or the userscript manager blocks workers on lichess.org.

---

## License And Terms

Licensed under the [GNU General Public License v3.0](license). Copyright (c) 2026 AMFI-Disable.
