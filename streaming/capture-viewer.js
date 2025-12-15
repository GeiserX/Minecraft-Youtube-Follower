/**
 * Puppeteer script to capture the prismarine-viewer
 * This runs in the streaming service container
 * 
 * NOTE: prismarine-viewer is a visual-only renderer. It does NOT produce game audio.
 * For audio, you would need to:
 * 1. Add ambient music files and play them in the page
 * 2. Use a full Minecraft client (not mineflayer)
 * 3. Wait for prismarine-viewer to add audio support
 */

const puppeteer = require('puppeteer-core');

const VIEWER_URL = process.env.SPECTATOR_URL || 'http://minecraft-spectator-bot:3000';
const DISPLAY = process.env.DISPLAY || ':99';
const WIDTH = parseInt(process.env.DISPLAY_WIDTH || '1280');
const HEIGHT = parseInt(process.env.DISPLAY_HEIGHT || '720');

async function captureViewer() {
  console.log('Starting Puppeteer to capture viewer...');
  console.log(`Display: ${DISPLAY}, Size: ${WIDTH}x${HEIGHT}, URL: ${VIEWER_URL}`);
  
  try {
    // Launch browser in non-headless mode so FFmpeg can capture it via x11grab
    console.log('Launching Chromium browser...');
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: false, // Must be false for x11grab to capture
      // Remove the "Chrome is being controlled" infobar
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        `--display=${DISPLAY}`,
        `--window-size=${WIDTH},${HEIGHT}`,
        '--start-maximized',
        '--kiosk', // Fullscreen mode
        '--disable-infobars',
        '--disable-session-crashed-bubble',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=AutomationControlled',
        // Audio settings (for future audio support)
        '--autoplay-policy=no-user-gesture-required',
        '--enable-features=AudioServiceOutOfProcess',
        // Performance optimizations
        '--disable-extensions',
        '--disable-translate',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--disable-default-apps'
      ]
    });
    
    const browserProcess = browser.process();
    console.log('Browser launched, PID:', browserProcess ? browserProcess.pid : 'unknown');
    
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT });

    // Hide automation indicators
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    console.log(`Navigating to viewer: ${VIEWER_URL}`);
    
    // Wait for page to load
    await page.goto(VIEWER_URL, { waitUntil: 'networkidle0', timeout: 60000 });
    
    console.log('Viewer loaded successfully');
    console.log('Browser window open for FFmpeg capture via x11grab');
    
    // Try to enable any audio (for future when prismarine-viewer adds audio)
    await page.evaluate(() => {
      // Auto-play any audio/video elements
      document.querySelectorAll('audio, video').forEach(el => {
        el.muted = false;
        el.volume = 1.0;
        el.play().catch(() => {});
      });
    });
  
    // Keep browser open - FFmpeg captures via x11grab
    process.on('SIGTERM', async () => {
      console.log('Closing browser...');
      await browser.close();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('Closing browser...');
      await browser.close();
      process.exit(0);
    });
  
    // Periodic health check
    setInterval(async () => {
      try {
        await page.evaluate(() => document.title);
      } catch (e) {
        console.error('Viewer page became unresponsive');
        process.exit(1);
      }
    }, 30000);
    
  } catch (error) {
    console.error('Error in captureViewer:', error.message);
    throw error;
  }
}

captureViewer().catch(error => {
  console.error('Failed to start viewer capture:', error.message);
  process.exit(1);
});
