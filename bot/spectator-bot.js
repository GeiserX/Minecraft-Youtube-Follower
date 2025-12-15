const mineflayer = require('mineflayer');
const { mineflayer: viewerPlugin } = require('prismarine-viewer');
const Vec3 = require('vec3');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
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

// Track authentication state globally
let isAuthenticating = false;

// ============================================================================
// CONFIGURATION: Camera & Following
// ============================================================================
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_MS || '5000', 10);
const SWITCH_INTERVAL = parseInt(process.env.SWITCH_INTERVAL_MS || '30000', 10);

// Camera mode: 'third-person' (shows player) or 'spectate' (first-person POV)
const CAMERA_MODE = (process.env.CAMERA_MODE || 'third-person').toLowerCase();

// How often to update camera position (ms) - lower = smoother
const CAMERA_UPDATE_INTERVAL = parseInt(process.env.CAMERA_UPDATE_INTERVAL_MS || '500', 10);

// Camera positioning
const BASE_CAMERA_DISTANCE = parseFloat(process.env.CAMERA_DISTANCE || '6');
const BASE_CAMERA_HEIGHT = parseFloat(process.env.CAMERA_HEIGHT || '2');
const MIN_CAMERA_DISTANCE = 3;
const MAX_CAMERA_DISTANCE = 12;
const MIN_CAMERA_HEIGHT = 1;
const MAX_CAMERA_HEIGHT = 4;
const CAMERA_ANGLE_OFFSET = parseFloat(process.env.CAMERA_ANGLE_OFFSET || '0');

// Viewer settings
const VIEWER_VIEW_DISTANCE = parseInt(process.env.VIEWER_VIEW_DISTANCE || '6', 10);

// Showcase locations when no players online
const showcaseLocations = [
  { x: 0, y: 64, z: 0, description: 'Spawn' },
];

// ============================================================================
// STATE
// ============================================================================
let currentTarget = null;
let currentTargetName = '';
let lastActivity = {};
let trackingInterval = null;
let cameraUpdateInterval = null;
let showcaseActive = false;
let showcaseIndex = 0;
let lastCommandTime = 0;
let lastPlayerListSignature = '';
let playerRotationIndex = 0;

// Create bot
async function createBot() {
  console.log(`Connecting to server: ${config.host}:${config.port}`);
  console.log(`Camera mode: ${CAMERA_MODE}`);
  
  if (!config.azureClientId) {
    console.error('ERROR: AZURE_CLIENT_ID is required');
    process.exit(1);
  }

  try {
    const cacheFiles = fs.readdirSync(config.cacheDir).filter(f => f.endsWith('.json'));
    if (cacheFiles.length > 0) {
      console.log(`Found ${cacheFiles.length} cached auth file(s)`);
    }
  } catch (err) {
    console.log('Auth cache not ready:', err.message);
  }

  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: '1.21.4',
    auth: 'microsoft',
    profilesFolder: config.cacheDir,
    authTitle: config.azureClientId,
    flow: 'msal',
    msalConfig: {
      auth: {
        clientId: config.azureClientId,
        authority: config.msalAuthority
      }
    },
    onMsaCode: (info) => {
      isAuthenticating = true;
      const url = info?.verificationUri || info?.verification_uri;
      const code = info?.userCode || info?.user_code;
      console.log('');
      console.log('='.repeat(60));
      console.log('🔐 MICROSOFT AUTHENTICATION REQUIRED');
      console.log('='.repeat(60));
      console.log(`Go to: ${url}`);
      console.log(`Enter code: ${code}`);
      console.log('='.repeat(60));
    }
  });
  
  return new Promise((resolve, reject) => {
    bot.once('login', () => {
      isAuthenticating = false;
      console.log(`✓ Authenticated as: ${bot.username}`);
      resolve(bot);
    });
    
    bot.on('error', (err) => {
      if (isAuthenticating) return;
      reject(err);
    });
  });
}

let bot;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

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
        viewerPlugin(bot, {
          port: config.spectatorPort,
          viewDistance: VIEWER_VIEW_DISTANCE,
          firstPerson: true
        });
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
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      bot.quit();
      process.exit(1);
    }
  });

  bot.on('kicked', (reason) => {
    console.error('Bot kicked:', reason);
  });

  bot.on('end', () => {
    console.log('Bot disconnected');
    if (trackingInterval) clearInterval(trackingInterval);
    if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
    
    if (isAuthenticating) return;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      process.exit(1);
    }
    
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
    const players = Object.values(bot.players).filter(p =>
      p && p.username && p.username !== bot.username
    );

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
    
    let shouldSwitch = !currentTarget || !currentOnline || 
      (now - lastSwitchTime >= SWITCH_INTERVAL && players.length > 1);
    
    if (shouldSwitch) {
      playerRotationIndex = (playerRotationIndex + 1) % players.length;
      const newTarget = players[playerRotationIndex];
      
      if (!currentTarget || currentTarget.username !== newTarget.username) {
        console.log(`Following: ${newTarget.username}`);
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
    fs.writeFileSync('/app/config/current_target.txt', username);
  } catch (e) {}
}

function startContinuousFollow(player) {
  if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
  
  if (CAMERA_MODE === 'spectate') {
    bot.chat(`/spectate ${player.username}`);
    console.log(`Spectating ${player.username} (first-person)`);
    return;
  }
  
  // Third-person camera
  const updateCamera = () => {
    if (!currentTarget || currentTarget.username !== player.username) {
      if (cameraUpdateInterval) clearInterval(cameraUpdateInterval);
      return;
    }
    
    const targetPlayer = bot.players[player.username];
    if (!targetPlayer || !targetPlayer.entity) {
      const now = Date.now();
      if (now - lastCommandTime > 2000) {
        bot.chat(`/tp @s ${player.username}`);
        lastCommandTime = now;
      }
      return;
    }
    
    const playerPos = targetPlayer.entity.position;
    const playerYaw = targetPlayer.entity.yaw || 0;
    
    const { distance, height } = calculateAdaptiveCamera(targetPlayer);
    
    const angleOffset = (CAMERA_ANGLE_OFFSET * Math.PI) / 180;
    const cameraYaw = playerYaw + Math.PI + angleOffset;
    
    const cameraX = playerPos.x - Math.sin(cameraYaw) * distance;
    const cameraZ = playerPos.z + Math.cos(cameraYaw) * distance;
    const cameraY = playerPos.y + 1.62 + height;
    
    const targetEyeY = playerPos.y + 1.62;
    const dx = playerPos.x - cameraX;
    const dy = targetEyeY - cameraY;
    const dz = playerPos.z - cameraZ;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    
    const lookYaw = Math.atan2(-dx, dz);
    const lookPitch = Math.atan2(-dy, horizontalDist);
    
    const yawDeg = (lookYaw * 180) / Math.PI;
    const pitchDeg = (lookPitch * 180) / Math.PI;
    
    const cmd = `/tp @s ${cameraX.toFixed(2)} ${cameraY.toFixed(2)} ${cameraZ.toFixed(2)} ${yawDeg.toFixed(1)} ${pitchDeg.toFixed(1)}`;
    
    const now = Date.now();
    if (now - lastCommandTime > 100) {
      bot.chat(cmd);
      lastCommandTime = now;
    }
  };
  
  updateCamera();
  cameraUpdateInterval = setInterval(updateCamera, CAMERA_UPDATE_INTERVAL);
  console.log(`Following ${player.username} (third-person)`);
}

function calculateAdaptiveCamera(player) {
  if (!player.entity) {
    return { distance: BASE_CAMERA_DISTANCE, height: BASE_CAMERA_HEIGHT };
  }
  
  const pos = player.entity.position;
  const playerYaw = player.entity.yaw || 0;
  const behindYaw = playerYaw + Math.PI;
  
  let minClearDistance = MAX_CAMERA_DISTANCE;
  let ceilingHeight = MAX_CAMERA_HEIGHT;
  
  // Check behind player for obstacles
  for (let dist = 1; dist <= MAX_CAMERA_DISTANCE; dist += 1) {
    const checkX = pos.x - Math.sin(behindYaw) * dist;
    const checkZ = pos.z + Math.cos(behindYaw) * dist;
    
    for (let h = 0; h <= 4; h += 0.5) {
      try {
        const block = bot.blockAt(new Vec3(checkX, pos.y + 1.62 + h, checkZ));
        if (block && block.boundingBox !== 'empty') {
          if (dist < minClearDistance) minClearDistance = dist - 0.5;
          if (h < ceilingHeight && h > 0) ceilingHeight = h - 0.5;
        }
      } catch (e) {}
    }
  }
  
  // Check ceiling
  for (let h = 1; h <= 5; h += 0.5) {
    try {
      const block = bot.blockAt(pos.offset(0, 1.62 + h, 0));
      if (block && block.boundingBox !== 'empty') {
        ceilingHeight = Math.min(ceilingHeight, h - 0.5);
        break;
      }
    } catch (e) {}
  }
  
  // Count nearby blocks to detect indoor
  let solidCount = 0;
  for (let dx = -4; dx <= 4; dx += 2) {
    for (let dy = -1; dy <= 3; dy += 2) {
      for (let dz = -4; dz <= 4; dz += 2) {
        try {
          const block = bot.blockAt(pos.offset(dx, dy, dz));
          if (block && block.boundingBox !== 'empty') solidCount++;
        } catch (e) {}
      }
    }
  }
  
  const enclosureRatio = solidCount / 125;
  
  let distance = BASE_CAMERA_DISTANCE;
  distance = Math.min(distance, minClearDistance - 0.5);
  distance = distance * (1 - enclosureRatio * 0.5);
  distance = Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, distance));
  
  let height = BASE_CAMERA_HEIGHT;
  height = Math.min(height, ceilingHeight - 0.5);
  height = Math.max(MIN_CAMERA_HEIGHT, Math.min(MAX_CAMERA_HEIGHT, height));
  
  return { distance, height };
}

function showcaseBases() {
  if (showcaseActive) return;
  showcaseActive = true;
  currentTargetName = 'Showcase';
  writeCurrentTarget('Showcase');
  
  try {
    if (showcaseLocations.length === 0) return;
    
    const location = showcaseLocations[showcaseIndex];
    console.log(`Showcase: ${location.description}`);
    
    if (bot?.entity) {
      bot.chat(`/tp @s ${location.x} ${location.y} ${location.z}`);
    }
    
    showcaseIndex = (showcaseIndex + 1) % showcaseLocations.length;
  } catch (error) {
    showcaseActive = false;
  }
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
