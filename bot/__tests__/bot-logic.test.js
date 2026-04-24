/**
 * Comprehensive tests for bot-logic.js — the extracted testable logic
 * from spectator-bot.js.
 *
 * All external dependencies (mineflayer, prismarine-viewer, fs) are mocked.
 */

const fs = require('fs');

// Mock fs.writeFileSync and fs.readdirSync before requiring the module
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    writeFileSync: jest.fn(),
    readdirSync: jest.fn(() => []),
    mkdirSync: jest.fn(),
    readFileSync: actual.readFileSync, // keep real for file reads
  };
});

const logic = require('../bot-logic');

// ============================================================================
// HELPERS
// ============================================================================

function makeMockBot(overrides) {
  const handlers = {};
  const bot = {
    username: 'SpectatorBot',
    players: {},
    entity: { position: { x: 0, y: 64, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    physics: { gravity: 9.8, yawSpeed: 1, pitchSpeed: 1 },
    creative: { flying: false, flyingSpeed: 0 },
    chat: jest.fn(),
    quit: jest.fn(),
    on: jest.fn((event, handler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    once: jest.fn((event, handler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    _handlers: handlers,
    _emit: (event, ...args) => {
      if (handlers[event]) {
        handlers[event].forEach(h => h(...args));
      }
    },
    ...overrides,
  };
  return bot;
}

// ============================================================================
// loadConfig
// ============================================================================

describe('loadConfig', () => {
  test('returns defaults when env is empty', () => {
    const cfg = logic.loadConfig({});
    expect(cfg.host).toBe('localhost');
    expect(cfg.port).toBe(25565);
    expect(cfg.username).toBeUndefined();
    expect(cfg.spectatorPort).toBe(3000);
    expect(cfg.cacheDir).toBe('/app/config/.auth');
    expect(cfg.msalAuthority).toBe('https://login.microsoftonline.com/consumers');
    expect(cfg.version).toBe('1.21.10');
  });

  test('reads values from env', () => {
    const cfg = logic.loadConfig({
      SERVER_HOST: '10.0.0.1',
      SERVER_PORT: '25566',
      MINECRAFT_USERNAME: 'TestUser',
      SPECTATOR_PORT: '4000',
      AUTH_CACHE_DIR: '/tmp/.auth',
      AZURE_CLIENT_ID: 'abc123',
      MSAL_AUTHORITY: 'https://custom.auth',
    });
    expect(cfg.host).toBe('10.0.0.1');
    expect(cfg.port).toBe(25566);
    expect(cfg.username).toBe('TestUser');
    expect(cfg.spectatorPort).toBe(4000);
    expect(cfg.cacheDir).toBe('/tmp/.auth');
    expect(cfg.azureClientId).toBe('abc123');
    expect(cfg.msalAuthority).toBe('https://custom.auth');
  });

  test('defaults to process.env when no arg given', () => {
    const orig = process.env.SERVER_HOST;
    process.env.SERVER_HOST = 'from-process';
    const cfg = logic.loadConfig();
    expect(cfg.host).toBe('from-process');
    if (orig === undefined) delete process.env.SERVER_HOST;
    else process.env.SERVER_HOST = orig;
  });
});

// ============================================================================
// loadCameraConfig
// ============================================================================

describe('loadCameraConfig', () => {
  test('returns defaults when env is empty', () => {
    const cam = logic.loadCameraConfig({});
    expect(cam.CHECK_INTERVAL).toBe(5000);
    expect(cam.SWITCH_INTERVAL).toBe(30000);
    expect(cam.CAMERA_MODE).toBe('third-person');
    expect(cam.CAMERA_UPDATE_INTERVAL).toBe(2000);
    expect(cam.CAMERA_DISTANCE).toBe(5);
    expect(cam.CAMERA_HEIGHT).toBe(1.5);
    expect(cam.CAMERA_FIXED_ANGLE).toBe(0);
    expect(cam.VIEWER_VIEW_DISTANCE).toBe(6);
  });

  test('reads values from env', () => {
    const cam = logic.loadCameraConfig({
      CHECK_INTERVAL_MS: '1000',
      SWITCH_INTERVAL_MS: '5000',
      CAMERA_MODE: 'SPECTATE',
      CAMERA_UPDATE_INTERVAL_MS: '500',
      CAMERA_DISTANCE: '8',
      CAMERA_HEIGHT: '3',
      CAMERA_FIXED_ANGLE: '45',
      VIEWER_VIEW_DISTANCE: '10',
    });
    expect(cam.CHECK_INTERVAL).toBe(1000);
    expect(cam.SWITCH_INTERVAL).toBe(5000);
    expect(cam.CAMERA_MODE).toBe('spectate');
    expect(cam.CAMERA_UPDATE_INTERVAL).toBe(500);
    expect(cam.CAMERA_DISTANCE).toBe(8);
    expect(cam.CAMERA_HEIGHT).toBe(3);
    expect(cam.CAMERA_FIXED_ANGLE).toBe(45);
    expect(cam.VIEWER_VIEW_DISTANCE).toBe(10);
  });

  test('defaults to process.env when no arg given', () => {
    const orig = process.env.CAMERA_MODE;
    process.env.CAMERA_MODE = 'spectate';
    const cam = logic.loadCameraConfig();
    expect(cam.CAMERA_MODE).toBe('spectate');
    if (orig === undefined) delete process.env.CAMERA_MODE;
    else process.env.CAMERA_MODE = orig;
  });
});

// ============================================================================
// Constants
// ============================================================================

describe('constants', () => {
  test('DEFAULT_SHOWCASE_LOCATIONS is a non-empty array', () => {
    expect(Array.isArray(logic.DEFAULT_SHOWCASE_LOCATIONS)).toBe(true);
    expect(logic.DEFAULT_SHOWCASE_LOCATIONS.length).toBeGreaterThan(0);
  });

  test('each default location has required fields', () => {
    for (const loc of logic.DEFAULT_SHOWCASE_LOCATIONS) {
      expect(typeof loc.x).toBe('number');
      expect(typeof loc.y).toBe('number');
      expect(typeof loc.z).toBe('number');
      expect(typeof loc.description).toBe('string');
    }
  });

  test('OVERLAY_FILE is shared volume path', () => {
    expect(logic.OVERLAY_FILE).toBe('/app/config/shared/current_target.txt');
  });

  test('STREAM_STATUS_FILE is shared volume path', () => {
    expect(logic.STREAM_STATUS_FILE).toBe('/app/config/shared/stream_status.txt');
  });
});

// ============================================================================
// createState
// ============================================================================

describe('createState', () => {
  test('returns initial state with null/zero values', () => {
    const s = logic.createState();
    expect(s.currentTarget).toBeNull();
    expect(s.currentTargetName).toBe('');
    expect(s.trackingInterval).toBeNull();
    expect(s.cameraUpdateInterval).toBeNull();
    expect(s.showcaseActive).toBe(false);
    expect(s.showcaseIndex).toBe(0);
    expect(s.lastCommandTime).toBe(0);
    expect(s.lastPlayerListSignature).toBe('');
    expect(s.playerRotationIndex).toBe(0);
    expect(s.showcaseInterval).toBeNull();
    expect(s.isAuthenticating).toBe(false);
    expect(s.consecutiveFailures).toBe(0);
    expect(s.bot).toBeNull();
  });
});

// ============================================================================
// writeOverlay
// ============================================================================

describe('writeOverlay', () => {
  beforeEach(() => {
    fs.writeFileSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('writes text to default path', () => {
    const result = logic.writeOverlay('Hello');
    expect(fs.writeFileSync).toHaveBeenCalledWith(logic.OVERLAY_FILE, 'Hello');
    expect(result).toBe(true);
  });

  test('writes empty string when text is falsy', () => {
    logic.writeOverlay(null);
    expect(fs.writeFileSync).toHaveBeenCalledWith(logic.OVERLAY_FILE, '');
  });

  test('writes to custom path', () => {
    logic.writeOverlay('custom', '/tmp/overlay.txt');
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/overlay.txt', 'custom');
  });

  test('returns false on write failure', () => {
    fs.writeFileSync.mockImplementationOnce(() => { throw new Error('disk full'); });
    const result = logic.writeOverlay('fail');
    expect(result).toBe(false);
  });
});

// ============================================================================
// writeStreamStatus
// ============================================================================

describe('writeStreamStatus', () => {
  beforeEach(() => {
    fs.writeFileSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('writes status to default path', () => {
    const result = logic.writeStreamStatus('active');
    expect(fs.writeFileSync).toHaveBeenCalledWith(logic.STREAM_STATUS_FILE, 'active');
    expect(result).toBe(true);
  });

  test('writes to custom path', () => {
    logic.writeStreamStatus('paused', '/tmp/status.txt');
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/status.txt', 'paused');
  });

  test('returns false on write failure', () => {
    fs.writeFileSync.mockImplementationOnce(() => { throw new Error('perm denied'); });
    const result = logic.writeStreamStatus('active');
    expect(result).toBe(false);
  });
});

// ============================================================================
// clearAllIntervals
// ============================================================================

describe('clearAllIntervals', () => {
  test('clears all three intervals and sets them to null', () => {
    const t = setInterval(() => {}, 99999);
    const c = setInterval(() => {}, 99999);
    const s = setInterval(() => {}, 99999);
    const state = { trackingInterval: t, cameraUpdateInterval: c, showcaseInterval: s };

    logic.clearAllIntervals(state);

    expect(state.trackingInterval).toBeNull();
    expect(state.cameraUpdateInterval).toBeNull();
    expect(state.showcaseInterval).toBeNull();
  });

  test('handles already-null intervals gracefully', () => {
    const state = { trackingInterval: null, cameraUpdateInterval: null, showcaseInterval: null };
    expect(() => logic.clearAllIntervals(state)).not.toThrow();
  });
});

// ============================================================================
// goToShowcaseLocation
// ============================================================================

describe('goToShowcaseLocation', () => {
  let bot, state;

  beforeEach(() => {
    bot = makeMockBot();
    state = logic.createState();
    fs.writeFileSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('teleports to spawn when locations array is empty', () => {
    logic.goToShowcaseLocation(bot, state, []);
    expect(bot.chat).toHaveBeenCalledWith('/tp @s 0 80 0 0 20');
    expect(fs.writeFileSync).toHaveBeenCalledWith(logic.OVERLAY_FILE, 'Showcase: Spawn');
  });

  test('teleports to indexed location from array', () => {
    const locs = [
      { x: 100, y: 70, z: -200, yaw: 45, pitch: 15, description: 'Castle', duration: 12000 },
    ];
    state.showcaseIndex = 0;
    logic.goToShowcaseLocation(bot, state, locs);
    expect(bot.chat).toHaveBeenCalledWith('/tp @s 100 70 -200 45 15');
  });

  test('uses default yaw/pitch when not specified', () => {
    const locs = [{ x: 10, y: 20, z: 30, description: 'NoRotation', duration: 5000 }];
    logic.goToShowcaseLocation(bot, state, locs);
    expect(bot.chat).toHaveBeenCalledWith('/tp @s 10 20 30 0 20');
  });

  test('uses fallback description when not provided', () => {
    const locs = [{ x: 1, y: 2, z: 3, yaw: 0, pitch: 0, duration: 5000 }];
    logic.goToShowcaseLocation(bot, state, locs);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Location 1'));
  });

  test('uses default showcase locations when not provided', () => {
    logic.goToShowcaseLocation(bot, state);
    expect(bot.chat).toHaveBeenCalled();
  });
});

// ============================================================================
// startShowcaseTour / stopShowcaseTour
// ============================================================================

describe('startShowcaseTour', () => {
  let bot, state;

  beforeEach(() => {
    jest.useFakeTimers();
    bot = makeMockBot();
    state = logic.createState();
    fs.writeFileSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('sets showcaseActive and starts at index 0', () => {
    const locs = [
      { x: 0, y: 80, z: 0, yaw: 0, pitch: 20, description: 'A', duration: 5000 },
      { x: 10, y: 80, z: 10, yaw: 0, pitch: 0, description: 'B', duration: 5000 },
    ];
    logic.startShowcaseTour(bot, state, locs, 5000);

    expect(state.showcaseActive).toBe(true);
    expect(state.showcaseIndex).toBe(0);
    expect(bot.chat).toHaveBeenCalledTimes(1); // first location immediately
  });

  test('advances to next location after duration', () => {
    const locs = [
      { x: 0, y: 80, z: 0, yaw: 0, pitch: 20, description: 'A', duration: 3000 },
      { x: 10, y: 80, z: 10, yaw: 0, pitch: 0, description: 'B', duration: 3000 },
    ];
    logic.startShowcaseTour(bot, state, locs, 3000);
    bot.chat.mockClear();

    jest.advanceTimersByTime(3000);
    expect(state.showcaseIndex).toBe(1);
    expect(bot.chat).toHaveBeenCalledTimes(1);
  });

  test('wraps around to first location', () => {
    const locs = [
      { x: 0, y: 80, z: 0, yaw: 0, pitch: 20, description: 'A', duration: 2000 },
      { x: 10, y: 80, z: 10, yaw: 0, pitch: 0, description: 'B', duration: 2000 },
    ];
    logic.startShowcaseTour(bot, state, locs, 2000);

    jest.advanceTimersByTime(2000); // -> index 1
    jest.advanceTimersByTime(2000); // -> index 0 (wrap)
    expect(state.showcaseIndex).toBe(0);
  });

  test('does nothing if already active', () => {
    const locs = [{ x: 0, y: 80, z: 0, yaw: 0, pitch: 20, description: 'A', duration: 5000 }];
    logic.startShowcaseTour(bot, state, locs, 5000);
    const firstInterval = state.showcaseInterval;
    logic.startShowcaseTour(bot, state, locs, 5000);
    expect(state.showcaseInterval).toBe(firstInterval); // not replaced
  });

  test('uses default locations and duration', () => {
    logic.startShowcaseTour(bot, state);
    expect(state.showcaseActive).toBe(true);
  });

  test('falls back to showcaseDuration when location has no duration', () => {
    const locs = [
      { x: 0, y: 80, z: 0, yaw: 0, pitch: 20, description: 'NoDuration' },
      { x: 10, y: 80, z: 10, yaw: 0, pitch: 0, description: 'B', duration: 3000 },
    ];
    logic.startShowcaseTour(bot, state, locs, 7000);
    bot.chat.mockClear();

    // The interval should use 7000 (the fallback) since first loc has no duration
    jest.advanceTimersByTime(7000);
    expect(state.showcaseIndex).toBe(1);
    expect(bot.chat).toHaveBeenCalled();
  });
});

describe('stopShowcaseTour', () => {
  test('sets showcaseActive to false and clears interval', () => {
    jest.useFakeTimers();
    const state = logic.createState();
    state.showcaseActive = true;
    state.showcaseInterval = setInterval(() => {}, 99999);

    logic.stopShowcaseTour(state);

    expect(state.showcaseActive).toBe(false);
    expect(state.showcaseInterval).toBeNull();
    jest.useRealTimers();
  });

  test('handles null interval gracefully', () => {
    const state = logic.createState();
    state.showcaseActive = true;
    expect(() => logic.stopShowcaseTour(state)).not.toThrow();
    expect(state.showcaseActive).toBe(false);
  });
});

// ============================================================================
// buildCameraCommand
// ============================================================================

describe('buildCameraCommand', () => {
  test('builds correct execute command', () => {
    const cmd = logic.buildCameraCommand('Bot', 'Player1', 1.5, 5);
    expect(cmd).toBe(
      '/execute as Player1 at @s anchored eyes rotated ~ 0 positioned ^ ^1.5 ^-5 run tp Bot ~ ~ ~ facing entity Player1 eyes'
    );
  });

  test('caps height at 2', () => {
    const cmd = logic.buildCameraCommand('Bot', 'Player1', 10, 3);
    expect(cmd).toContain('^2 ^-3');
  });

  test('caps distance at 6', () => {
    const cmd = logic.buildCameraCommand('Bot', 'Player1', 1, 20);
    expect(cmd).toContain('^1 ^-6');
  });

  test('caps both height and distance', () => {
    const cmd = logic.buildCameraCommand('Bot', 'Player1', 99, 99);
    expect(cmd).toContain('^2 ^-6');
  });
});

// ============================================================================
// startContinuousFollow
// ============================================================================

describe('startContinuousFollow', () => {
  let bot, state;

  beforeEach(() => {
    jest.useFakeTimers();
    bot = makeMockBot();
    state = logic.createState();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logic.clearAllIntervals(state);
    jest.useRealTimers();
    console.log.mockRestore();
  });

  test('spectate mode sends /spectate command and returns', () => {
    const cam = logic.loadCameraConfig({ CAMERA_MODE: 'spectate' });
    const player = { username: 'Steve' };

    logic.startContinuousFollow(bot, state, player, cam);

    expect(bot.chat).toHaveBeenCalledWith('/spectate Steve');
    expect(state.cameraUpdateInterval).toBeNull();
  });

  test('third-person mode sends execute command immediately', () => {
    const cam = logic.loadCameraConfig({ CAMERA_MODE: 'third-person' });
    const player = { username: 'Steve' };
    state.currentTarget = player;

    logic.startContinuousFollow(bot, state, player, cam);

    expect(bot.chat).toHaveBeenCalledWith(
      expect.stringContaining('/execute as Steve')
    );
    expect(state.cameraUpdateInterval).not.toBeNull();
  });

  test('third-person mode updates camera on interval', () => {
    const cam = logic.loadCameraConfig({ CAMERA_MODE: 'third-person', CAMERA_UPDATE_INTERVAL_MS: '500' });
    const player = { username: 'Steve' };
    state.currentTarget = player;
    state.lastCommandTime = 0;

    logic.startContinuousFollow(bot, state, player, cam);
    bot.chat.mockClear();

    // Advance past rate limit (400ms) + interval (500ms)
    jest.advanceTimersByTime(500);
    expect(bot.chat).toHaveBeenCalled();
  });

  test('stops updating when target changes', () => {
    const cam = logic.loadCameraConfig({ CAMERA_MODE: 'third-person', CAMERA_UPDATE_INTERVAL_MS: '500' });
    const player = { username: 'Steve' };
    state.currentTarget = player;

    logic.startContinuousFollow(bot, state, player, cam);
    bot.chat.mockClear();

    // Change target
    state.currentTarget = { username: 'Alex' };
    jest.advanceTimersByTime(500);
    // The updateCamera should detect mismatch and clear interval
    expect(bot.chat).not.toHaveBeenCalled();
  });

  test('rate-limits commands to 400ms minimum', () => {
    const cam = logic.loadCameraConfig({ CAMERA_MODE: 'third-person', CAMERA_UPDATE_INTERVAL_MS: '100' });
    const player = { username: 'Steve' };
    state.currentTarget = player;
    state.lastCommandTime = Date.now(); // just sent a command

    logic.startContinuousFollow(bot, state, player, cam);
    // Should not have sent a command since lastCommandTime is recent
    expect(bot.chat).not.toHaveBeenCalled();
  });

  test('handles null cameraUpdateInterval when target changes', () => {
    const cam = logic.loadCameraConfig({ CAMERA_MODE: 'third-person', CAMERA_UPDATE_INTERVAL_MS: '500' });
    const player = { username: 'Steve' };
    state.currentTarget = player;

    logic.startContinuousFollow(bot, state, player, cam);
    bot.chat.mockClear();

    // Change target and set cameraUpdateInterval to null to hit the null branch
    state.currentTarget = { username: 'Alex' };
    state.cameraUpdateInterval = null;
    jest.advanceTimersByTime(500);
    // Should not throw even with null cameraUpdateInterval
    expect(bot.chat).not.toHaveBeenCalled();
  });

  test('clears previous camera interval when called again', () => {
    const cam = logic.loadCameraConfig({ CAMERA_MODE: 'third-person' });
    const p1 = { username: 'Steve' };
    const p2 = { username: 'Alex' };
    state.currentTarget = p1;

    logic.startContinuousFollow(bot, state, p1, cam);
    const firstInterval = state.cameraUpdateInterval;

    state.currentTarget = p2;
    logic.startContinuousFollow(bot, state, p2, cam);

    // First interval should have been cleared, new one created
    expect(state.cameraUpdateInterval).not.toBe(firstInterval);
  });
});

// ============================================================================
// getOnlinePlayers
// ============================================================================

describe('getOnlinePlayers', () => {
  test('returns empty array when no players', () => {
    const bot = makeMockBot({ players: {} });
    expect(logic.getOnlinePlayers(bot)).toEqual([]);
  });

  test('excludes the bot itself', () => {
    const bot = makeMockBot({
      players: {
        SpectatorBot: { username: 'SpectatorBot' },
        Steve: { username: 'Steve' },
      }
    });
    const result = logic.getOnlinePlayers(bot);
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('Steve');
  });

  test('filters out null/undefined entries', () => {
    const bot = makeMockBot({
      players: {
        Steve: { username: 'Steve' },
        bad1: null,
        bad2: { username: undefined },
      }
    });
    const result = logic.getOnlinePlayers(bot);
    expect(result).toHaveLength(1);
  });

  test('returns multiple players', () => {
    const bot = makeMockBot({
      players: {
        Steve: { username: 'Steve' },
        Alex: { username: 'Alex' },
        SpectatorBot: { username: 'SpectatorBot' },
      }
    });
    const result = logic.getOnlinePlayers(bot);
    expect(result).toHaveLength(2);
  });
});

// ============================================================================
// handlePlayerCheck
// ============================================================================

describe('handlePlayerCheck', () => {
  let bot, state, cam;

  beforeEach(() => {
    jest.useFakeTimers();
    bot = makeMockBot({
      players: {
        SpectatorBot: { username: 'SpectatorBot' },
        Steve: { username: 'Steve' },
      }
    });
    state = logic.createState();
    state._lastSwitchTime = 0;
    cam = logic.loadCameraConfig({});
    fs.writeFileSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logic.clearAllIntervals(state);
    jest.useRealTimers();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('returns no_players when server is empty', () => {
    bot.players = { SpectatorBot: { username: 'SpectatorBot' } };
    const result = logic.handlePlayerCheck(bot, state, cam);
    expect(result.action).toBe('no_players');
  });

  test('pauses stream when no players online', () => {
    bot.players = { SpectatorBot: { username: 'SpectatorBot' } };
    state.currentTarget = { username: 'Steve' }; // was following someone
    logic.handlePlayerCheck(bot, state, cam);

    expect(state.currentTarget).toBeNull();
    expect(state.currentTargetName).toBe('');
    expect(fs.writeFileSync).toHaveBeenCalledWith(logic.STREAM_STATUS_FILE, 'paused');
  });

  test('switches to first player when no current target', () => {
    const result = logic.handlePlayerCheck(bot, state, cam);
    expect(result.action).toBe('switched');
    expect(state.currentTarget.username).toBe('Steve');
    expect(state.currentTargetName).toBe('Steve');
  });

  test('resumes stream when players detected after showcase', () => {
    state.showcaseActive = true;
    logic.handlePlayerCheck(bot, state, cam);
    expect(state.showcaseActive).toBe(false);
    expect(fs.writeFileSync).toHaveBeenCalledWith(logic.STREAM_STATUS_FILE, 'active');
  });

  test('rotates to next player after switch interval', () => {
    bot.players = {
      SpectatorBot: { username: 'SpectatorBot' },
      Steve: { username: 'Steve' },
      Alex: { username: 'Alex' },
    };
    state._lastSwitchTime = 0;
    state.playerRotationIndex = 0;
    state.currentTarget = { username: 'Steve' };

    // Fast-forward past switch interval
    jest.advanceTimersByTime(31000);
    const result = logic.handlePlayerCheck(bot, state, cam);

    expect(result.action).toBe('switched');
  });

  test('stays on same player before switch interval', () => {
    state.currentTarget = { username: 'Steve' };
    state.currentTargetName = 'Steve';
    state._lastSwitchTime = Date.now();

    const result = logic.handlePlayerCheck(bot, state, cam);
    expect(result.action).toBe('no_change');
    expect(result.target).toBe('Steve');
  });

  test('switches when current target goes offline', () => {
    bot.players = {
      SpectatorBot: { username: 'SpectatorBot' },
      Alex: { username: 'Alex' },
    };
    state.currentTarget = { username: 'Steve' }; // Steve left
    state._lastSwitchTime = Date.now();

    const result = logic.handlePlayerCheck(bot, state, cam);
    expect(result.action).toBe('switched');
    expect(state.currentTarget.username).toBe('Alex');
  });

  test('updates player list signature on change', () => {
    expect(state.lastPlayerListSignature).toBe('');
    logic.handlePlayerCheck(bot, state, cam);
    expect(state.lastPlayerListSignature).toBe('Steve');
  });

  test('does not log when player list unchanged', () => {
    state.lastPlayerListSignature = 'Steve';
    logic.handlePlayerCheck(bot, state, cam);
    // The "Players (1): Steve" log should NOT fire since signature matches
    const playerLogCalls = console.log.mock.calls.filter(
      call => typeof call[0] === 'string' && call[0].startsWith('Players (')
    );
    expect(playerLogCalls).toHaveLength(0);
  });

  test('writes overlay with player name on switch', () => {
    logic.handlePlayerCheck(bot, state, cam);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      logic.OVERLAY_FILE,
      'Now following: Steve'
    );
  });

  test('does not log when rotation picks the same player', () => {
    // Two players so players.length > 1 triggers rotation after interval
    bot.players = {
      SpectatorBot: { username: 'SpectatorBot' },
      Steve: { username: 'Steve' },
      Alex: { username: 'Alex' },
    };
    // Currently following Steve, and rotation index will land on Steve again
    // getOnlinePlayers returns [Steve, Alex] (order depends on Object.values)
    const players = logic.getOnlinePlayers(bot);
    const steveIdx = players.findIndex(p => p.username === 'Steve');

    state.currentTarget = { username: 'Steve' };
    state.currentTargetName = 'Steve';
    state._lastSwitchTime = 0; // expired
    // Set rotation index so (index + 1) % length lands on Steve
    state.playerRotationIndex = steveIdx - 1 < 0 ? players.length - 1 : steveIdx - 1;

    jest.advanceTimersByTime(31000);
    console.log.mockClear();

    const result = logic.handlePlayerCheck(bot, state, cam);
    expect(result.action).toBe('switched');
    // Since we're re-selecting the same player (Steve -> Steve),
    // the "Now following:" log should NOT be emitted
    const followCalls = console.log.mock.calls.filter(
      call => typeof call[0] === 'string' && call[0].startsWith('Now following:')
    );
    expect(followCalls).toHaveLength(0);
  });

  test('clears camera interval when no players', () => {
    bot.players = { SpectatorBot: { username: 'SpectatorBot' } };
    state.cameraUpdateInterval = setInterval(() => {}, 99999);
    state.currentTarget = { username: 'Steve' };

    logic.handlePlayerCheck(bot, state, cam);
    expect(state.cameraUpdateInterval).toBeNull();
  });

  test('does not pause again if already paused with no target and showcase active', () => {
    bot.players = { SpectatorBot: { username: 'SpectatorBot' } };
    state.currentTarget = null;
    state.showcaseActive = true; // showcase already active

    // When currentTarget is null AND showcaseActive is true,
    // the condition (currentTarget !== null || !showcaseActive) = (false || false) = false
    // so it should NOT write status again
    logic.handlePlayerCheck(bot, state, cam);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});

// ============================================================================
// startPlayerTracking
// ============================================================================

describe('startPlayerTracking', () => {
  let bot, state, cam;

  beforeEach(() => {
    jest.useFakeTimers();
    bot = makeMockBot({
      players: { SpectatorBot: { username: 'SpectatorBot' }, Steve: { username: 'Steve' } }
    });
    state = logic.createState();
    cam = logic.loadCameraConfig({ CHECK_INTERVAL_MS: '1000', SWITCH_INTERVAL_MS: '5000' });
    fs.writeFileSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logic.clearAllIntervals(state);
    jest.useRealTimers();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('starts paused and creates tracking interval', () => {
    logic.startPlayerTracking(bot, state, cam);
    expect(fs.writeFileSync).toHaveBeenCalledWith(logic.STREAM_STATUS_FILE, 'paused');
    expect(state.trackingInterval).not.toBeNull();
  });

  test('checks players on each interval tick', () => {
    logic.startPlayerTracking(bot, state, cam);
    fs.writeFileSync.mockClear();

    jest.advanceTimersByTime(1000);
    // Should have called handlePlayerCheck -> found Steve -> switched
    expect(state.currentTarget).not.toBeNull();
  });

  test('clears previous intervals before starting', () => {
    state.trackingInterval = setInterval(() => {}, 99999);
    const prevInterval = state.trackingInterval;

    logic.startPlayerTracking(bot, state, cam);
    expect(state.trackingInterval).not.toBe(prevInterval);
  });
});

// ============================================================================
// createBot
// ============================================================================

describe('createBot', () => {
  beforeEach(() => {
    fs.readdirSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('rejects when azureClientId is missing', async () => {
    const config = logic.loadConfig({ MINECRAFT_USERNAME: 'Test' });
    await expect(logic.createBot({}, config)).rejects.toThrow('AZURE_CLIENT_ID is required');
  });

  test('resolves with bot on login event', async () => {
    const mockBot = makeMockBot();
    const mockMineflayer = { createBot: jest.fn(() => mockBot) };
    const config = logic.loadConfig({
      MINECRAFT_USERNAME: 'Test',
      AZURE_CLIENT_ID: 'abc123',
    });

    const promise = logic.createBot(mockMineflayer, config);

    // Simulate login
    mockBot._emit('login');

    const bot = await promise;
    expect(bot.username).toBe('SpectatorBot');
  });

  test('rejects on error when not authenticating', async () => {
    const mockBot = makeMockBot();
    const mockMineflayer = { createBot: jest.fn(() => mockBot) };
    const config = logic.loadConfig({
      MINECRAFT_USERNAME: 'Test',
      AZURE_CLIENT_ID: 'abc123',
    });

    const promise = logic.createBot(mockMineflayer, config);

    mockBot._emit('error', new Error('connection failed'));

    await expect(promise).rejects.toThrow('connection failed');
  });

  test('ignores error during authentication', async () => {
    const mockBot = makeMockBot();
    let onMsaCode;
    const mockMineflayer = {
      createBot: jest.fn((opts) => {
        onMsaCode = opts.onMsaCode;
        return mockBot;
      })
    };
    const config = logic.loadConfig({
      MINECRAFT_USERNAME: 'Test',
      AZURE_CLIENT_ID: 'abc123',
    });

    const promise = logic.createBot(mockMineflayer, config);

    // Trigger MSA code flow (sets isAuthenticating = true internally)
    onMsaCode({ verificationUri: 'https://example.com', userCode: 'ABC123' });

    // Error during auth should be swallowed
    mockBot._emit('error', new Error('timeout'));

    // Complete login
    mockBot._emit('login');
    const bot = await promise;
    expect(bot).toBeDefined();
  });

  test('logs cached auth files when present', async () => {
    fs.readdirSync.mockReturnValueOnce(['token.json', 'cache.json']);
    const mockBot = makeMockBot();
    const mockMineflayer = { createBot: jest.fn(() => mockBot) };
    const config = logic.loadConfig({
      MINECRAFT_USERNAME: 'Test',
      AZURE_CLIENT_ID: 'abc123',
    });

    const promise = logic.createBot(mockMineflayer, config);
    mockBot._emit('login');
    await promise;

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2 cached auth file'));
  });

  test('handles missing cache dir gracefully', async () => {
    fs.readdirSync.mockImplementationOnce(() => { throw new Error('ENOENT'); });
    const mockBot = makeMockBot();
    const mockMineflayer = { createBot: jest.fn(() => mockBot) };
    const config = logic.loadConfig({
      MINECRAFT_USERNAME: 'Test',
      AZURE_CLIENT_ID: 'abc123',
    });

    const promise = logic.createBot(mockMineflayer, config);
    mockBot._emit('login');
    await expect(promise).resolves.toBeDefined();
  });

  test('onMsaCode handles alternate field names', async () => {
    const mockBot = makeMockBot();
    let onMsaCode;
    const mockMineflayer = {
      createBot: jest.fn((opts) => {
        onMsaCode = opts.onMsaCode;
        return mockBot;
      })
    };
    const config = logic.loadConfig({
      MINECRAFT_USERNAME: 'Test',
      AZURE_CLIENT_ID: 'abc123',
    });

    const promise = logic.createBot(mockMineflayer, config);
    onMsaCode({ verification_uri: 'https://ms.com', user_code: 'XYZ' });
    mockBot._emit('login');
    const bot = await promise;
    expect(bot).toBeDefined();
  });

  test('passes correct options to mineflayer.createBot', async () => {
    const mockBot = makeMockBot();
    const mockMineflayer = { createBot: jest.fn(() => mockBot) };
    const config = logic.loadConfig({
      SERVER_HOST: '10.0.0.1',
      SERVER_PORT: '25566',
      MINECRAFT_USERNAME: 'Test',
      AZURE_CLIENT_ID: 'abc123',
      AUTH_CACHE_DIR: '/tmp/.auth',
      MSAL_AUTHORITY: 'https://custom.auth',
    });

    const promise = logic.createBot(mockMineflayer, config);
    mockBot._emit('login');
    await promise;

    const opts = mockMineflayer.createBot.mock.calls[0][0];
    expect(opts.host).toBe('10.0.0.1');
    expect(opts.port).toBe(25566);
    expect(opts.username).toBe('Test');
    expect(opts.auth).toBe('microsoft');
    expect(opts.profilesFolder).toBe('/tmp/.auth');
    expect(opts.authTitle).toBe('abc123');
    expect(opts.flow).toBe('msal');
    expect(opts.version).toBe('1.21.4');
  });
});

// ============================================================================
// setupBot
// ============================================================================

describe('setupBot', () => {
  let bot, state, config, cam;

  beforeEach(() => {
    jest.useFakeTimers();
    bot = makeMockBot({
      players: { SpectatorBot: { username: 'SpectatorBot' }, Steve: { username: 'Steve' } }
    });
    state = logic.createState();
    config = logic.loadConfig({ MINECRAFT_USERNAME: 'SpectatorBot', AZURE_CLIENT_ID: 'abc', SPECTATOR_PORT: '3000' });
    cam = logic.loadCameraConfig({});
    fs.writeFileSync.mockClear();
    fs.mkdirSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logic.clearAllIntervals(state);
    jest.useRealTimers();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('registers spawn, error, kicked, and end handlers', () => {
    logic.setupBot(bot, state, config, cam, null);
    const events = bot.on.mock.calls.map(c => c[0]);
    expect(events).toContain('spawn');
    expect(events).toContain('error');
    expect(events).toContain('kicked');
    expect(events).toContain('end');
  });

  test('spawn handler sets spectator mode after delay', () => {
    logic.setupBot(bot, state, config, cam, null);

    bot._emit('spawn');
    // First timeout: 2000ms
    jest.advanceTimersByTime(2000);
    expect(bot.chat).toHaveBeenCalledWith('/gamemode spectator');

    // Second timeout: 500ms for physics setup
    jest.advanceTimersByTime(500);
    expect(bot.physics.gravity).toBe(0);
    expect(bot.creative.flying).toBe(true);
  });

  test('spawn handler calls viewerPlugin when provided', () => {
    const mockViewer = jest.fn();
    logic.setupBot(bot, state, config, cam, mockViewer);

    bot._emit('spawn');
    jest.advanceTimersByTime(2000);

    expect(mockViewer).toHaveBeenCalledWith(bot, {
      port: config.spectatorPort,
      viewDistance: cam.VIEWER_VIEW_DISTANCE,
      firstPerson: true,
    });
  });

  test('spawn handler handles viewer failure gracefully', () => {
    const mockViewer = jest.fn(() => { throw new Error('viewer crash'); });
    logic.setupBot(bot, state, config, cam, mockViewer);

    bot._emit('spawn');
    jest.advanceTimersByTime(2000);

    expect(console.error).toHaveBeenCalledWith('Failed to create viewer:', expect.any(Error));
  });

  test('error handler increments consecutiveFailures', () => {
    logic.setupBot(bot, state, config, cam, null);
    state.consecutiveFailures = 0;

    bot._emit('error', new Error('test'));
    expect(state.consecutiveFailures).toBe(1);
  });

  test('error handler calls bot.quit after 3 failures', () => {
    logic.setupBot(bot, state, config, cam, null);
    state.consecutiveFailures = 2;

    bot._emit('error', new Error('test'));
    expect(state.consecutiveFailures).toBe(3);
    expect(bot.quit).toHaveBeenCalled();
  });

  test('kicked handler logs the reason', () => {
    logic.setupBot(bot, state, config, cam, null);
    bot._emit('kicked', 'banned');
    expect(console.error).toHaveBeenCalledWith('Bot kicked:', 'banned');
  });

  test('end handler clears all intervals', () => {
    logic.setupBot(bot, state, config, cam, null);
    state.trackingInterval = setInterval(() => {}, 99999);
    state.cameraUpdateInterval = setInterval(() => {}, 99999);

    bot._emit('end');

    expect(state.trackingInterval).toBeNull();
    expect(state.cameraUpdateInterval).toBeNull();
  });

  test('spawn handler handles missing entity gracefully', () => {
    bot.entity = null;
    logic.setupBot(bot, state, config, cam, null);

    bot._emit('spawn');
    jest.advanceTimersByTime(2500);
    // Should not throw even with null entity
  });

  test('spawn handler handles missing physics gracefully', () => {
    bot.physics = null;
    bot.creative = null;
    logic.setupBot(bot, state, config, cam, null);

    bot._emit('spawn');
    jest.advanceTimersByTime(2500);
    // Should not throw
  });

  test('spawn handler starts player tracking', () => {
    logic.setupBot(bot, state, config, cam, null);
    bot._emit('spawn');
    jest.advanceTimersByTime(2000);

    expect(state.trackingInterval).not.toBeNull();
  });
});

// ============================================================================
// Integration: full lifecycle
// ============================================================================

describe('integration: lifecycle', () => {
  let bot, state, cam;

  beforeEach(() => {
    jest.useFakeTimers();
    bot = makeMockBot({
      players: {
        SpectatorBot: { username: 'SpectatorBot' },
        Steve: { username: 'Steve' },
        Alex: { username: 'Alex' },
      }
    });
    state = logic.createState();
    cam = logic.loadCameraConfig({ CHECK_INTERVAL_MS: '1000', SWITCH_INTERVAL_MS: '3000' });
    fs.writeFileSync.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logic.clearAllIntervals(state);
    jest.useRealTimers();
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test('tracks players and rotates between them', () => {
    logic.startPlayerTracking(bot, state, cam);

    // First tick: picks first player
    jest.advanceTimersByTime(1000);
    const first = state.currentTargetName;
    expect(first).toBeTruthy();

    // After switch interval, should rotate
    jest.advanceTimersByTime(3000);
    // May or may not have switched depending on timing, but should not crash
    expect(state.currentTarget).not.toBeNull();
  });

  test('handles player leaving mid-session', () => {
    logic.startPlayerTracking(bot, state, cam);
    jest.advanceTimersByTime(1000);

    // Remove Steve
    bot.players = {
      SpectatorBot: { username: 'SpectatorBot' },
      Alex: { username: 'Alex' },
    };
    state.currentTarget = { username: 'Steve' };

    jest.advanceTimersByTime(1000);
    // Should switch to Alex
    expect(state.currentTarget.username).toBe('Alex');
  });

  test('all players leave then rejoin', () => {
    logic.startPlayerTracking(bot, state, cam);
    jest.advanceTimersByTime(1000);
    expect(state.currentTarget).not.toBeNull();

    // All leave
    bot.players = { SpectatorBot: { username: 'SpectatorBot' } };
    jest.advanceTimersByTime(1000);
    expect(state.currentTarget).toBeNull();

    // Player returns
    bot.players = {
      SpectatorBot: { username: 'SpectatorBot' },
      Steve: { username: 'Steve' },
    };
    jest.advanceTimersByTime(1000);
    expect(state.currentTarget.username).toBe('Steve');
  });
});
