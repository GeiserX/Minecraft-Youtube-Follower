# Implementation Notes

## Video Capture Implementation

The current implementation provides the bot logic for following players, but **video capture needs to be implemented**. Here are the recommended approaches:

### Option 1: Browser Automation (Recommended)

Use Puppeteer to control a headless Chrome browser that connects to a web-based Minecraft viewer:

1. Use `prismarine-viewer` in a web server mode
2. Capture the browser viewport with Puppeteer
3. Stream the captured video via FFmpeg

**Pros:**
- ✅ Works well in Docker
- ✅ Can use hardware acceleration
- ✅ Reliable

**Implementation:**
```javascript
// In streaming service, add:
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();
await page.goto('http://minecraft-spectator-bot:3000/viewer');
// Capture page video stream
```

### Option 2: Direct Minecraft Client Connection

Run a separate Minecraft client in spectator mode that follows the bot:

1. Use a headless Minecraft client library
2. Connect as spectator
3. Follow the bot's target player
4. Capture the client's view

**Pros:**
- ✅ Native Minecraft rendering
- ✅ Best quality

**Cons:**
- ⚠️ More complex
- ⚠️ Higher resource usage

### Option 3: API-Based Capture

Create an API endpoint that provides the bot's current view data and render it:

1. Bot exposes current view data via API
2. Streaming service renders frames
3. Stream rendered frames

**Pros:**
- ✅ Flexible
- ✅ Can customize rendering

**Cons:**
- ⚠️ Requires custom rendering pipeline

## Current Status

- ✅ Bot logic for player following
- ✅ Spectator mode switching
- ✅ Activity detection
- ✅ Base showcase mode
- ⚠️ Video capture (needs implementation)
- ✅ Voice server foundation
- ⚠️ Audio mixing (needs implementation)

## Next Steps for Production

1. **Implement video capture** using one of the options above
2. **Complete WebRTC implementation** for voice server
3. **Implement audio mixing** in streaming service
4. **Test with actual Minecraft server**
5. **Optimize for 24/7 operation** (auto-restart, monitoring)

## Known Limitations

1. **prismarine-viewer**: The package structure may need adjustment. Check latest version.
2. **Video Capture**: Currently placeholder - needs actual implementation
3. **Audio Mixing**: Voice server provides foundation but needs full WebRTC implementation
4. **Intel iGPU**: Passthrough works, but encoding parameters may need tuning

## Testing Checklist

- [ ] Bot connects to Minecraft server
- [ ] Bot switches to spectator mode
- [ ] Bot follows players correctly
- [ ] Bot switches between players every 30 seconds
- [ ] Base showcase works when no players online
- [ ] Video capture works (once implemented)
- [ ] Streaming to YouTube/Twitch works
- [ ] Voice server accessible from browser
- [ ] Voice chat audio mixed into stream
- [ ] Voice chat louder than game music


