export const siteConfig = {
  "title": "Lichess AutoPlayer",
  "repoUrl": "https://github.com/AMFI-Disable/Lichess-AutoPlayer",
  "category": "Browser Userscript",
  "accent": "#66BB6A",
  "tagline": "In-page userscript powered by Stockfish WebAssembly with automated quick-pairing, dynamic search budgets, and optional native mouse companion.",
  "primaryCta": {
    "label": "Setup Guide",
    "href": "#quick-start"
  },
  "secondaryCta": {
    "label": "View on GitHub",
    "href": "https://github.com/AMFI-Disable/Lichess-AutoPlayer"
  },
  "quickCmd": "git clone https://github.com/AMFI-Disable/Lichess-AutoPlayer.git && cd Lichess-AutoPlayer && npm ci && npm test",
  "features": [
    {
      "title": "Stockfish WebAssembly",
      "desc": "Runs Stockfish WASM directly inside the browser tab for fast, local position evaluation."
    },
    {
      "title": "Automated Quick-Pairing",
      "desc": "Configurable match-finding and continuous game loop handling for hands-free testing."
    },
    {
      "title": "Dynamic Search Budgets",
      "desc": "Adapts engine depth and think time dynamically based on remaining clock and position complexity."
    },
    {
      "title": "Optional Native Companion",
      "desc": "Includes an optional Node.js/native mouse companion server for realistic pointer movement simulation."
    }
  ],
  "steps": [
    {
      "title": "Board State Observer",
      "desc": "Reads live Lichess DOM / WebSocket board updates and legal turn state in real time."
    },
    {
      "title": "WASM Engine Search",
      "desc": "Dispatches FEN positions to the local Stockfish WebAssembly worker with clock-aware time budgets."
    },
    {
      "title": "Move Execution",
      "desc": "Applies the selected move via in-page events or delegates to the optional native companion server."
    }
  ],
  "installCmds": [
    {
      "label": "Clone & Run Tests",
      "cmd": "git clone https://github.com/AMFI-Disable/Lichess-AutoPlayer.git && cd Lichess-AutoPlayer && npm ci && npm test"
    },
    {
      "label": "Install Userscript",
      "cmd": "Open lichess-autoplayer.user.js in Tampermonkey or Violentmonkey"
    }
  ],
  "requirements": [
    "Tampermonkey or Violentmonkey",
    "Chrome / Firefox / Safari",
    "Educational & fair-play disclaimer applies"
  ]
} as const;
