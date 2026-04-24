/**
 * Extracted bot logic for testability.
 *
 * All pure-logic helpers and stateful routines live here so they can be
 * required and tested without spawning a real Minecraft connection.
 *
 * The main entry-point (spectator-bot.js) wires these together with the
 * real mineflayer / fs / prismarine-viewer dependencies.
 */

const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

function loadConfig(env) {
  env = env || process.env;
  return {
    host: env.SERVER_HOST || 'localhost',
    port: parseInt(env.SERVER_PORT || '25565'),
    username: env.MINECRAFT_USERNAME,
    version: '1.21.10',
    spectatorPort: parseInt(env.SPECTATOR_PORT || '3000'),
    cacheDir: env.AUTH_CACHE_DIR || '/app/config/.auth',
    azureClientId: env.AZURE_CLIENT_ID,
    msalAuthority: env.MSAL_AUTHORITY || 'https://login.microsoftonline.com/consumers'
  };
}

function loadCameraConfig(env) {
  env = env || process.env;
  return {
    CHECK_INTERVAL: parseInt(env.CHECK_INTERVAL_MS || '5000', 10),
    SWITCH_INTERVAL: parseInt(env.SWITCH_INTERVAL_MS || '30000', 10),
    CAMERA_MODE: (env.CAMERA_MODE || 'third-person').toLowerCase(),
    CAMERA_UPDATE_INTERVAL: parseInt(env.CAMERA_UPDATE_INTERVAL_MS || '2000', 10),
    CAMERA_DISTANCE: parseFloat(env.CAMERA_DISTANCE || '5'),
    CAMERA_HEIGHT: parseFloat(env.CAMERA_HEIGHT || '1.5'),
    CAMERA_FIXED_ANGLE: parseFloat(env.CAMERA_FIXED_ANGLE || '0'),
    VIEWER_VIEW_DISTANCE: parseInt(env.VIEWER_VIEW_DISTANCE || '6', 10)
  };
}

// ============================================================================
// SHOWCASE LOCATIONS (default)
// ============================================================================

const DEFAULT_SHOWCASE_LOCATIONS = [
  { x: 0, y: 80, z: 0, yaw: 0, pitch: 20, description: 'Spawn Overview', duration: 10000 },
  { x: 0, y: 64, z: 0, yaw: 90, pitch: 0, description: 'Spawn Ground', duration: 8000 },
];

// ============================================================================
// FILE I/O HELPERS
// ============================================================================

const OVERLAY_FILE = '/app/config/shared/current_target.txt';
const STREAM_STATUS_FILE = '/app/config/shared/stream_status.txt';

function writeOverlay(text, filePath) {
  filePath = filePath || OVERLAY_FILE;
  try {
    fs.writeFileSync(filePath, text || '');
    console.log(`Overlay: "${text}"`);
    return true;
  } catch (e) {
    console.error('Failed to write overlay:', e.message);
    return false;
  }
}

function writeStreamStatus(status, filePath) {
  filePath = filePath || STREAM_STATUS_FILE;
  try {
    fs.writeFileSync(filePath, status);
    console.log(`Stream status: ${status}`);
    return true;
  } catch (e) {
    console.error('Failed to write stream status:', e.message);
    return false;
  }
}

// ============================================================================
// INTERVAL MANAGEMENT
// ============================================================================

function clearAllIntervals(state) {
  if (state.trackingInterval) clearInterval(state.trackingInterval);
  if (state.cameraUpdateInterval) clearInterval(state.cameraUpdateInterval);
  if (state.showcaseInterval) clearInterval(state.showcaseInterval);
  state.trackingInterval = null;
  state.cameraUpdateInterval = null;
  state.showcaseInterval = null;
}

function createState() {
  return {
    currentTarget: null,
    currentTargetName: '',
    trackingInterval: null,
    cameraUpdateInterval: null,
    showcaseActive: false,
    showcaseIndex: 0,
    lastCommandTime: 0,
    lastPlayerListSignature: '',
    playerRotationIndex: 0,
    showcaseInterval: null,
    isAuthenticating: false,
    consecutiveFailures: 0,
    bot: null,
  };
}

// ============================================================================
// SHOWCASE TOUR
// ============================================================================

function goToShowcaseLocation(bot, state, locations, showcaseDuration) {
  locations = locations || DEFAULT_SHOWCASE_LOCATIONS;

  if (locations.length === 0) {
    writeOverlay('Showcase: Spawn');
    bot.chat('/tp @s 0 80 0 0 20');
    return;
  }

  const loc = locations[state.showcaseIndex];
  const desc = loc.description || `Location ${state.showcaseIndex + 1}`;

  writeOverlay(`\uD83C\uDFAC ${desc}`);
  console.log(`Showcase: ${desc} (${loc.x}, ${loc.y}, ${loc.z})`);

  const yaw = loc.yaw !== undefined ? loc.yaw : 0;
  const pitch = loc.pitch !== undefined ? loc.pitch : 20;
  bot.chat(`/tp @s ${loc.x} ${loc.y} ${loc.z} ${yaw} ${pitch}`);
}

function startShowcaseTour(bot, state, locations, showcaseDuration) {
  locations = locations || DEFAULT_SHOWCASE_LOCATIONS;
  showcaseDuration = showcaseDuration || 10000;

  if (state.showcaseActive) return;
  state.showcaseActive = true;
  state.showcaseIndex = 0;

  console.log('Starting showcase tour...');

  goToShowcaseLocation(bot, state, locations, showcaseDuration);

  state.showcaseInterval = setInterval(() => {
    state.showcaseIndex = (state.showcaseIndex + 1) % locations.length;
    goToShowcaseLocation(bot, state, locations, showcaseDuration);
  }, locations[state.showcaseIndex]?.duration || showcaseDuration);
}

function stopShowcaseTour(state) {
  state.showcaseActive = false;
  if (state.showcaseInterval) {
    clearInterval(state.showcaseInterval);
    state.showcaseInterval = null;
  }
}

// ============================================================================
// PLAYER FOLLOWING
// ============================================================================

function buildCameraCommand(botUsername, playerUsername, height, distance) {
  const cappedHeight = Math.min(height, 2);
  const cappedDistance = Math.min(distance, 6);
  return `/execute as ${playerUsername} at @s anchored eyes rotated ~ 0 positioned ^ ^${cappedHeight} ^-${cappedDistance} run tp ${botUsername} ~ ~ ~ facing entity ${playerUsername} eyes`;
}

function startContinuousFollow(bot, state, player, cameraConfig) {
  if (state.cameraUpdateInterval) clearInterval(state.cameraUpdateInterval);

  if (cameraConfig.CAMERA_MODE === 'spectate') {
    bot.chat(`/spectate ${player.username}`);
    console.log(`Spectating ${player.username} (first-person, server-controlled)`);
    return;
  }

  const updateCamera = () => {
    if (!state.currentTarget || state.currentTarget.username !== player.username) {
      if (state.cameraUpdateInterval) clearInterval(state.cameraUpdateInterval);
      return;
    }

    const now = Date.now();
    if (now - state.lastCommandTime < 400) return;

    const cmd = buildCameraCommand(
      bot.username,
      player.username,
      cameraConfig.CAMERA_HEIGHT,
      cameraConfig.CAMERA_DISTANCE
    );

    bot.chat(cmd);
    state.lastCommandTime = now;
  };

  updateCamera();

  state.cameraUpdateInterval = setInterval(updateCamera, Math.min(cameraConfig.CAMERA_UPDATE_INTERVAL, 500));
  console.log(`Following ${player.username} (third-person, server-controlled camera)`);
}

// ============================================================================
// PLAYER TRACKING
// ============================================================================

function getOnlinePlayers(bot) {
  return Object.values(bot.players).filter(p => p?.username && p.username !== bot.username);
}

function handlePlayerCheck(bot, state, cameraConfig, locations, showcaseDuration) {
  const players = getOnlinePlayers(bot);

  const names = players.map(p => p.username).sort();
  const signature = names.join(',');
  if (signature !== state.lastPlayerListSignature) {
    state.lastPlayerListSignature = signature;
    console.log(`Players (${players.length}): ${signature || '(none)'}`);
  }

  if (players.length === 0) {
    if (state.currentTarget !== null || !state.showcaseActive) {
      console.log('No players online - pausing stream');
      state.currentTarget = null;
      state.currentTargetName = '';
      if (state.cameraUpdateInterval) clearInterval(state.cameraUpdateInterval);
      state.cameraUpdateInterval = null;
      writeStreamStatus('paused');
      writeOverlay('Server empty - stream paused');
    }
    return { action: 'no_players' };
  }

  if (state.showcaseActive || !state.currentTarget) {
    console.log('Players detected - resuming stream');
    stopShowcaseTour(state);
    writeStreamStatus('active');
  }

  const now = Date.now();
  const currentOnline = state.currentTarget && players.some(p => p.username === state.currentTarget.username);

  if (!state.currentTarget || !currentOnline || (now - state._lastSwitchTime >= cameraConfig.SWITCH_INTERVAL && players.length > 1)) {
    state.playerRotationIndex = (state.playerRotationIndex + 1) % players.length;
    const newTarget = players[state.playerRotationIndex];

    if (!state.currentTarget || state.currentTarget.username !== newTarget.username) {
      console.log(`Now following: ${newTarget.username}`);
    }

    state.currentTarget = newTarget;
    state.currentTargetName = newTarget.username;
    state._lastSwitchTime = now;

    writeOverlay(`Now following: ${newTarget.username}`);
    startContinuousFollow(bot, state, newTarget, cameraConfig);

    return { action: 'switched', target: newTarget.username };
  }

  return { action: 'no_change', target: state.currentTargetName };
}

function startPlayerTracking(bot, state, cameraConfig, locations, showcaseDuration) {
  clearAllIntervals(state);

  console.log(`Tracking: check ${cameraConfig.CHECK_INTERVAL / 1000}s, switch ${cameraConfig.SWITCH_INTERVAL / 1000}s`);
  console.log(`Showcase locations: ${(locations || DEFAULT_SHOWCASE_LOCATIONS).length}`);

  writeStreamStatus('paused');

  state._lastSwitchTime = Date.now();

  state.trackingInterval = setInterval(() => {
    handlePlayerCheck(bot, state, cameraConfig, locations, showcaseDuration);
  }, cameraConfig.CHECK_INTERVAL);
}

// ============================================================================
// BOT CREATION
// ============================================================================

function createBot(mineflayerModule, config) {
  const state = { isAuthenticating: false };

  if (!config.azureClientId) {
    console.error('ERROR: AZURE_CLIENT_ID is required');
    return Promise.reject(new Error('AZURE_CLIENT_ID is required'));
  }

  try {
    const cacheFiles = fs.readdirSync(config.cacheDir).filter(f => f.endsWith('.json'));
    if (cacheFiles.length > 0) console.log(`Found ${cacheFiles.length} cached auth file(s)`);
  } catch (err) {
    // Cache dir may not exist yet
  }

  const bot = mineflayerModule.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: '1.21.4',
    auth: 'microsoft',
    profilesFolder: config.cacheDir,
    authTitle: config.azureClientId,
    flow: 'msal',
    msalConfig: { auth: { clientId: config.azureClientId, authority: config.msalAuthority } },
    onMsaCode: (info) => {
      state.isAuthenticating = true;
      console.log('');
      console.log('='.repeat(60));
      console.log('MICROSOFT AUTHENTICATION REQUIRED');
      console.log('='.repeat(60));
      console.log(`Go to: ${info?.verificationUri || info?.verification_uri}`);
      console.log(`Enter code: ${info?.userCode || info?.user_code}`);
      console.log('='.repeat(60));
    }
  });

  return new Promise((resolve, reject) => {
    bot.once('login', () => {
      state.isAuthenticating = false;
      console.log(`Authenticated as: ${bot.username}`);
      resolve(bot);
    });
    bot.on('error', (err) => {
      if (!state.isAuthenticating) reject(err);
    });
  });
}

// ============================================================================
// BOT SETUP (event wiring)
// ============================================================================

function setupBot(bot, state, config, cameraConfig, viewerPlugin, locations) {
  bot.on('spawn', () => {
    console.log('Bot spawned, entering spectator mode...');

    setTimeout(() => {
      bot.chat('/gamemode spectator');

      setTimeout(() => {
        if (bot.physics) {
          bot.physics.gravity = 0;
          bot.physics.yawSpeed = 0;
          bot.physics.pitchSpeed = 0;
        }

        if (bot.creative) {
          bot.creative.flying = true;
          bot.creative.flyingSpeed = 0.5;
        }

        if (bot.entity && bot.entity.velocity) {
          bot.entity.velocity.y = 0;
        }

        console.log(`Bot position: ${bot.entity ? bot.entity.position : 'unknown'}`);
        console.log('Spectator mode: gravity disabled, flying enabled');
      }, 500);

      try {
        fs.mkdirSync('/app/config/shared', { recursive: true });
      } catch (e) {}

      if (viewerPlugin) {
        try {
          viewerPlugin(bot, { port: config.spectatorPort, viewDistance: cameraConfig.VIEWER_VIEW_DISTANCE, firstPerson: true });
          console.log(`Viewer at http://localhost:${config.spectatorPort}`);
        } catch (error) {
          console.error('Failed to create viewer:', error);
        }
      }

      startPlayerTracking(bot, state, cameraConfig, locations);
    }, 2000);
  });

  bot.on('error', (err) => {
    console.error('Bot error:', err);
    state.consecutiveFailures++;
    if (state.consecutiveFailures >= 3) {
      bot.quit();
    }
  });

  bot.on('kicked', (reason) => console.error('Bot kicked:', reason));

  bot.on('end', () => {
    console.log('Bot disconnected');
    clearAllIntervals(state);
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Config
  loadConfig,
  loadCameraConfig,
  DEFAULT_SHOWCASE_LOCATIONS,
  OVERLAY_FILE,
  STREAM_STATUS_FILE,

  // State
  createState,

  // File I/O
  writeOverlay,
  writeStreamStatus,

  // Intervals
  clearAllIntervals,

  // Showcase
  goToShowcaseLocation,
  startShowcaseTour,
  stopShowcaseTour,

  // Camera
  buildCameraCommand,
  startContinuousFollow,

  // Player tracking
  getOnlinePlayers,
  handlePlayerCheck,
  startPlayerTracking,

  // Bot lifecycle
  createBot,
  setupBot,
};
