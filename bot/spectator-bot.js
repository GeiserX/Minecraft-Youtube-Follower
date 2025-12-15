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

// Camera mode: 'third-person' (stable behind player) or 'spectate' (first-person)
const CAMERA_MODE = (process.env.CAMERA_MODE || 'third-person').toLowerCase();

// Camera update interval - HIGHER = smoother/less jerky (default 2000ms = every 2 seconds)
const CAMERA_UPDATE_INTERVAL = parseInt(process.env.CAMERA_UPDATE_INTERVAL_MS || '2000', 10);

// Camera positioning - FIXED direction, doesn't follow player's facing
const CAMERA_DISTANCE = parseFloat(process.env.CAMERA_DISTANCE || '8');
const CAMERA_HEIGHT = parseFloat(process.env.CAMERA_HEIGHT || '4');

// Fixed camera angle (compass direction): 0=south, 90=west, 180=north, 270=east
// This keeps the camera stable regardless of where the player looks
const CAMERA_FIXED_ANGLE = parseFloat(process.env.CAMERA_FIXED_ANGLE || '0');

const VIEWER_VIEW_DISTANCE = parseInt(process.env.VIEWER_VIEW_DISTANCE || '6', 10);

const showcaseLocations = [
  { x: 0, y: 64, z: 0, description: 'Spawn' },
];

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

// Smooth camera position (interpolated)
let smoothCameraPos = null;

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
      console.log(`Bot position: ${bot.entity.position}`);
      
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
    if (trackingInterval) clearInterval(trackingInterval);
    if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
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

// ============================================================================
// PLAYER TRACKING
// ============================================================================

function startPlayerTracking() {
  if (trackingInterval) clearInterval(trackingInterval);
  if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
  
  console.log(`Tracking: check ${CHECK_INTERVAL/1000}s, switch ${SWITCH_INTERVAL/1000}s`);
  
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
      if (currentTarget !== null) {
        console.log('No players - showcase mode');
        currentTarget = null;
        currentTargetName = '';
        writeCurrentTarget('');
        if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
      }
      if (!showcaseActive) showcaseBases();
      return;
    }
    
    if (showcaseActive) {
      console.log('Players detected');
      showcaseActive = false;
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
      
      writeCurrentTarget(newTarget.username);
      startContinuousFollow(currentTarget);
    }
  }, CHECK_INTERVAL);
}

function writeCurrentTarget(username) {
  try {
    const text = username ? `Now following: ${username}` : '';
    fs.writeFileSync('/app/config/current_target.txt', text);
  } catch (e) {}
}

function startContinuousFollow(player) {
  if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
  
  if (CAMERA_MODE === 'spectate') {
    bot.chat(`/spectate ${player.username}`);
    console.log(`Spectating ${player.username} (first-person)`);
    return;
  }
  
  // Third-person camera - STABLE, doesn't follow player's facing direction
  // Camera stays at a fixed compass angle relative to the player
  const updateCamera = () => {
    if (!currentTarget || currentTarget.username !== player.username) {
      if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
      return;
    }
    
    const targetPlayer = bot.players[player.username];
    if (!targetPlayer?.entity) {
      // Player not in render distance - teleport to them
      const now = Date.now();
      if (now - lastCommandTime > 3000) {
        bot.chat(`/tp @s ${player.username}`);
        lastCommandTime = now;
      }
      return;
    }
    
    const playerPos = targetPlayer.entity.position;
    
    // FIXED camera angle (doesn't change with player facing)
    const angleRad = (CAMERA_FIXED_ANGLE * Math.PI) / 180;
    
    // Calculate camera position at fixed angle behind player
    const cameraX = playerPos.x - Math.sin(angleRad) * CAMERA_DISTANCE;
    const cameraZ = playerPos.z + Math.cos(angleRad) * CAMERA_DISTANCE;
    const cameraY = playerPos.y + CAMERA_HEIGHT;
    
    // Calculate look direction towards player's chest (not head for more stability)
    const targetY = playerPos.y + 1.0; // Chest height
    const dx = playerPos.x - cameraX;
    const dy = targetY - cameraY;
    const dz = playerPos.z - cameraZ;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    
    const lookYaw = Math.atan2(-dx, dz);
    const lookPitch = Math.atan2(-dy, horizontalDist);
    
    const yawDeg = (lookYaw * 180) / Math.PI;
    const pitchDeg = (lookPitch * 180) / Math.PI;
    
    // Teleport camera
    const cmd = `/tp @s ${cameraX.toFixed(2)} ${cameraY.toFixed(2)} ${cameraZ.toFixed(2)} ${yawDeg.toFixed(1)} ${pitchDeg.toFixed(1)}`;
    
    const now = Date.now();
    if (now - lastCommandTime > 500) { // Rate limit
      bot.chat(cmd);
      lastCommandTime = now;
    }
  };
  
  updateCamera();
  cameraUpdateInterval = setInterval(updateCamera, CAMERA_UPDATE_INTERVAL);
  console.log(`Following ${player.username} (third-person, stable camera)`);
}

function showcaseBases() {
  if (showcaseActive) return;
  showcaseActive = true;
  writeCurrentTarget('Showcase');
  
  if (showcaseLocations.length === 0) return;
  
  const location = showcaseLocations[showcaseIndex];
  console.log(`Showcase: ${location.description}`);
  
  if (bot?.entity) {
    bot.chat(`/tp @s ${location.x} ${location.y} ${location.z}`);
  }
  
  showcaseIndex = (showcaseIndex + 1) % showcaseLocations.length;
}

process.on('SIGINT', () => {
  if (trackingInterval) clearInterval(trackingInterval);
  if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
  if (bot) bot.quit();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (trackingInterval) clearInterval(trackingInterval);
  if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
  if (bot) bot.quit();
  process.exit(0);
});
