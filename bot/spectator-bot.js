const mineflayer = require('mineflayer');
const { mineflayer: viewerPlugin } = require('prismarine-viewer');
const Vec3 = require('vec3');
const fs = require('fs');

// Configuration
const config = {
  host: process.env.SERVER_HOST || 'localhost',
  port: parseInt(process.env.SERVER_PORT || '25565'),
  username: process.env.MINECRAFT_USERNAME,
  version: '1.21.10',
  spectatorPort: parseInt(process.env.SPECTATOR_PORT || '3000'),
  cacheDir: process.env.AUTH_CACHE_DIR || '/app/config/.auth',
  azureClientId: process.env.AZURE_CLIENT_ID,
  msalAuthority: process.env.MSAL_AUTHORITY || 'https://login.microsoftonline.com/consumers'
};

if (!config.username) {
  console.error('Error: MINECRAFT_USERNAME must be set');
  process.exit(1);
}

let isAuthenticating = false;

// ============================================================================
// CAMERA CONFIGURATION
// ============================================================================
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_MS || '5000', 10);
const SWITCH_INTERVAL = parseInt(process.env.SWITCH_INTERVAL_MS || '30000', 10);
const CAMERA_MODE = (process.env.CAMERA_MODE || 'third-person').toLowerCase();
const CAMERA_UPDATE_INTERVAL = parseInt(process.env.CAMERA_UPDATE_INTERVAL_MS || '2000', 10);
const CAMERA_DISTANCE = parseFloat(process.env.CAMERA_DISTANCE || '8');
const CAMERA_HEIGHT = parseFloat(process.env.CAMERA_HEIGHT || '4');
const CAMERA_FIXED_ANGLE = parseFloat(process.env.CAMERA_FIXED_ANGLE || '0');
const VIEWER_VIEW_DISTANCE = parseInt(process.env.VIEWER_VIEW_DISTANCE || '6', 10);

// ============================================================================
// SHOWCASE TOUR - Flying tour when no players online
// Configure your server's interesting locations here!
// ============================================================================
const SHOWCASE_LOCATIONS = [
  // Format: { x, y, z, yaw, pitch, description, duration_ms }
  // yaw: 0=south, 90=west, 180=north, 270=east
  // pitch: 0=horizontal, negative=look up, positive=look down
  { x: 0, y: 80, z: 0, yaw: 0, pitch: 20, description: 'Spawn Overview', duration: 10000 },
  { x: 0, y: 64, z: 0, yaw: 90, pitch: 0, description: 'Spawn Ground', duration: 8000 },
  // Add your base locations below:
  // { x: 100, y: 70, z: -200, yaw: 45, pitch: 15, description: 'Castle', duration: 12000 },
  // { x: -500, y: 100, z: 300, yaw: 180, pitch: 25, description: 'Mountain Base', duration: 10000 },
];

// Time to spend at each showcase location (ms) - can be overridden per location
const SHOWCASE_DURATION = parseInt(process.env.SHOWCASE_DURATION_MS || '10000', 10);

// Shared file path for overlay (shared volume with streaming service)
const OVERLAY_FILE = '/app/config/shared/current_target.txt';

// ============================================================================
// STATE
// ============================================================================
let currentTarget = null;
let currentTargetName = '';
let trackingInterval = null;
let cameraUpdateInterval = null;
let showcaseActive = false;
let showcaseIndex = 0;
let lastCommandTime = 0;
let lastPlayerListSignature = '';
let playerRotationIndex = 0;
let showcaseInterval = null;

async function createBot() {
  console.log(`Connecting to server: ${config.host}:${config.port}`);
  console.log(`Camera mode: ${CAMERA_MODE}, update every ${CAMERA_UPDATE_INTERVAL}ms`);
  
  if (!config.azureClientId) {
    console.error('ERROR: AZURE_CLIENT_ID is required');
    process.exit(1);
  }

  try {
    const cacheFiles = fs.readdirSync(config.cacheDir).filter(f => f.endsWith('.json'));
    if (cacheFiles.length > 0) console.log(`Found ${cacheFiles.length} cached auth file(s)`);
  } catch (err) {}

  const bot = mineflayer.createBot({
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
      isAuthenticating = true;
      console.log('');
      console.log('='.repeat(60));
      console.log('🔐 MICROSOFT AUTHENTICATION REQUIRED');
      console.log('='.repeat(60));
      console.log(`Go to: ${info?.verificationUri || info?.verification_uri}`);
      console.log(`Enter code: ${info?.userCode || info?.user_code}`);
      console.log('='.repeat(60));
    }
  });
  
  return new Promise((resolve, reject) => {
    bot.once('login', () => {
      isAuthenticating = false;
      console.log(`✓ Authenticated as: ${bot.username}`);
      resolve(bot);
    });
    bot.on('error', (err) => { if (!isAuthenticating) reject(err); });
  });
}

let bot;
let consecutiveFailures = 0;

createBot().then(createdBot => {
  bot = createdBot;
  consecutiveFailures = 0;
  setupBot();
}).catch(error => {
  if (isAuthenticating) return;
  console.error('Failed to create bot:', error);
  process.exit(1);
});

function setupBot() {
  bot.on('spawn', () => {
    console.log('Bot spawned, entering spectator mode...');
    
    setTimeout(() => {
      bot.chat('/gamemode spectator');
      setTimeout(() => bot.chat('/fly on'), 500);
      
      console.log(`Bot position: ${bot.entity.position}`);
      console.log('Spectator mode: flying enabled, no gravity');
      
      // Ensure shared directory exists
      try {
        fs.mkdirSync('/app/config/shared', { recursive: true });
      } catch (e) {}
      
      try {
        viewerPlugin(bot, { port: config.spectatorPort, viewDistance: VIEWER_VIEW_DISTANCE, firstPerson: true });
        console.log(`Viewer at http://localhost:${config.spectatorPort}`);
      } catch (error) {
        console.error('Failed to create viewer:', error);
      }
      
      startPlayerTracking();
    }, 2000);
  });

  bot.on('error', (err) => {
    console.error('Bot error:', err);
    consecutiveFailures++;
    if (consecutiveFailures >= 3) { bot.quit(); process.exit(1); }
  });

  bot.on('kicked', (reason) => console.error('Bot kicked:', reason));

  bot.on('end', () => {
    console.log('Bot disconnected');
    clearAllIntervals();
    if (isAuthenticating) return;
    if (consecutiveFailures >= 3) process.exit(1);
    
    setTimeout(() => {
      createBot().then(createdBot => {
        bot = createdBot;
        consecutiveFailures = 0;
        setupBot();
      }).catch(() => process.exit(1));
    }, 10000);
  });
}

function clearAllIntervals() {
  if (trackingInterval) clearInterval(trackingInterval);
  if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
  if (showcaseInterval) clearInterval(showcaseInterval);
  trackingInterval = null;
  cameraUpdateInterval = null;
  showcaseInterval = null;
}

// ============================================================================
// PLAYER TRACKING
// ============================================================================

function startPlayerTracking() {
  clearAllIntervals();
  
  console.log(`Tracking: check ${CHECK_INTERVAL/1000}s, switch ${SWITCH_INTERVAL/1000}s`);
  console.log(`Showcase locations: ${SHOWCASE_LOCATIONS.length}`);
  
  let lastSwitchTime = Date.now();
  
  trackingInterval = setInterval(() => {
    const players = Object.values(bot.players).filter(p => p?.username && p.username !== bot.username);

    const names = players.map(p => p.username).sort();
    const signature = names.join(',');
    if (signature !== lastPlayerListSignature) {
      lastPlayerListSignature = signature;
      console.log(`Players (${players.length}): ${signature || '(none)'}`);
    }

    if (players.length === 0) {
      if (currentTarget !== null || !showcaseActive) {
        console.log('No players online - starting showcase tour');
        currentTarget = null;
        currentTargetName = '';
        if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
        cameraUpdateInterval = null;
        startShowcaseTour();
      }
      return;
    }
    
    // Players online - stop showcase
    if (showcaseActive) {
      console.log('Players detected - following players');
      stopShowcaseTour();
    }

    const now = Date.now();
    const currentOnline = currentTarget && players.some(p => p.username === currentTarget.username);
    
    if (!currentTarget || !currentOnline || (now - lastSwitchTime >= SWITCH_INTERVAL && players.length > 1)) {
      playerRotationIndex = (playerRotationIndex + 1) % players.length;
      const newTarget = players[playerRotationIndex];
      
      if (!currentTarget || currentTarget.username !== newTarget.username) {
        console.log(`Now following: ${newTarget.username}`);
      }
      
      currentTarget = newTarget;
      currentTargetName = newTarget.username;
      lastSwitchTime = now;
      
      writeOverlay(`Now following: ${newTarget.username}`);
      startContinuousFollow(currentTarget);
    }
  }, CHECK_INTERVAL);
}

function writeOverlay(text) {
  try {
    fs.writeFileSync(OVERLAY_FILE, text || '');
    console.log(`Overlay: "${text}"`);
  } catch (e) {
    console.error('Failed to write overlay:', e.message);
  }
}

// ============================================================================
// SHOWCASE TOUR (when no players online)
// ============================================================================

function startShowcaseTour() {
  if (showcaseActive) return;
  showcaseActive = true;
  showcaseIndex = 0;
  
  console.log('Starting showcase tour...');
  
  // Go to first location immediately
  goToShowcaseLocation();
  
  // Then rotate through locations
  showcaseInterval = setInterval(() => {
    showcaseIndex = (showcaseIndex + 1) % SHOWCASE_LOCATIONS.length;
    goToShowcaseLocation();
  }, SHOWCASE_LOCATIONS[showcaseIndex]?.duration || SHOWCASE_DURATION);
}

function stopShowcaseTour() {
  showcaseActive = false;
  if (showcaseInterval) {
    clearInterval(showcaseInterval);
    showcaseInterval = null;
  }
}

function goToShowcaseLocation() {
  if (SHOWCASE_LOCATIONS.length === 0) {
    writeOverlay('Showcase: Spawn');
    bot.chat('/tp @s 0 80 0 0 20');
    return;
  }
  
  const loc = SHOWCASE_LOCATIONS[showcaseIndex];
  const desc = loc.description || `Location ${showcaseIndex + 1}`;
  
  writeOverlay(`🎬 ${desc}`);
  console.log(`Showcase: ${desc} (${loc.x}, ${loc.y}, ${loc.z})`);
  
  // Teleport with rotation
  const yaw = loc.yaw !== undefined ? loc.yaw : 0;
  const pitch = loc.pitch !== undefined ? loc.pitch : 20;
  bot.chat(`/tp @s ${loc.x} ${loc.y} ${loc.z} ${yaw} ${pitch}`);
}

// ============================================================================
// PLAYER FOLLOWING
// ============================================================================

function startContinuousFollow(player) {
  if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
  
  if (CAMERA_MODE === 'spectate') {
    bot.chat(`/spectate ${player.username}`);
    console.log(`Spectating ${player.username} (first-person)`);
    return;
  }
  
  const updateCamera = () => {
    if (!currentTarget || currentTarget.username !== player.username) {
      if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
      return;
    }
    
    const targetPlayer = bot.players[player.username];
    if (!targetPlayer?.entity) {
      const now = Date.now();
      if (now - lastCommandTime > 3000) {
        bot.chat(`/tp @s ${player.username}`);
        lastCommandTime = now;
      }
      return;
    }
    
    const playerPos = targetPlayer.entity.position;
    const angleRad = (CAMERA_FIXED_ANGLE * Math.PI) / 180;
    
    const cameraX = playerPos.x - Math.sin(angleRad) * CAMERA_DISTANCE;
    const cameraZ = playerPos.z + Math.cos(angleRad) * CAMERA_DISTANCE;
    const cameraY = playerPos.y + CAMERA_HEIGHT;
    
    const targetY = playerPos.y + 1.0;
    const dx = playerPos.x - cameraX;
    const dy = targetY - cameraY;
    const dz = playerPos.z - cameraZ;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    
    const lookYaw = Math.atan2(-dx, dz);
    const lookPitch = Math.atan2(-dy, horizontalDist);
    
    const yawDeg = (lookYaw * 180) / Math.PI;
    const pitchDeg = (lookPitch * 180) / Math.PI;
    
    const cmd = `/tp @s ${cameraX.toFixed(2)} ${cameraY.toFixed(2)} ${cameraZ.toFixed(2)} ${yawDeg.toFixed(1)} ${pitchDeg.toFixed(1)}`;
    
    const now = Date.now();
    if (now - lastCommandTime > 500) {
      bot.chat(cmd);
      lastCommandTime = now;
    }
  };
  
  updateCamera();
  cameraUpdateInterval = setInterval(updateCamera, CAMERA_UPDATE_INTERVAL);
  console.log(`Following ${player.username} (third-person, stable camera)`);
}

// ============================================================================
// CLEANUP
// ============================================================================

process.on('SIGINT', () => {
  clearAllIntervals();
  if (bot) bot.quit();
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearAllIntervals();
  if (bot) bot.quit();
  process.exit(0);
});
