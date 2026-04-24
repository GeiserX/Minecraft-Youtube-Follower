/**
 * Tests for spectator-bot.js — the entry-point module.
 *
 * Since spectator-bot.js executes side-effects on require (connects to
 * a Minecraft server), we test it by verifying its structure and that
 * it correctly delegates to bot-logic.js.
 *
 * The comprehensive logic tests live in bot-logic.test.js.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.join(__dirname, '..', 'spectator-bot.js');
const source = fs.readFileSync(SOURCE_PATH, 'utf8');

const LOGIC_PATH = path.join(__dirname, '..', 'bot-logic.js');
const logicSource = fs.readFileSync(LOGIC_PATH, 'utf8');

describe('spectator-bot.js source', () => {
  test('source file exists and is non-empty', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  test('source parses without syntax errors', () => {
    expect(() => {
      // eslint-disable-next-line no-new-func
      new Function(source);
    }).not.toThrow();
  });
});

describe('spectator-bot.js delegates to bot-logic', () => {
  test('requires bot-logic module', () => {
    expect(source).toContain("require('./bot-logic')");
  });

  test('uses logic.loadConfig', () => {
    expect(source).toContain('logic.loadConfig(');
  });

  test('uses logic.loadCameraConfig', () => {
    expect(source).toContain('logic.loadCameraConfig(');
  });

  test('uses logic.createState', () => {
    expect(source).toContain('logic.createState()');
  });

  test('uses logic.createBot', () => {
    expect(source).toContain('logic.createBot(');
  });

  test('uses logic.setupBot', () => {
    expect(source).toContain('logic.setupBot(');
  });

  test('uses logic.clearAllIntervals', () => {
    expect(source).toContain('logic.clearAllIntervals(');
  });

  test('checks for MINECRAFT_USERNAME', () => {
    expect(source).toContain('config.username');
  });

  test('handles SIGINT and SIGTERM', () => {
    expect(source).toContain("process.on('SIGINT'");
    expect(source).toContain("process.on('SIGTERM'");
  });

  test('enforces no-gravity in interval', () => {
    expect(source).toContain('bot.physics.gravity = 0');
  });

  test('handles reconnection on disconnect', () => {
    expect(source).toContain("bot.on('end'");
    expect(source).toContain('consecutiveFailures >= 3');
  });
});

describe('bot-logic.js source', () => {
  test('source file exists and is non-empty', () => {
    expect(logicSource.length).toBeGreaterThan(0);
  });

  test('source parses without syntax errors', () => {
    expect(() => {
      new Function(logicSource);
    }).not.toThrow();
  });

  test('exports all expected functions', () => {
    const logic = require('../bot-logic');
    const expectedExports = [
      'loadConfig', 'loadCameraConfig', 'DEFAULT_SHOWCASE_LOCATIONS',
      'OVERLAY_FILE', 'STREAM_STATUS_FILE', 'createState',
      'writeOverlay', 'writeStreamStatus', 'clearAllIntervals',
      'goToShowcaseLocation', 'startShowcaseTour', 'stopShowcaseTour',
      'buildCameraCommand', 'startContinuousFollow', 'getOnlinePlayers',
      'handlePlayerCheck', 'startPlayerTracking', 'createBot', 'setupBot',
    ];
    for (const name of expectedExports) {
      expect(logic[name]).toBeDefined();
    }
  });
});
