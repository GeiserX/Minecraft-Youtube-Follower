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
  version: '1.21.10', // Match server version
  spectatorPort: parseInt(process.env.SPECTATOR_PORT || '3000'),
  cacheDir: process.env.AUTH_CACHE_DIR || '/app/config/.auth',
  azureClientId: process.env.AZURE_CLIENT_ID, // Azure app client ID
  // MSAL authority: consumers is usually correct for personal Microsoft accounts.
  // If you get tenant/consent errors, try: https://login.microsoftonline.com/common
  msalAuthority: process.env.MSAL_AUTHORITY || 'https://login.microsoftonline.com/consumers'
};

if (!config.username) {
  console.error('Error: MINECRAFT_USERNAME must be set');
  process.exit(1);
}

// CRITICAL: Track authentication state globally
let isAuthenticating = false;

// ============================================================================
// CONFIGURATION: Following & Camera
// ============================================================================
// How often we refresh the player list (detect who's online)
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL_MS || '5000', 10); // 5s default

// How often we SWITCH to a different player (rotate between players)
const SWITCH_INTERVAL = parseInt(process.env.SWITCH_INTERVAL_MS || '30000', 10); // 30s

// CONTINUOUS FOLLOWING:
// When enabled, we use /spectate for truly smooth real-time following.
// This attaches the camera to the player (first-person POV).
// When disabled, we teleport behind the player periodically (third-person).
const USE_SPECTATE = (process.env.USE_SPECTATE || 'true').toLowerCase() === 'true';

// For non-spectate mode: how often to update position (continuous follow)
const FOLLOW_UPDATE_INTERVAL = parseInt(process.env.FOLLOW_UPDATE_INTERVAL_MS || '2000', 10); // 2s

// Base camera distance (will adapt based on environment)
const BASE_FOLLOW_DISTANCE = parseFloat(process.env.FOLLOW_DISTANCE || '8'); // blocks behind
const BASE_FOLLOW_HEIGHT = parseFloat(process.env.FOLLOW_HEIGHT || '3'); // blocks above
const MIN_FOLLOW_DISTANCE = 4;
const MAX_FOLLOW_DISTANCE = 15;

// Viewer performance: lower = faster but less visibility
const VIEWER_VIEW_DISTANCE = parseInt(process.env.VIEWER_VIEW_DISTANCE || '6', 10);

// Showcase locations when no players online
const showcaseLocations = [
  { x: 0, y: 64, z: 0, description: 'Spawn' },
  // Add more interesting locations as needed
];

// ============================================================================
// STATE
// ============================================================================
let currentTarget = null;
let lastActivity = {};
let trackingInterval = null;
let followUpdateInterval = null;
let showcaseActive = false;
let showcaseIndex = 0;
let lastCommandTime = 0;
let lastPlayerListSignature = '';
let playerRotationIndex = 0;

// Create bot using the SHARED authflow instance
async function createBot() {
  console.log(`Connecting to server: ${config.host}:${config.port}`);
  console.log(`Using protocol 767 (1.21.4) - ViaBackwards will translate to server's 1.21.10`);
  
  if (!config.azureClientId) {
    console.error('='.repeat(60));
    console.error('ERROR: AZURE_CLIENT_ID is required in .env file');
    console.error('This must be your Azure App Registration (clientId).');
    console.error('See docs/SETUP.md');
    console.error('='.repeat(60));
    process.exit(1);
  }

  // Log cache files (helps debug persistence)
  try {
    const cacheFiles = fs.readdirSync(config.cacheDir).filter(f => f.endsWith('.json'));
    if (cacheFiles.length > 0) {
      console.log(`Found ${cacheFiles.length} cached authentication file(s) - will reuse tokens`);
    } else {
      console.log('No cached authentication files found yet (first login).');
    }
  } catch (err) {
    console.log('Auth cache dir not readable yet (will be created):', err.message);
  }

  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: '1.21.4',
    auth: 'microsoft',
    // IMPORTANT:
    // We pass microsoft-protocol auth options directly so it uses MSAL device-code flow
    // (microsoft.com/devicelogin) instead of the default "live/Nintendo" flow
    // (microsoft.com/link) which can trigger "first party app / consent" failures.
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
      // Prevent reconnect loops / multiple codes.
      isAuthenticating = true;
      const verificationUri = info?.verificationUri || info?.verification_uri || info?.verification_url;
      const userCode = info?.userCode || info?.user_code || info?.code;
      console.log('');
      console.log('='.repeat(60));
      console.log('🔐 MICROSOFT AUTHENTICATION REQUIRED (MSAL device code)');
      console.log('='.repeat(60));
      console.log(`ClientId: ${config.azureClientId}`);
      console.log(`Authority: ${config.msalAuthority}`);
      console.log(`Go to: ${verificationUri || '(missing verification URL from MSAL response)'}`);
      console.log(`Enter code: ${userCode || '(missing code from MSAL response)'}`);
      console.log('='.repeat(60));
      console.log('⏳ Waiting for you to complete authentication...');
      console.log('   (This should be a ONE-TIME setup; tokens are cached in the auth volume)');
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
      // If we're waiting for device-code auth, do NOT treat this as fatal/retry-worthy.
      if (isAuthenticating) return;
      reject(err);
    });
  });
}

// Initialize bot and set up event handlers
let bot;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

// Start the bot
createBot().then(createdBot => {
    console.log('Bot instance created successfully, setting up event handlers...');
    bot = createdBot;
    consecutiveFailures = 0;
    setupBot();
  }).catch(error => {
    if (isAuthenticating) {
      console.log('Waiting for authentication to complete...');
      return;
    }
    
    console.error('Failed to create bot:', error);
    consecutiveFailures++;
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`ERROR: Failed to connect ${MAX_CONSECUTIVE_FAILURES} times in a row.`);
      process.exit(1);
    } else {
      console.error(`Connection failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}). Will retry...`);
      process.exit(1);
    }
  });

let viewer = null;

function setupBot() {
  bot.on('spawn', () => {
    console.log('Bot spawned, switching to spectator mode...');
    
    setTimeout(() => {
      bot.chat('/gamemode spectator');
      console.log('Bot is now in spectator mode');
      console.log(`Bot position: ${bot.entity.position}`);
      
      // Create viewer with REDUCED viewDistance for performance
      try {
        viewerPlugin(bot, {
          port: config.spectatorPort,
          viewDistance: VIEWER_VIEW_DISTANCE, // Lower = faster rendering
          firstPerson: true
        });
        console.log(`Prismarine viewer initialized (viewDistance: ${VIEWER_VIEW_DISTANCE})`);
        console.log(`Viewer accessible at: http://localhost:${config.spectatorPort}`);
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
      console.error(`ERROR: Bot encountered ${MAX_CONSECUTIVE_FAILURES} consecutive errors.`);
      bot.quit();
      process.exit(1);
      return;
    }
    
    console.error(`Error count: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`);
  });

  bot.on('kicked', (reason) => {
    console.error('Bot kicked:', reason);
    if (reason.includes('throttled') || reason.includes('wait')) {
      console.log('Connection throttled, waiting 30 seconds before retry...');
      setTimeout(() => {
        createBot().then(createdBot => {
          bot = createdBot;
          setupBot();
        }).catch(error => {
          console.error('Failed to reconnect:', error);
        });
      }, 30000);
    }
  });

  bot.on('end', () => {
    console.log('Bot disconnected');
    
    // Stop intervals
    if (trackingInterval) clearInterval(trackingInterval);
    if (followUpdateInterval) clearInterval(followUpdateInterval);
    trackingInterval = null;
    followUpdateInterval = null;
    
    if (isAuthenticating) {
      console.log('Authentication in progress; not reconnecting / not generating new codes.');
      return;
    }
    
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(`ERROR: Exceeded maximum consecutive failures.`);
      process.exit(1);
      return;
    }
    
    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${consecutiveFailures + 1}/${MAX_CONSECUTIVE_FAILURES})`);
      createBot().then(createdBot => {
        bot = createdBot;
        consecutiveFailures = 0;
        setupBot();
      }).catch(error => {
        consecutiveFailures++;
        console.error(`Failed to reconnect: ${error.message}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          process.exit(1);
        }
      });
    }, 10000);
  });
}

// ============================================================================
// PLAYER TRACKING
// ============================================================================

function startPlayerTracking() {
  // Prevent multiple intervals
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  if (followUpdateInterval) {
    clearInterval(followUpdateInterval);
    followUpdateInterval = null;
  }
  
  console.log(`Player tracking started (check every ${CHECK_INTERVAL/1000}s, switch every ${SWITCH_INTERVAL/1000}s)`);
  console.log(`Following mode: ${USE_SPECTATE ? '/spectate (first-person, smooth)' : '/tp (third-person, adaptive camera)'}`);
  
  let lastSwitchTime = Date.now();
  
  // Main loop: check player list and decide who to follow
  trackingInterval = setInterval(() => {
    const players = Object.values(bot.players).filter(p =>
      p && p.username && p.username !== bot.username
    );

    // Log player list only when it changes
    const names = players.map(p => p.username).sort();
    const signature = names.join(',');
    if (signature !== lastPlayerListSignature) {
      lastPlayerListSignature = signature;
      console.log(`Players online (${players.length}): ${signature || '(none)'}`);
    }

    if (players.length === 0) {
      // No players - showcase mode
      if (currentTarget !== null) {
        console.log('No players online - switching to showcase mode');
        currentTarget = null;
        if (followUpdateInterval) {
          clearInterval(followUpdateInterval);
          followUpdateInterval = null;
        }
      }
      if (!showcaseActive) {
        showcaseBases();
      }
      return;
    }
    
    // Players are online - disable showcase
    if (showcaseActive) {
      console.log('Players detected - following players');
      showcaseActive = false;
    }

    const now = Date.now();
    const timeSinceSwitch = now - lastSwitchTime;
    
    // Decide if we should switch targets
    const currentTargetOnline = currentTarget && players.some(p => p.username === currentTarget.username);
    
    let shouldSwitch = false;
    let reason = '';
    
    if (!currentTarget) {
      shouldSwitch = true;
      reason = 'first target';
    } else if (!currentTargetOnline) {
      shouldSwitch = true;
      reason = 'target left';
    } else if (timeSinceSwitch >= SWITCH_INTERVAL && players.length > 1) {
      shouldSwitch = true;
      reason = 'rotation';
    }
    
    if (shouldSwitch) {
      // Round-robin through players
      playerRotationIndex = (playerRotationIndex + 1) % players.length;
      const newTarget = players[playerRotationIndex];
      
      if (currentTarget && currentTarget.username !== newTarget.username) {
        console.log(`Switching: ${currentTarget.username} -> ${newTarget.username} (${reason})`);
      } else if (!currentTarget) {
        console.log(`Following: ${newTarget.username}`);
      }
      
      currentTarget = newTarget;
      lastSwitchTime = now;
      
      // Start continuous following for this target
      startContinuousFollow(currentTarget);
    }
  }, CHECK_INTERVAL);
}

function startContinuousFollow(player) {
  // Clear previous follow interval
  if (followUpdateInterval) {
    clearInterval(followUpdateInterval);
    followUpdateInterval = null;
  }
  
  if (USE_SPECTATE) {
    // /spectate provides smooth continuous following automatically
    bot.chat(`/spectate ${player.username}`);
    console.log(`Spectating ${player.username} (continuous first-person view)`);
    return;
  }
  
  // Non-spectate mode: periodically teleport behind the player
  // This creates a "third-person camera" effect
  const updatePosition = () => {
    if (!currentTarget || currentTarget.username !== player.username) {
      // Target changed, stop this interval
      if (followUpdateInterval) {
        clearInterval(followUpdateInterval);
        followUpdateInterval = null;
      }
      return;
    }
    
    // Get player from current bot state (might have moved)
    const targetPlayer = bot.players[player.username];
    if (!targetPlayer) return;
    
    // Calculate adaptive camera distance based on environment
    const distance = calculateAdaptiveDistance(targetPlayer);
    const height = BASE_FOLLOW_HEIGHT;
    
    // Use /execute to position camera behind player
    const cmd = `/execute as ${player.username} at @s run tp ${bot.username} ^ ^${height.toFixed(1)} ^-${distance.toFixed(1)} facing entity @s eyes`;
    bot.chat(cmd);
  };
  
  // Initial position update
  updatePosition();
  
  // Continue updating position
  followUpdateInterval = setInterval(updatePosition, FOLLOW_UPDATE_INTERVAL);
  console.log(`Following ${player.username} (third-person, update every ${FOLLOW_UPDATE_INTERVAL/1000}s)`);
}

/**
 * Calculate optimal camera distance based on environment.
 * - Open area (few blocks nearby): use farther distance for panoramic view
 * - Enclosed space (many blocks nearby): use closer distance to avoid clipping
 */
function calculateAdaptiveDistance(player) {
  if (!player.entity) {
    return BASE_FOLLOW_DISTANCE;
  }
  
  const pos = player.entity.position;
  let solidBlockCount = 0;
  const checkRadius = 5;
  const samplePoints = 26; // Check key points around the player
  
  // Sample blocks in a sphere around the player
  const offsets = [
    // Behind (where camera will be)
    [0, 0, -3], [0, 0, -5], [0, 0, -8],
    [0, 2, -3], [0, 2, -5], [0, 2, -8],
    // Sides
    [-3, 0, 0], [3, 0, 0], [-3, 2, 0], [3, 2, 0],
    // Above
    [0, 3, 0], [0, 5, 0],
    // Corners
    [-2, 2, -2], [2, 2, -2], [-2, 2, 2], [2, 2, 2],
    // Floor/ceiling
    [0, -1, 0], [0, 4, 0],
    // More behind samples
    [-1, 1, -4], [1, 1, -4], [-2, 1, -6], [2, 1, -6],
    [0, 1, -10], [-2, 2, -8], [2, 2, -8]
  ];
  
  for (const [dx, dy, dz] of offsets) {
    try {
      const block = bot.blockAt(pos.offset(dx, dy, dz));
      if (block && block.boundingBox !== 'empty') {
        solidBlockCount++;
      }
    } catch (e) {
      // Block not loaded, ignore
    }
  }
  
  // Calculate ratio of solid blocks
  const solidRatio = solidBlockCount / offsets.length;
  
  // Adapt distance: more blocks = closer camera
  // solidRatio 0 (open field) -> MAX_FOLLOW_DISTANCE
  // solidRatio 1 (fully enclosed) -> MIN_FOLLOW_DISTANCE
  const distance = MAX_FOLLOW_DISTANCE - (solidRatio * (MAX_FOLLOW_DISTANCE - MIN_FOLLOW_DISTANCE));
  
  return Math.max(MIN_FOLLOW_DISTANCE, Math.min(MAX_FOLLOW_DISTANCE, distance));
}

function calculateActivity(player) {
  if (!player.entity) return 0;
  
  const pos = player.entity.position;
  const lastPos = lastActivity[player.username] || pos.clone();
  const distance = pos.distanceTo(lastPos);
  
  lastActivity[player.username] = pos.clone();
  
  const velocity = player.entity.velocity;
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
  
  return distance + (speed * 2);
}

function showcaseBases() {
  if (showcaseActive) return;
  
  showcaseActive = true;
  
  try {
    if (showcaseLocations.length === 0) {
      console.log('No players online - staying at current position');
      return;
    }
    
    const location = showcaseLocations[showcaseIndex];
    console.log(`Showcase: ${location.description || 'Location ' + showcaseIndex}`);
    
    if (bot && bot.entity) {
      bot.chat(`/tp @s ${location.x} ${location.y} ${location.z}`);
    }
    
    // Rotate through showcase locations
    showcaseIndex = (showcaseIndex + 1) % showcaseLocations.length;
  } catch (error) {
    console.error('Error in showcaseBases:', error.message);
    showcaseActive = false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (trackingInterval) clearInterval(trackingInterval);
  if (followUpdateInterval) clearInterval(followUpdateInterval);
  if (bot) bot.quit();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  if (trackingInterval) clearInterval(trackingInterval);
  if (followUpdateInterval) clearInterval(followUpdateInterval);
  if (bot) bot.quit();
  process.exit(0);
});
