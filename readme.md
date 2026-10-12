# 🧩 Lichess-AutoPlayer - Automated Move Automation For Bot Accounts

<div align="center">

**Autonomous Chess Engine Companion & In-Page Match Automation**  
*In-page userscript with client-side WebAssembly Stockfish evaluation for authorized Lichess bot accounts.*

[![Browser: Chrome / Firefox / Safari](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Safari-blue.svg?style=flat-square&logo=googlechrome)](https://google.com/chrome)
[![Manager: Tampermonkey](https://img.shields.io/badge/Manager-Tampermonkey%20%7C%20Violentmonkey-orange.svg?style=flat-square&logo=tampermonkey)](https://tampermonkey.net)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg?style=flat-square)](license)
[![Privacy: 100% Client-Side](https://img.shields.io/badge/Privacy-100%25%20Client--Side-purple.svg?style=flat-square)](#-key-features)

</div>

---

## ⚖️ Educational & Fair-Play Disclaimer

> [!CAUTION]
> **IMPORTANT NOTICE & DISCLAIMER**:
> This codebase is provided **strictly for educational, research, and testing purposes on official, licensed Lichess Bot accounts**.
>
> Using automated assistance or AutoPlayers on standard human Lichess accounts violates the [Lichess Terms of Service](https://lichess.org/terms-of-service) and anti-cheating policies, which will result in permanent account termination.
>
> The developers and contributors accept no responsibility or liability for misuse of this software. Always comply with platform rules and use only on authorized bot accounts or local offline testing environments.

---

## 🧭 Table Of Contents

- [Key Features](#-key-features)
- [Installation And Setup](#-installation-and-setup)
- [Usage Guide](#-usage-guide)
- [License And Terms](#-license-and-terms)

---

## 🚀 Key Features

- **Browser-Based**: Runs Stockfish directly in your browser with zero external dependencies.
- **Clean Board**: Executes moves without arrows or visual hint overlays.
- **Interactive In-Page Control UI**:
  - **Rated Game Selection**: Easily choose Bullet (1+0), Blitz (3+0, 5+3), Rapid (10+0), etc.
  - **Move Timing Control**: Set your base move delay in milliseconds.
  - **Humanized Move Jitter**: Randomize move delays per turn within a customizable jitter range.
  - **Difficulty Scaling**: Adjust Stockfish search depth (`depth 1-20`) or simulated ELO (`UCI_Elo`).
  - **Match Loop Control**: Set target match count (e.g. 1, 5, 10 games) or run continuously on `Infinite` mode.
  - **Automated "New Opponent" Re-queueing**: Automatically clicks "New Opponent" to start a new match immediately after game completion.

---

## 📦 Installation And Setup

1. Install a userscript manager browser extension like [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Copy the full source code from [`lichess-autoplayer.user.js`](lichess-autoplayer.user.js).
3. In your userscript manager Dashboard, create a new userscript, paste the code, and save.
4. Navigate to [Lichess](https://lichess.org). The panel will load automatically.

---

## 🎮 Usage Guide

1. Navigate to `https://lichess.org` in your browser.
2. The **🤖 Lichess AutoPlayer** panel will appear at the bottom right.
3. Configure your desired options:
   - **Game Type**: Choose rated game mode.
   - **Matches**: Set target match count or `Infinite`.
   - **Base Delay & Jitter**: Configure move delay timing.
   - **Depth & ELO**: Set engine strength.
4. Click **START AUTOPLAYER**.
5. The script will automatically search for matches, calculate Stockfish moves in your browser, apply your delay jitter, execute moves on turn, and auto-click **New Opponent** when the match finishes!

---

## 📄 License And Terms

Licensed under the [GNU General Public License v3.0](license). Copyright (c) 2026 AMFI-Disable.
