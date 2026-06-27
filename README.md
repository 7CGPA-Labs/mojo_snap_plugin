# 🕹️ WebOS Retro Game Console Platform

A high-performance, low-latency retro game emulation platform designed for packaged native LG webOS smart TVs. The system uses a vanilla RetroArch WebAssembly core rendering directly onto an unadorned WebGL canvas, driven by a dedicated Node.js WebSocket proxy and an immersive, native Flutter mobile controller over local Wi-Fi.

---

## 📂 Workspace Architecture

The repository is structured into two decoupled workspace areas:

```text
webos-retro-console/
├── backend/                  <-- TV Static Assets & WebSocket Proxy Server
│   ├── server.js             <-- Node Express & WebSocket Bootstrapper
│   ├── package.json
│   ├── src/
│   │   ├── config/network.js <-- Port & IP Helper functions
│   │   └── network/
│   │       └── websocket.js  <-- Low-Latency Refereed Binary Stream Router
│   └── public/
│       ├── tv.html           <-- TV Smart Display Shell
│       ├── cores/            <-- RetroArch Core WebAssembly & JS Modules
│       ├── roms/             <-- Multi-System ROM Repository (NES, SNES, SEGA)
│       └── assets/js/
│           ├── network.js    <-- TV Web Worker connection bridge
│           └── gameplay.js   <-- KeyboardEvent translator & custom pause menu
│
└── frontend/                 <-- Native Flutter Mobile Controller (Android/iOS)
    ├── pubspec.yaml
    └── lib/
        ├── main.dart         <-- Immersive tactile gamepad interface (Listener-based)
        └── gamepad_engine.dart <-- High-speed binary WebSocket stream engine
```

---

## 🛠️ Step-by-Step Launch Sequence

### 1. Start the TV Backend Server
1. Navigate into the `backend/` folder:
   ```bash
   cd backend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Start the proxy server:
   ```bash
   node server.js
   ```
4. Access the TV console on your browser at `http://localhost:3000/tv.html` or build the folder as a packaged WebOS `.ipk` application.

### 2. Launch the Mobile Controller App
1. Navigate into the `frontend/` folder:
   ```bash
   cd frontend
   ```
2. Pull the Flutter plugin packages:
   ```bash
   flutter pub get
   ```
3. Run the controller app on a physical device or emulator connected to the same Wi-Fi network:
   ```bash
   flutter run
   ```
4. Enter the TV's host IP address (displayed on the TV console lobby or QR modal) in the app connection panel and press **LINK STATION**.

---

## 🎮 Controller Actions & Macros

### Custom Pause Menu Navigation
When in a game, press the **MENU** button on the mobile controller to pause emulation and open the custom TV gameplay overlay.
* **D-pad UP / DOWN**: Change menu option selection.
* **D-pad LEFT / RIGHT**: Toggle save slot registers (Slots 1-9) when hovering over the "SAVE SLOT" option.
* **Button A**: Select / execute the active option.
* **Button B / MENU / PAUSE**: Close the pause menu.

### Hotkey Macros (Gameplay Mode)
The following macro chords can be executed during active gameplay:
* **Hold SELECT + Press START**: Save game state instantly.
* **Hold SELECT + Press MENU or PAUSE**: Load game state instantly.
* **Hold SELECT + Press D-pad UP**: Shift save slot register up (mutes movement).
* **Hold SELECT + Press D-pad DOWN**: Shift save slot register down (mutes movement).
* **Hold SELECT + Press D-pad LEFT/RIGHT**: Mute character movements.
