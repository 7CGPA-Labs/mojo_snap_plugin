# Implementation Plan - Future Development Roadmap (v8)

This implementation plan outlines the technical designs and workflow steps for implementing the remaining roadmap milestones.

---

## 1. Network Service Discovery - mDNS (C# Backend)

### Objective
Allow mobile web-based gamepad apps to automatically discover and connect to local media servers (Emby/Jellyfin plugin C# backend) running the Retro Console player without requiring manual IP address inputs.

### Technical Design
1. **mDNS Service Broadcaster**:
   - Integrate a lightweight zero-dependency mDNS responder inside the Jellyfin/Emby C# plugin assembly or run a local platform responder.
   - Broadcast service properties:
     - Service Type: `_retroconsole._tcp`
     - Domain: `local.`
     - TXT Records: `port=[WebSocket Port]`, `serverName=[Server ID]`
2. **WebSocket Gamepad Server (Low-Latency Binary Data)**:
   - Establish a dedicated WebSocket controller listener server inside the C# plugin backend.
   - Accept connections from pairing mobile controllers, and exchange inputs using a **low-latency binary byte protocol** (instead of heavy text-based JSON frames):
     - **Byte 0**: Player Index (`1` or `2`)
     - **Byte 1**: Action Phase (`1` = DOWN, `2` = UP, `3` = AXIS)
     - **Byte 2**: Button/Axis ID (`1` to `12` button mappings, or axis index)
     - **Bytes 3-4** (Optional): Multi-byte float mappings for analog stick coordinates.
   - Inject decoded keys immediately into the active client browser context.

---

## 2. Settings & HTML5 EmulatorJS-style Controls Overlay

### Objective
Expose a premium configuration overlay toolbar and settings dialog mirroring the UX of EmulatorJS, built on top of HTML5 media interfaces.

```text
+--------------------------------------------------------------+
|                          Canvas View                         |
|                                                              |
|                                                              |
| [Overlay Toolbar]                                            |
|  [|> / ||] [Volume Slider] [Save Slot] [Load/Save] [Settings] |
+--------------------------------------------------------------+
```

### Technical Design

#### A. Play/Pause Overlay & Media State
- **Play/Pause Button**:
  - Toggles execution state.
  - Communicates with RetroArch using Emscripten loop state hooks:
    ```javascript
    window.Module.retroArchSend("PAUSE_TOGGLE");
    ```
  - Displays a centered visual play icon overlay when paused, matching standard HTML5 video player behavior.

#### B. Audio Volume & Mute Controls
- **Mute / Volume Slider**:
  - Toggles sound off or adjusts relative output level via range inputs.
  - Writes updated `audio_volume = "[db]"` records dynamically to `retroarch.cfg`.

#### C. Save/Load State & Slot Selector (Media Server Syncing)
- **Save State Storage & Portability**:
  - **Browser Extension**: Saved locally inside the browser's IndexedDB store via the `BrowserFS` async mirror.
  - **Media Server Plugin**: 
    - Saves are fully **portable and synchronized** with the home media server.
    - When a game is loaded, the client fetches any existing `.sav` / `.state` files from the Jellyfin/Emby user data directory via the server API and populates the virtual `BrowserFS` directory before emulation boots.
    - When a save state is created during gameplay, the filesystem bridge intercepts the newly written file and uploads it back to the home media server using the plugin's save sync endpoint.
- **State Controls**:
  - Expose visual save/load state buttons and a save slot numeric stepper (Slots 1-9).
  - Fires core state commands:
    ```javascript
    window.Module.retroArchSend("SAVE_STATE");
    window.Module.retroArchSend("LOAD_STATE");
    window.Module.retroArchSend("STATE_SLOT_PLUS");
    window.Module.retroArchSend("STATE_SLOT_MINUS");
    ```

#### D. Audio/Video/Hardware Settings Dialog
- **Settings Modal**:
  - **Video Panel (Graphics Options)**:
    - **Aspect Ratio**: Selection menu containing `Auto`, `4:3`, `16:9`, `Stretch`, and `1:1`. Updates the `video_aspect_ratio_auto` and `video_aspect_ratio` configuration keys.
    - **Bilinear Filtering (Video Smooth)**: Toggle switch mapping to `video_smooth`.
    - **VSync**: Toggle switch mapping to `video_vsync`.
    - **Integer Scaling**: Toggle switch mapping to `video_scale_integer` to restrict scaling to whole pixel integers.
    - **Screen Rotation**: Dropdown selection mapping to `video_rotation` (0, 90, 180, 270 degrees).
    - **Shader Filter Effects**: Option to apply standard overlays (e.g. CRT scanline scan layers, LCD grids, or smooth rendering) over the canvas element.
  - **Audio Panel (Sound Mixer Options)**:
    - **Audio Latency**: Slider control (64ms - 256ms) mapping to `audio_latency`.
    - **Audio Output Enable**: Toggle switch mapping to `audio_enable`.
    - **Audio Resampler Quality**: Dropdown menu (0: Lowest, 1: Low, 2: Normal, 3: High, 4: Highest) mapping to `audio_resampler_quality`.
    - **Audio Rate Control**: Toggle switch mapping to `audio_rate_control` to prevent audio stutter/crackle.
  - **Hardware Panel**:
    - **Threaded Video**: Toggle switch mapping to `video_threaded` (boosts visual processing efficiency).
    - **Run-Ahead Input Latency Reduction**: Toggle switch mapping to `run_ahead_enabled` to run frames ahead and decrease key latency.
    - **Rewind buffer**: Toggle switch mapping to `rewind_enable` and setting `rewind_granularity`.
    - **Fast Forward Speed Ratio**: Slider/stepper mapping to `fastforward_ratio` (speed controls).
    - **Core-level Overclocking**: Core options modifiers (e.g., `snes9x2010_overclock` or `genesis_plus_gx_overclock`) to change CPU speed emulation levels directly.

#### E. Core/Game Specific Settings Persistence
- **Config Inheritance Hierarchies**:
  - Implement a configuration priority chain during game boot-up:
    1.  `global_retroarch.cfg` (Global defaults)
    2.  `[CoreName]_retroarch.cfg` (Console-wide defaults, e.g. `mgba_retroarch.cfg`)
    3.  `[GameTitle]_retroarch.cfg` (Game-specific overrides, e.g. `Super_Mario_Advance_retroarch.cfg`)
- **Settings UI Options**:
  - Add save action buttons inside the Settings dialog:
    - `[SAVE FOR THIS CORE ONLY]`: Writes active configurations to `/home/web_user/retroarch/userdata/[CoreName]_retroarch.cfg`.
    - `[SAVE FOR THIS GAME ONLY]`: Writes active configurations to `/home/web_user/retroarch/userdata/[GameTitle]_retroarch.cfg`.
  - When booting a ROM, the `writeConfig()` script parses directories, resolves the priority chain, merges all overrides, and saves the final composite parameters file to `/home/web_user/retroarch/userdata/retroarch.cfg` before booting Emscripten.

#### F. Controller Remapping Interface
- **Remapping Modal**:
  - Pop up a visual layout showing standard SNES/NES gamepad buttons.
  - Intercept the next physical keypress or gamepad button trigger to dynamically update the button-to-key configuration map.

#### G. Cheats Configuration Dialog
- **Cheat Manager**:
  - Reads, edits, and writes Libretro `.cht` format files inside the virtual BrowserFS directories (`/home/web_user/retroarch/userdata/cheats/`).
  - Calls RetroArch cheat toggle commands.

#### H. Custom Right-Click Context Menu
- Intercept browser `contextmenu` event and display a styled dark-glass dialog with instant actions:
  - Resume / Pause Emulation
  - Restart Core
  - Take Screenshot
  - Save State (Slot 1-9)
  - Exit Game

---

## 3. Emulation Additions: `dosbox_pure` Core

### Objective
Integrate the popular `dosbox_pure` core to support general DOS games, utilities, and applications up to 1994.

### Technical Design
1. **Retrieve WASM Core**:
   - Fetch compiled files `dosbox_pure_libretro.js` and `dosbox_pure_libretro.wasm` from the nightly libretro CDN and save to `shared/cores/`.
2. **Setup Extension Boot Loader**:
   - Map `.zip` (containing MS-DOS game directories) to automatically launch the `dosbox_pure` core.
   - Configure virtual mounts to extract/identify and present game start selectors if multiple `.exe`/`.com`/`.bat` binaries are found within the ROM zip archive.
