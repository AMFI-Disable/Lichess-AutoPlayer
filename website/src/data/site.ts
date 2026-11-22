export const siteConfig = {
  "title": "Lichess AutoPlayer",
  "repoUrl": "https://github.com/AMFI-Disable/Lichess-AutoPlayer",
  "category": "Browser Userscript",
  "accent": "#66BB6A",
  "tagline": "In-page userscript powered by Stockfish WebAssembly with automated quick-pairing, dynamic search budgets, and optional native mouse companion.",
  "primaryCta": {
    "label": "Install Userscript",
    "href": "https://raw.githubusercontent.com/AMFI-Disable/Lichess-AutoPlayer/main/lichess-autoplayer.user.js"
  },
  "secondaryCta": {
    "label": "View on GitHub",
    "href": "https://github.com/AMFI-Disable/Lichess-AutoPlayer"
  },
  "quickCmd": "npm install -g git+https://github.com/AMFI-Disable/Lichess-AutoPlayer.git",
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
      "label": "Install macOS CLI",
      "cmd": "npm install -g git+https://github.com/AMFI-Disable/Lichess-AutoPlayer.git"
    },
    {
      "label": "Start macOS CLI",
      "cmd": "lichess-autoplayer"
    }
  ],
  "requirements": [
    "Tampermonkey or Violentmonkey",
    "Chrome / Firefox / Safari",
    "Educational & fair-play disclaimer applies"
  ],
  "hubName": "AMFI Hangar",
  "hubHash": "hangar",
  "previewTabs": [
    {
      "tab": "Stockfish WASM",
      "title": "In-Tab Engine Search",
      "body": "Evaluates live FEN positions locally using Stockfish WebAssembly with zero external API calls."
    },
    {
      "tab": "Clock Budgets",
      "title": "Dynamic Search Depth",
      "body": "Adapts node depth and think time automatically based on remaining bullet, blitz, or rapid clock."
    },
    {
      "tab": "Native Companion",
      "title": "Optional Pointer Server",
      "body": "Delegates move execution to an optional local Node.js mouse companion for realistic pointer curves."
    }
  ]
} as const;
