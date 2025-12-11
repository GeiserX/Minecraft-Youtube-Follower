# Implementation Choices for Full Server Setup

This document outlines the key decisions you need to make to get a fully working 24/7 Minecraft streaming server.

## 🔴 Critical Decisions Required

### 1. Video Capture Method

**Current Status**: Bot follows players, but video capture is not implemented.

**Choose ONE:**

#### Option A: Browser Automation with Prismarine-Viewer (Recommended)
- **Technology**: Puppeteer + prismarine-viewer web server
- **Pros**: 
  - ✅ Works well in Docker
  - ✅ Can use hardware acceleration
  - ✅ Reliable and well-tested
  - ✅ Good performance
- **Cons**: 
  - ⚠️ Requires additional Node.js dependencies
  - ⚠️ Needs browser in Docker container
- **Complexity**: Medium
- **Resource Usage**: Medium

#### Option B: Direct Minecraft Client Connection
- **Technology**: Headless Minecraft client library
- **Pros**: 
  - ✅ Native Minecraft rendering
  - ✅ Best visual quality
  - ✅ Most authentic look
- **Cons**: 
  - ⚠️ More complex to implement
  - ⚠️ Higher CPU/memory usage
  - ⚠️ May require additional Minecraft account
- **Complexity**: High
- **Resource Usage**: High

#### Option C: API-Based Rendering
- **Technology**: Custom rendering pipeline
- **Pros**: 
  - ✅ Most flexible
  - ✅ Can customize rendering style
- **Cons**: 
  - ⚠️ Requires building custom renderer
  - ⚠️ Most development time needed
- **Complexity**: Very High
- **Resource Usage**: Medium

**Recommendation**: **Option A (Browser Automation)** - Best balance of quality, performance, and implementation time.

---

### 2. Voice Server Solution

**Current Status**: Basic WebRTC foundation exists, but needs completion.

**Choose ONE:**

#### Option A: Complete WebRTC Implementation
- **Technology**: Full WebRTC with Socket.IO signaling
- **Pros**: 
  - ✅ Web browser access (no client needed)
  - ✅ Mobile-friendly
  - ✅ Modern technology
  - ✅ Already partially implemented
- **Cons**: 
  - ⚠️ Requires STUN/TURN servers for NAT traversal
  - ⚠️ More complex audio mixing
  - ⚠️ Needs additional development
- **Complexity**: Medium-High
- **STUN/TURN Options**:
  - Free: Google STUN servers (may not work for all networks)
  - Paid: Twilio TURN ($0.40 per GB)
  - Self-hosted: coturn server (free, but requires setup)

#### Option B: Mumble Server (Recommended for Production)
- **Technology**: Mumble VoIP server
- **Pros**: 
  - ✅ Mature, stable, battle-tested
  - ✅ Excellent Docker support
  - ✅ Low latency
  - ✅ Easy FFmpeg integration
  - ✅ Web client available (Mumble Web)
  - ✅ No STUN/TURN needed
- **Cons**: 
  - ⚠️ Requires Mumble client (or web client)
  - ⚠️ Less "modern" than WebRTC
- **Complexity**: Low
- **Resource Usage**: Low

**Recommendation**: **Option B (Mumble)** - More reliable for 24/7 operation, easier to integrate.

---

### 3. Audio Mixing Strategy

**Current Status**: Framework exists, needs implementation.

**Depends on Voice Server Choice:**

#### If Using WebRTC:
- **Method**: Server-side audio mixing
  - Capture all participant audio streams
  - Mix into single stream using Node.js audio libraries
  - Output to PulseAudio/ALSA virtual device
  - FFmpeg captures from virtual device
- **Complexity**: High
- **Libraries Needed**: `node-webrtc`, `node-speaker`, or similar

#### If Using Mumble:
- **Method**: Direct PulseAudio capture
  - Mumble outputs to PulseAudio
  - FFmpeg captures Mumble audio + game audio
  - Mix in FFmpeg with volume controls
- **Complexity**: Low
- **FFmpeg Command**:
  ```bash
  ffmpeg -f pulse -i mumble_output \
         -f pulse -i game_audio \
         -filter_complex "[0:a]volume=2.0[voice];[1:a]volume=0.5[game];[voice][game]amix=inputs=2[out]" \
         -map "[out]" ...
  ```

**Recommendation**: Choose based on voice server - Mumble is simpler.

---

### 4. Video Source Integration

**Depends on Video Capture Choice:**

#### If Using Browser Automation:
- Bot runs `prismarine-viewer` web server on port 3000
- Streaming service uses Puppeteer to capture browser viewport
- FFmpeg captures from virtual display (Xvfb)

#### If Using Direct Client:
- Separate Minecraft client connects in spectator mode
- Client follows bot's target player
- FFmpeg captures client window

#### If Using API-Based:
- Bot exposes view data via REST API
- Streaming service renders frames
- FFmpeg captures rendered output

---

## 📋 Recommended Complete Stack

Based on reliability and ease of implementation:

1. **Video Capture**: Browser Automation (Puppeteer + prismarine-viewer)
2. **Voice Server**: Mumble Server
3. **Audio Mixing**: FFmpeg-based (with Mumble)
4. **Streaming**: FFmpeg with Intel iGPU hardware encoding

**Why This Stack?**
- ✅ All components are proven and stable
- ✅ Good Docker support
- ✅ Lower complexity = fewer bugs
- ✅ Better for 24/7 operation
- ✅ Easier to maintain

---

## 🚀 Implementation Priority

1. **Phase 1** (Essential):
   - ✅ Bot following players (DONE)
   - ⏳ Video capture implementation
   - ⏳ Basic streaming to YouTube/Twitch

2. **Phase 2** (Core Features):
   - ⏳ Voice server (Mumble or WebRTC)
   - ⏳ Audio mixing
   - ⏳ Voice chat in stream

3. **Phase 3** (Polish):
   - ⏳ Split-screen for multiple players
   - ⏳ Base showcase mode improvements
   - ⏳ Monitoring and auto-restart

---

## ❓ Questions to Answer

Please choose:

1. **Video Capture**: [ ] Option A (Browser) [ ] Option B (Direct Client) [ ] Option C (API-Based)
2. **Voice Server**: [ ] Option A (WebRTC) [ ] Option B (Mumble)
3. **STUN/TURN** (if WebRTC): [ ] Google (free) [ ] Twilio (paid) [ ] Self-hosted coturn
4. **Priority**: [ ] Get basic streaming working first [ ] Implement everything at once

Once you make these choices, I can implement the complete solution!

