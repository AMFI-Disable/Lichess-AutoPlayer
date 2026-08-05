# Lichess AutoPlayer (Standalone Licensed Bot Edition)

Automated move execution, move timing customization, move delay jittering, search depth/ELO scaling, rated match selection, and automatic "New Opponent" match seeking for **Lichess Bot Accounts**.

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

## 🌟 Features

- **100% Standalone (No Terminal or Node.js Required)**: Runs Stockfish directly in your browser via WebWorkers.
- **Pure AutoPlayer Focus**: Automated move execution with zero visual hints or overlay arrows on the board.
- **Interactive In-Page Control UI**:
  - **Rated Game Selection**: Easily choose Bullet (1+0), Blitz (3+0, 5+3), Rapid (10+0), etc.
  - **Move Timing Control**: Set your base move delay in milliseconds.
  - **Humanized Move Jitter**: Randomize move delays per turn within a customizable jitter range.
  - **Difficulty Scaling**: Adjust Stockfish search depth (`depth 1-20`) or simulated ELO (`UCI_Elo`).
  - **Match Loop Control**: Set target match count (e.g. 1, 5, 10 games) or run continuously on `Infinite` mode.
  - **Automated "New Opponent" Re-queueing**: Automatically clicks "New Opponent" to start a new match immediately after game completion.

---

## 🛠️ Quick Setup Guide

### 1. Prerequisites
- Any browser (Chrome, Chrome Dev, Safari, Firefox).
- **Tampermonkey** or **Violentmonkey** extension installed.

### 2. Install Userscript
1. Open Tampermonkey in your browser.
2. Create a new script and copy/paste the code from [`lichess-autoplayer.user.js`](file:///Users/even/Desktop/Projects/Scripts/Lichess-AutoPlayer/lichess-autoplayer.user.js).
3. Save the script and navigate to [https://lichess.org](https://lichess.org).

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
