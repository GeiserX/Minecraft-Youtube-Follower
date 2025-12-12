/**
 * Puppeteer script to capture the prismarine-viewer
 * This runs in the streaming service container
 */

const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');

const VIEWER_URL = process.env.SPECTATOR_URL || 'http://minecraft-spectator-bot:3000';
const DISPLAY = process.env.DISPLAY || ':99';
const WIDTH = parseInt(process.env.DISPLAY_WIDTH || '1920');
const HEIGHT = parseInt(process.env.DISPLAY_HEIGHT || '1080');

async function captureViewer() {
  console.log('Starting Puppeteer to capture viewer...');
  
  // Launch browser
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--display=${DISPLAY}`,
      `--window-size=${WIDTH},${HEIGHT}`
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });
  
  console.log(`Navigating to viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: 'networkidle0' });
  
  console.log('Viewer loaded, keeping browser open for FFmpeg capture...');
  
  // Keep browser open - FFmpeg will capture via x11grab
  // Don't close the browser
  process.on('SIGTERM', async () => {
    console.log('Closing browser...');
    await browser.close();
    process.exit(0);
  });
  
  // Keep process alive
  setInterval(() => {
    // Check if page is still responsive
    page.evaluate(() => document.title).catch(() => {
      console.error('Viewer page became unresponsive');
      process.exit(1);
    });
  }, 30000);
}

captureViewer().catch(error => {
  console.error('Failed to start viewer capture:', error);
  process.exit(1);
});

