# Lichess AutoPlayer

A single userscript that experiments with automatic pairing and chess play using Stockfish in a browser worker. The panel provides a time control, game limit, approximate strength slider, connection status, and controls to stop immediately or finish the current game before stopping matchmaking. Controls can be collapsed; Recent games keeps up to ten games recorded after this update. By default the script requests Lichess computer analysis after each game and waits up to 90 seconds before continuing; disable this in Controls. Move-quality counts appear when Lichess analysis is available and can be refreshed. If analysis fails or is rate-limited, the script stops with an error.

> **Lichess restrictions:** Lichess's [fair-play rules](https://lichess.org/page/fair-play) prohibit extensions that assist with playing moves. Automating play with this userscript can violate those rules, including on a bot account. For online automated play, use the [official Bot API](https://lichess.org/api#tag/Bot) and a designated bot account instead. Use this project only where you have permission to test it.

## Installation

1. Install Tampermonkey or Violentmonkey.
2. Create a userscript from the contents of [`lichess-autoplayer.user.js`](lichess-autoplayer.user.js).
3. Open the Lichess lobby. Select a time control, number of games, and strength, then press **Start**. Press **Stop** to cancel pending automation.

The script downloads chess.js and Stockfish from cdnjs. An internet connection and a browser/userscript manager that permits the worker and WebAssembly download are required. Engine errors are shown in the panel; press Start to retry. The separate local Node bridge is not used by the userscript.

## Behavior And Limitations

The script looks for the selected quick-pairing pool in the lobby, then reads a standard game's displayed move list and sends the position to Stockfish. The engine may choose a weaker evaluated legal move, bounded by a score threshold when ahead; shallow analysis cannot guarantee an advantage. The 1000–3000 slider maps to Stockfish skill levels and is not a calibrated Elo rating. The script limits engine search time based on the displayed player clock, with a short fallback when the clock cannot be read. A small reserve allows for mouse movement; the clock can still expire. The session continues across page navigation until stopped or the game limit is reached.

The desktop companion attempts native mouse input; this path has not been verified in a live game. Lichess can also change its page structure, restrict pools, or disconnect. The script stops with an error when it cannot confirm a pairing or submitted move; it cannot guarantee multiplayer availability or successful play. It assumes the board is oriented from the player's side and a standard starting position, and is not intended for variants, spectators, or analysis pages.

## Development

Run `npm test` for the local unit tests and `node --check lichess-autoplayer.user.js` for syntax validation. Tests do not establish that live pairing or board input works on Lichess.

Licensed under [GPL-3.0](license).

## macOS Desktop Companion (Experimental)

Install dependencies with `npm install`, then run `npm run mouse` in a terminal. Paste the printed session key into the userscript panel. The userscript manager remembers the key across refreshes and stops. Clear the field to remove it; a new key is generated when the helper restarts. Keep the Lichess game visible and focused. Stop the script or press Ctrl+C in the terminal to disconnect. macOS Accessibility permission for the terminal process is required; grant it in System Settings if requested.

The helper accepts authenticated HTTP requests on localhost through the userscript manager; the session key is required for every request. It verifies the foreground application, its title, and window bounds before attempting input. It stops on focus loss or failure to confirm a move. This is experimental: browser window geometry, displays, permissions and native input have not been verified end to end. Promotion currently stops automation and must be played manually. Avoid starting a game until the setup has been verified in a permitted test environment.
