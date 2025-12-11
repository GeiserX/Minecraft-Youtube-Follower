const mineflayer = require('mineflayer');
const { Authflow } = require('prismarine-auth');
const { mineflayer: viewerPlugin } = require('prismarine-viewer');

// Configuration from environment variables
const config = {
  host: process.env.SERVER_HOST || 'localhost',
  port: parseInt(process.env.SERVER_PORT || '25565'),
  username: process.env.MINECRAFT_USERNAME,
  version: '1.21.4', // Latest Paper version
  spectatorPort: parseInt(process.env.SPECTATOR_PORT || '3000'),
  cacheDir: process.env.AUTH_CACHE_DIR || '/app/config/.auth'
};

if (!config.username) {
  console.error('Error: MINECRAFT_USERNAME must be set');
  process.exit(1);
}

// Player tracking state
let currentTarget = null;
let lastActivity = {};
let switchTimer = null;
const SWITCH_INTERVAL = 30000; // 30 seconds
const CHECK_INTERVAL = 5000; // Check every 5 seconds

// Base showcase coordinates (configure these for your server)
const showcaseLocations = [
  { x: 0, y: 64, z: 0, description: 'Spawn' },
  // Add more interesting locations here
];

let showcaseIndex = 0;

// Microsoft account authentication
// Note: For Microsoft accounts, you need to authenticate once interactively
// The auth flow will cache tokens for future use
async function createBot() {
  const flow = new Authflow(config.username, config.cacheDir, {
    flow: 'msal',
    deviceCodeCallback: (info) => {
      console.log('='.repeat(60));
      console.log('MICROSOFT ACCOUNT AUTHENTICATION REQUIRED');
      console.log('='.repeat(60));
      console.log(`Go to: ${info.verification_uri}`);
      console.log(`Enter code: ${info.user_code}`);
      console.log('='.repeat(60));
      console.log('This is a one-time setup. Tokens will be cached.');
      console.log('='.repeat(60));
    }
  });

  try {
    const { token, entitlements, profile } = await flow.getMinecraftJavaToken({
      fetchEntitlements: true,
      fetchProfile: true
    });

    console.log(`Authenticated as: ${profile.name}`);

    // Create bot with Microsoft authentication
    const bot = mineflayer.createBot({
      host: config.host,
      port: config.port,
      username: config.username,
      version: config.version,
      auth: 'microsoft',
      session: {
        accessToken: token,
        clientToken: flow.clientId,
        selectedProfile: {
          id: profile.id,
          name: profile.name
        }
      }
    });

    return bot;
  } catch (error) {
    console.error('Authentication error:', error);
    console.error('Please ensure you complete the device code flow');
    process.exit(1);
  }
}

// Initialize bot and set up event handlers
let bot;
createBot().then(createdBot => {
  bot = createdBot;
  setupBot();
}).catch(error => {
  console.error('Failed to create bot:', error);
  process.exit(1);
});

let viewer = null;

function setupBot() {
  bot.on('spawn', () => {
    console.log('Bot spawned, switching to spectator mode...');
    
    // Wait a moment for bot to fully spawn
    setTimeout(() => {
      bot.chat('/gamemode spectator');
      console.log('Bot is now in spectator mode');
      console.log(`Bot position: ${bot.entity.position}`);
      
      // Create viewer for streaming service to capture
      try {
        viewerPlugin(bot, {
          port: config.spectatorPort,
          viewDistance: 6,
          firstPerson: false
        });
        console.log(`Prismarine viewer initialized on port ${config.spectatorPort}`);
        console.log(`Viewer accessible at: http://localhost:${config.spectatorPort}`);
      } catch (error) {
        console.error('Failed to create viewer:', error);
        console.log('Note: prismarine-viewer may need different setup');
      }
      
      startPlayerTracking();
    }, 2000);
  });

  bot.on('error', (err) => {
    console.error('Bot error:', err);
  });

  bot.on('kicked', (reason) => {
    console.error('Bot kicked:', reason);
  });

  bot.on('end', () => {
    console.log('Bot disconnected');
  });
}

function startPlayerTracking() {
  setInterval(() => {
    const players = Object.values(bot.players).filter(p => 
      p.entity && p.username !== bot.username && p.entity !== bot.entity
    );

    if (players.length === 0) {
      // No players - showcase bases mode
      if (currentTarget !== null) {
        console.log('No players online - switching to base showcase mode');
        currentTarget = null;
        if (switchTimer) {
          clearInterval(switchTimer);
          switchTimer = null;
        }
      }
      showcaseBases();
      return;
    }

    // Find most active player
    const activePlayer = findMostActivePlayer(players);
    
    if (activePlayer && activePlayer !== currentTarget) {
      followPlayer(activePlayer);
      currentTarget = activePlayer;
      
      // Set up automatic switching if multiple players
      if (players.length > 1 && !switchTimer) {
        switchTimer = setInterval(() => {
          const currentPlayers = Object.values(bot.players).filter(p => 
            p.entity && p.username !== bot.username && p.entity !== bot.entity
          );
          if (currentPlayers.length > 1) {
            const nextPlayer = findMostActivePlayer(
              currentPlayers.filter(p => p.username !== currentTarget.username)
            );
            if (nextPlayer) {
              followPlayer(nextPlayer);
              currentTarget = nextPlayer;
            }
          }
        }, SWITCH_INTERVAL);
      } else if (players.length === 1 && switchTimer) {
        clearInterval(switchTimer);
        switchTimer = null;
      }
    }
  }, CHECK_INTERVAL);
}

function findMostActivePlayer(players) {
  let mostActive = null;
  let maxActivity = 0;

  players.forEach(player => {
    if (!player.entity) return;
    
    const activity = calculateActivity(player);
    if (activity > maxActivity) {
      maxActivity = activity;
      mostActive = player;
    }
  });

  return mostActive || players[0]; // Fallback to first player if all are stationary
}

function calculateActivity(player) {
  if (!player.entity) return 0;
  
  const pos = player.entity.position;
  const lastPos = lastActivity[player.username] || pos.clone();
  const distance = pos.distanceTo(lastPos);
  
  // Update last known position
  lastActivity[player.username] = pos.clone();
  
  // Also consider if player is moving (velocity)
  const velocity = player.entity.velocity;
  const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
  
  // Combine distance moved and current speed
  return distance + (speed * 2);
}

function followPlayer(player) {
  if (!player.entity) return;
  
  console.log(`Following player: ${player.username}`);
  
  const pos = player.entity.position;
  
  // Teleport to player with slight offset for better viewing angle
  const offsetX = 2;
  const offsetY = 1;
  const offsetZ = 2;
  
  bot.lookAt(pos.offset(0, 0.5, 0), true);
  
  // Use bot's position setter (spectator mode allows this)
  setTimeout(() => {
    bot.entity.position.set(
      pos.x + offsetX,
      pos.y + offsetY,
      pos.z + offsetZ
    );
  }, 100);
}

function showcaseBases() {
  if (showcaseLocations.length === 0) {
    // No showcase locations configured, just stay at spawn
    return;
  }
  
  const location = showcaseLocations[showcaseIndex];
  console.log(`Showcasing: ${location.description || 'Location ' + showcaseIndex}`);
  
  // Move to showcase location
  bot.entity.position.set(location.x, location.y, location.z);
  bot.lookAt({ x: location.x, y: location.y + 5, z: location.z }, true);
  
  // Rotate slowly for better viewing
  let rotation = 0;
  const rotateInterval = setInterval(() => {
    if (Object.values(bot.players).filter(p => p.entity && p.username !== bot.username).length > 0) {
      clearInterval(rotateInterval);
      return;
    }
    
    rotation += 0.05;
    const radius = 10;
    bot.entity.position.set(
      location.x + Math.cos(rotation) * radius,
      location.y + 5,
      location.z + Math.sin(rotation) * radius
    );
    bot.lookAt({ x: location.x, y: location.y, z: location.z }, true);
  }, 100);
  
  // Move to next location after 30 seconds
  setTimeout(() => {
    clearInterval(rotateInterval);
    showcaseIndex = (showcaseIndex + 1) % showcaseLocations.length;
  }, 30000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (bot) bot.quit();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  if (bot) bot.quit();
  process.exit(0);
});
