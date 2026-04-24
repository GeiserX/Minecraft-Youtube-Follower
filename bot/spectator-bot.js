const mineflayer = require('mineflayer');
const { mineflayer: viewerPlugin } = require('prismarine-viewer');
const Vec3 = require('vec3');
const fs = require('fs');
const logic = require('./bot-logic');

// Configuration
const config = logic.loadConfig(process.env);
const cameraConfig = logic.loadCameraConfig(process.env);

if (!config.username) {
  console.error('Error: MINECRAFT_USERNAME must be set');
  process.exit(1);
}

const SHOWCASE_DURATION = parseInt(process.env.SHOWCASE_DURATION_MS || '10000', 10);

const state = logic.createState();

logic.createBot(mineflayer, config).then(bot => {
  state.bot = bot;
  state.consecutiveFailures = 0;

  logic.setupBot(bot, state, config, cameraConfig, viewerPlugin, logic.DEFAULT_SHOWCASE_LOCATIONS);

  // Continuously enforce no-gravity state
  setInterval(() => {
    if (bot.physics) {
      bot.physics.gravity = 0;
    }
    if (bot.entity && bot.entity.velocity) {
      bot.entity.velocity.y = Math.max(0, bot.entity.velocity.y);
    }
  }, 100);

  // Handle reconnection on disconnect
  bot.on('end', () => {
    if (state.isAuthenticating) return;
    if (state.consecutiveFailures >= 3) process.exit(1);

    setTimeout(() => {
      logic.createBot(mineflayer, config).then(newBot => {
        state.bot = newBot;
        state.consecutiveFailures = 0;
        logic.setupBot(newBot, state, config, cameraConfig, viewerPlugin, logic.DEFAULT_SHOWCASE_LOCATIONS);
      }).catch(() => process.exit(1));
    }, 10000);
  });
}).catch(error => {
  if (state.isAuthenticating) return;
  console.error('Failed to create bot:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  logic.clearAllIntervals(state);
  if (state.bot) state.bot.quit();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logic.clearAllIntervals(state);
  if (state.bot) state.bot.quit();
  process.exit(0);
});
