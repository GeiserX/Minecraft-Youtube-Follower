# Voice Server Implementation

## Overview

The voice server provides WebRTC-based voice communication that can be accessed from web browsers and mobile devices. The audio is mixed and made available for integration into the streaming service.

## Architecture

### Technology Stack

- **WebRTC**: Peer-to-peer audio communication
- **Socket.IO**: Signaling server for WebRTC connections
- **Express**: HTTP server for web interface and API
- **Node.js**: Runtime environment

### Features

- ✅ Web browser access (no installation required)
- ✅ Mobile-friendly interface
- ✅ Real-time voice communication
- ✅ Audio mixing for stream integration
- ✅ Participant management
- ✅ Automatic reconnection

## Implementation Details

### Current Implementation

The current implementation provides:
1. **Web Interface**: HTML/JavaScript client accessible from any browser
2. **Signaling Server**: Socket.IO server for WebRTC connection setup
3. **Basic WebRTC**: Foundation for peer-to-peer audio

### Production Considerations

For a production-ready implementation, you'll need to:

1. **Full WebRTC Implementation**
   - Complete peer-to-peer audio streaming
   - Audio mixing server-side for stream integration
   - Noise suppression and echo cancellation

2. **Audio Mixing for Streaming**
   - Capture all participant audio streams
   - Mix them into a single audio stream
   - Provide the mixed stream to FFmpeg for inclusion in the YouTube/Twitch stream
   - Apply volume gain (voice chat louder than game music)

3. **STUN/TURN Servers**
   - For NAT traversal (required for most network setups)
   - Consider using free services like:
     - Google's STUN servers (free)
     - Twilio TURN servers (paid, but reliable)
     - Self-hosted coturn server

## Alternative Solutions

### Option 1: Mumble Server (Recommended for Docker)

**Pros:**
- ✅ Mature, stable, open-source
- ✅ Excellent Docker support
- ✅ Low latency
- ✅ Web client available (Mumble Web)
- ✅ Easy to integrate with FFmpeg

**Implementation:**
```yaml
# Add to docker-compose.yml
mumble-server:
  image: mumblevoip/mumble-server:latest
  ports:
    - "64738:64738/tcp"
    - "64738:64738/udp"
  volumes:
    - ./mumble/config:/data
  environment:
    - MUMBLE_SUPERUSER_PASSWORD=${MUMBLE_PASSWORD}
```

**FFmpeg Integration:**
```bash
# Capture Mumble audio and mix with game audio
ffmpeg -f pulse -i mumble_output \
       -f pulse -i game_audio \
       -filter_complex "[0:a]volume=2.0[voice];[1:a]volume=0.5[game];[voice][game]amix=inputs=2[out]" \
       -map "[out]" ...
```

### Option 2: Janus WebRTC Server

**Pros:**
- ✅ Full WebRTC server
- ✅ Excellent for web/mobile
- ✅ Audio mixing capabilities
- ✅ Docker support

**Cons:**
- ⚠️ More complex setup
- ⚠️ Higher resource usage

### Option 3: Jitsi Meet (Self-hosted)

**Pros:**
- ✅ Full-featured video/voice conferencing
- ✅ Web and mobile apps
- ✅ Easy to use
- ✅ Docker support

**Cons:**
- ⚠️ Overkill for voice-only
- ⚠️ Higher resource usage

## Recommended Approach

For your use case (Docker on Unraid, headless operation), I recommend:

1. **Short-term**: Use the current WebRTC implementation as a foundation
2. **Production**: Switch to **Mumble Server** for reliability and easier FFmpeg integration

### Mumble Integration Steps

1. Add Mumble server to docker-compose.yml
2. Configure Mumble for low-latency voice chat
3. Set up Mumble Web client for browser access
4. Use PulseAudio or ALSA to capture Mumble audio output
5. Mix with game audio in FFmpeg with proper volume levels

## Audio Mixing for Streaming

The key requirement is mixing voice chat audio (higher volume) with game music (lower volume) into the stream.

### FFmpeg Audio Mixing Example

```bash
ffmpeg \
  -f x11grab -i :99 \  # Video source
  -f pulse -i voice_chat \  # Voice chat audio
  -f pulse -i game_audio \  # Game audio
  -filter_complex "
    [1:a]volume=2.0[voice];  # Voice chat at 2x volume
    [2:a]volume=0.5[game];    # Game music at 0.5x volume
    [voice][game]amix=inputs=2:duration=longest[out]
  " \
  -map 0:v -map "[out]" \
  -c:v h264_vaapi \
  -c:a aac \
  -f flv rtmp://youtube/stream
```

## Next Steps

1. **Test current WebRTC implementation** with basic audio
2. **Evaluate Mumble** as an alternative
3. **Implement audio mixing** in streaming service
4. **Test volume levels** to ensure voice is clearly audible over game music
5. **Add mobile app** (optional, web interface should work on mobile)

## Resources

- [Mumble Server Docker](https://hub.docker.com/r/mumblevoip/mumble-server)
- [WebRTC Audio Mixing](https://webrtc.org/getting-started/peer-connections-guide)
- [FFmpeg Audio Filtering](https://ffmpeg.org/ffmpeg-filters.html#audio-filters)

