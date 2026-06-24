// public/assets/js/gameplay.js

// FSM: The Application State Arbitrator
const ApplicationState = {
    current: 'LOBBY', // 'LOBBY' | 'GAMEPLAY'
    isMenuOpen: false,
    
    enterGameplay: async function(game) {
        this.current = 'GAMEPLAY';
        this.isMenuOpen = false;
        
        document.getElementById('lobby-view').style.display = 'none';
        document.getElementById('gameplay-view').style.display = 'flex';
        
        const bgm = document.getElementById('lobby-audio');
        if (bgm) {
            bgm.muted = true;
            bgm.volume = 0;
            bgm.pause();
            bgm.removeAttribute('src'); // Completely destroy the audio source to guarantee silence
        }

        if (typeof window.socket !== 'undefined' && window.socket && window.socket.readyState === WebSocket.OPEN) {
            window.socket.send(JSON.stringify({ type: 'TV_STATE_CHANGE', state: 'GAMEPLAY', core: game.console, layout: game.layout }));
        }
        
        loadROM(game);
    },

    // State Machine Tear-Down Protocol
    exitGameplay: function() {
        // Instantly mute and pause the emulator to stop any background audio
        if (window.EJS_emulator) {
            try { window.EJS_emulator.mute(); } catch (e) {}
            try { if (window.EJS_emulator.gameManager) window.EJS_emulator.gameManager.pause(); } catch (e) {}
        }

        this.current = 'LOBBY';
        
        document.getElementById('gameplay-view').style.display = 'none';
        document.getElementById('lobby-view').style.display = 'flex';
        
        // Strip the "Leave Site?" warning EmulatorJS attaches to the window
        // that actively blocks our programmatic reload command!
        window.onbeforeunload = null;

        // A full page reload is the most robust and reliable method to completely
        // tear down the WebAssembly emulator core and its injected global scripts.
        // This prevents "identifier has already been declared" errors on subsequent
        // game launches by ensuring a clean execution environment.
        window.location.reload();
    }
};

// Safe Audio Helper to prevent the "Play request interrupted by pause" DOMException
function playLobbyMusic() {
    const bgm = document.getElementById('lobby-audio');
    if (!bgm) return;
    if (ApplicationState.current !== 'LOBBY') return;
    if (!bgm.hasAttribute('src')) return; // Prevent playing if the source was destroyed
    
    bgm.volume = 0.3; // 30% volume
    const playPromise = bgm.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            if (ApplicationState.current !== 'LOBBY') bgm.pause();
        }).catch(err => console.warn('[TV] Autoplay blocked by browser. BGM will start upon interaction.'));
    }
}

function openQrModal() {
    const qrContainer = document.getElementById("qrcode-container");
    if (qrContainer && typeof qrCodeDataUrl !== 'undefined' && qrCodeDataUrl) {
        qrContainer.innerHTML = `<img src="${qrCodeDataUrl}" alt="Controller URL" style="display: block;">`;
    }
    const overlay = document.getElementById('qr-modal-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

// Local Device ROM Modal Overlay Operations
function openLocalRomModal() {
    const modal = document.getElementById('local-rom-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeLocalRomModal() {
    const modal = document.getElementById('local-rom-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    // Clear input to allow re-selecting the same file if needed
    const fileInput = document.getElementById('rom-file-input');
    if (fileInput) {
        fileInput.value = '';
    }
}

function launchLocalROM() {
    const fileInput = document.getElementById('rom-file-input');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert('Please select a ROM file first.');
        return;
    }

    const file = fileInput.files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    let consoleName = 'NES'; // Default fallback
    
    if (['nes'].includes(ext)) consoleName = 'NES';
    else if (['smc', 'sfc'].includes(ext)) consoleName = 'SNES';
    else if (['md', 'smd', 'gen'].includes(ext)) consoleName = 'SEGA';
    else if (['gba'].includes(ext)) consoleName = 'GBA';
    else if (['iso', 'cue', 'chd', 'bin', 'img'].includes(ext)) consoleName = 'PS1';

    // Query Layout Preference
    let layoutPreference = 'AUTO';
    const radios = document.getElementsByName('layout-preference');
    for (const radio of radios) {
        if (radio.checked) {
            layoutPreference = radio.value;
            break;
        }
    }

    const finalLayout = (layoutPreference === 'MK_LAYOUT') ? 'MK_LAYOUT' : consoleName;

    const virtualGame = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        console: consoleName,
        layout: finalLayout,
        path: URL.createObjectURL(file) // Generate a temporary browser memory URL
    };

    closeLocalRomModal();
    ApplicationState.enterGameplay(virtualGame);
}

// 🎮 NATIVE HTML5 GAMEPAD MOCKING 🎮
// Bypass browser KeyboardEvent security by spoofing physical hardware gamepads
const virtualGamepads = [null, null, null, null];

Object.defineProperty(navigator, 'getGamepads', {
    value: () => virtualGamepads,
    configurable: true
});

const gamepadMap = {
    'B': 0, 'A': 1, 'Y': 2, 'X': 3,
    'L1': 4, 'R1': 5, 'L2': 6, 'R2': 7,
    'SELECT': 8, 'START': 9,
    'UP': 12, 'DOWN': 13, 'LEFT': 14, 'RIGHT': 15
};

function getOrCreateGamepad(index) {
    if (!virtualGamepads[index]) {
        virtualGamepads[index] = {
            id: `Standard Gamepad (Virtual Controller ${index + 1})`,
            index: index,
            connected: true,
            timestamp: performance.now(),
            mapping: 'standard',
            axes: [0, 0, 0, 0],
            buttons: Array(18).fill(null).map(() => ({ pressed: false, touched: false, value: 0 }))
        };
        const ev = new Event('gamepadconnected');
        ev.gamepad = virtualGamepads[index];
        window.dispatchEvent(ev);
    }
    return virtualGamepads[index];
}

function removeGamepad(index) {
    if (virtualGamepads[index]) {
        const ev = new Event('gamepaddisconnected');
        ev.gamepad = virtualGamepads[index];
        window.dispatchEvent(ev);
        virtualGamepads[index] = null;
    }
}

function processControllerInput(player, button, action) {
    if (ApplicationState.current !== 'GAMEPLAY') return; 
        
    // Smartphone Context Menu / Explicit Pause Toggle
    if ((button === 'MENU' || button === 'PAUSE') && action === 'DOWN') {
        const gamepadIndex = player - 1;
        const pad = virtualGamepads[gamepadIndex];
        const isSelectPressed = pad && pad.buttons[gamepadMap['SELECT']] && pad.buttons[gamepadMap['SELECT']].pressed;
        
        if (isSelectPressed) {
            return; // Skip normal MENU pause if SELECT is held (it's a LOAD_STATE macro)
        }

        if (window.EJS_emulator && window.EJS_emulator.gameManager) {
            ApplicationState.isMenuOpen = !ApplicationState.isMenuOpen;
            if (ApplicationState.isMenuOpen) {
                try { window.EJS_emulator.gameManager.pause(); } catch(e){}
            } else {
                try { window.EJS_emulator.gameManager.resume(); } catch(e){}
                setTimeout(() => {
                    const canvas = document.querySelector('#game-div canvas');
                    if (canvas) canvas.focus();
                }, 50);
            }
        }
        return; // Prevent the menu key from being forwarded to the emulator core
    }

    // Smartphone Save State Macro Trigger (SELECT + START)
    if (button === 'SAVE_STATE' && action === 'DOWN') {
        if (window.EJS_emulator) {
            try {
                if (window.EJS_emulator.elements && window.EJS_emulator.elements.bottomBar && window.EJS_emulator.elements.bottomBar.saveState) {
                    window.EJS_emulator.elements.bottomBar.saveState[0].click();
                } else if (window.EJS_emulator.gameManager) {
                    // Fallback to direct state save
                    const state = window.EJS_emulator.gameManager.getState();
                    window.EJS_emulator.storage.states.put(window.EJS_emulator.getBaseFileName() + ".state", state);
                    if (window.EJS_emulator.displayMessage) {
                        window.EJS_emulator.displayMessage("STATE SAVED");
                    }
                }
            } catch(e) {
                console.error("[TV] Save state trigger failed:", e);
            }
        }
        return;
    }

    // Smartphone Load State Macro Trigger (SELECT + MENU)
    if (button === 'LOAD_STATE' && action === 'DOWN') {
        if (window.EJS_emulator) {
            try {
                if (window.EJS_emulator.elements && window.EJS_emulator.elements.bottomBar && window.EJS_emulator.elements.bottomBar.loadState) {
                    window.EJS_emulator.elements.bottomBar.loadState[0].click();
                } else if (window.EJS_emulator.gameManager) {
                    // Fallback to direct state load
                    window.EJS_emulator.storage.states.get(window.EJS_emulator.getBaseFileName() + ".state").then(state => {
                        if (state) {
                            window.EJS_emulator.gameManager.loadState(state);
                            if (window.EJS_emulator.displayMessage) {
                                window.EJS_emulator.displayMessage("STATE LOADED");
                            }
                        }
                    });
                }
            } catch(e) {
                console.error("[TV] Load state trigger failed:", e);
            }
        }
        return;
    }

    // STEP 4: Mobile Input Bridge -> Route to Native Gamepads
    const gamepadIndex = player - 1; // Player 1 is array index 0
    const btnIndex = gamepadMap[button];

    if (btnIndex !== undefined) {
        const pad = getOrCreateGamepad(gamepadIndex);
        
        // Block normal START press to emulator if it is part of the macro combo
        if (button === 'START' && action === 'DOWN') {
            if (pad.buttons[gamepadMap['SELECT']].pressed) {
                return;
            }
        }

        const isPressed = action === 'DOWN';
        pad.buttons[btnIndex].pressed = isPressed;
        pad.buttons[btnIndex].value = isPressed ? 1 : 0;
        pad.timestamp = performance.now();
    }
}

function loadROM(game) {
    const gamePanel = document.getElementById('game-panel');
    if (!gamePanel) return;
    gamePanel.innerHTML = '<div id="game-div"></div>';
    
    // MODULE 3: Low-Spec Core Profiler & EmulatorJS Configuration
    // Map standard console names to high-performance legacy cores for low-spec devices.
    const coreMap = {
        'NES': 'fceumm',
        'SNES': 'snes9x', // Use snes9x (snes9x2005 is not in local cores)
        'SEGA': 'genesis_plus_gx', // Generally performant
        'GBA': 'mgba', // Use mgba (gpSP is not in local cores)
        'PS1': 'pcsx_rearmed' // Optimized for ARM, performs well on webOS
    };
    
    window.EJS_player = '#game-div';
    window.EJS_core = coreMap[game.console.toUpperCase()];
    window.EJS_gameUrl = game.path;
    window.EJS_pathtodata = '/assets/js/emulatorjs/data/';

    // Inject performance hacks and UI restrictions BEFORE loader.js executes.
    window.EJS_volume = 1.0; 
    window.EJS_startVolume = 100;
    window.EJS_audioLatency = 128; // Wider buffer to prevent audio stalls on weak CPUs

    // Configure buttons explicitly. Enable saveState and loadState so their DOM interfaces
    // and listeners are fully initialized, allowing us to programmatically trigger them.
    window.EJS_Buttons = {
        saveState: true,
        loadState: true,
        playPause: true,
        restart: false,
        mute: false,
        settings: false,
        fullscreen: false,
        volume: false,
        screenRecord: false,
        gamepad: false,
        cheat: false,
        saveSavFiles: false,
        loadSavFiles: false,
        quickSave: false,
        quickLoad: false,
        screenshot: false,
        cacheManager: false,
        exitEmulation: false
    };

    // Default configuration variables
    window.EJS_defaultOptions = {
        "save-state-location": "browser"
    };


    // Lifecycle hook to inject core-specific performance flags after the emulator initializes.
    window.EJS_onGameStart = function() {
        console.log("🚀 [EJS] onGameStart: Injecting performance flags for core:", window.EJS_core);
        if (window.EJS_core === 'pcsx_rearmed') {
            // These flags can significantly improve PS1 performance on low-end hardware.
            window.EJS_emulator.setGlobalOption('pcsx_rearmed_frameskip_type', 'auto');
            window.EJS_emulator.setGlobalOption('pcsx_rearmed_duping_enable', 'enabled');
            window.EJS_emulator.setGlobalOption('pcsx_rearmed_dithering', 'disabled');
        }
        // Future optimizations for other cores can be added here.
    };

    // 4. State Management Toggles
    window.EJS_stateSave = true; // Exposes state snapshot protocols
    window.EJS_stateLoad = true;

    window.EJS_startOnLoaded = true;

    // Inject the dynamic loader script
    const existingScript = document.getElementById('ejs-loader');
    if (existingScript) existingScript.remove();
    
    const script = document.createElement('script');
    script.id = 'ejs-loader';
    script.src = '/assets/js/emulatorjs/data/loader.js';
    document.body.appendChild(script);
}

// Fallback: Some modern browsers block audio auto-play until the user interacts with the page.
// This listener ensures the music starts playing the moment you click anywhere on the screen!
document.body.addEventListener('click', () => {
    playLobbyMusic();
}, { once: true });

// Expose globals for other scripts
window.ApplicationState = ApplicationState;
window.playLobbyMusic = playLobbyMusic;
window.openQrModal = openQrModal;
window.openLocalRomModal = openLocalRomModal;
window.closeLocalRomModal = closeLocalRomModal;
window.launchLocalROM = launchLocalROM;
window.getOrCreateGamepad = getOrCreateGamepad;
window.removeGamepad = removeGamepad;
window.processControllerInput = processControllerInput;
window.loadROM = loadROM;
