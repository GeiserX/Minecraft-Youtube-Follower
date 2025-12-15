#!/usr/bin/env python3
"""
Minecraft Streaming Service
Captures spectator bot view using Puppeteer and streams to YouTube/Twitch with Mumble voice chat
"""

import subprocess
import time
import requests
import os
import signal
import sys
import logging
import threading
from pathlib import Path

# Configure logging
log_dir = Path('/app/logs')
log_dir.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'streaming.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Configuration from environment
SPECTATOR_URL = os.getenv('SPECTATOR_URL', 'http://minecraft-spectator-bot:3000')
MUMBLE_SERVER = os.getenv('MUMBLE_SERVER', 'localhost')
MUMBLE_PORT = int(os.getenv('MUMBLE_PORT', '64738'))
YOUTUBE_STREAM_KEY = os.getenv('YOUTUBE_STREAM_KEY')
TWITCH_STREAM_KEY = os.getenv('TWITCH_STREAM_KEY')
STREAM_PLATFORM = os.getenv('STREAM_PLATFORM', 'youtube').lower()
YOUTUBE_INGEST_METHOD = os.getenv('YOUTUBE_INGEST_METHOD', 'rtmp').lower()  # rtmp|hls
YOUTUBE_HLS_HTTP_METHOD = os.getenv('YOUTUBE_HLS_HTTP_METHOD', 'PUT').upper()  # PUT or POST
YOUTUBE_HLS_URL = os.getenv('YOUTUBE_HLS_URL')
# Video quality settings (lower = smoother streaming, less CPU)
YOUTUBE_VIDEO_BITRATE = os.getenv('YOUTUBE_VIDEO_BITRATE', '1500k')  # Reduced for smoother streaming
YOUTUBE_MAXRATE = os.getenv('YOUTUBE_MAXRATE', YOUTUBE_VIDEO_BITRATE)
YOUTUBE_BUFSIZE = os.getenv('YOUTUBE_BUFSIZE', '3000k')  # 2x bitrate
YOUTUBE_OUTPUT_WIDTH = int(os.getenv('YOUTUBE_OUTPUT_WIDTH', '1280'))
YOUTUBE_OUTPUT_HEIGHT = int(os.getenv('YOUTUBE_OUTPUT_HEIGHT', '720'))
YOUTUBE_FRAMERATE = int(os.getenv('YOUTUBE_FRAMERATE', '24'))  # 24fps = smoother with less CPU
DISPLAY_WIDTH = int(os.getenv('DISPLAY_WIDTH', '1280'))  # Match output for less scaling
DISPLAY_HEIGHT = int(os.getenv('DISPLAY_HEIGHT', '720'))
VOICE_VOLUME_GAIN = float(os.getenv('VOICE_VOLUME_GAIN', '2.0'))
GAME_MUSIC_VOLUME_GAIN = float(os.getenv('GAME_MUSIC_VOLUME_GAIN', '0.5'))

# Determine stream URL based on platform
if STREAM_PLATFORM == 'youtube':
    # YouTube ingest:
    # - RTMP: rtmp://a.rtmp.youtube.com/live2/<key> (standard)
    # - HLS:  https://a.upload.youtube.com/http_upload_hls?cid=<cid>&copy=0&file=master.m3u8
    #
    # For HLS, YouTube Studio gives you an HTTPS ingest URL (recommended) or a *CID* (looks like a stream key).
    if YOUTUBE_INGEST_METHOD == 'hls':
        # Official docs: when HLS is selected, YouTube provides an HTTPS ingest URL (not RTMP):
        # https://support.google.com/youtube/answer/10349430?hl=es
        #
        # Prefer the exact URL from YouTube Studio (it can vary), otherwise fall back to constructing
        # the standard upload URL using the CID.
        if YOUTUBE_HLS_URL:
            # YouTube Studio HLS URLs typically end with `...&file=` (no filename).
            # Accept either:
            # - full URL with file= already filled
            # - base URL ending with file= (recommended)
            STREAM_URL = YOUTUBE_HLS_URL
            logger.info('Using YouTube HLS ingest URL from YOUTUBE_HLS_URL')
        else:
            if not YOUTUBE_STREAM_KEY:
                logger.error('For YouTube HLS you must set either YOUTUBE_HLS_URL (recommended) or YOUTUBE_STREAM_KEY (CID)')
                sys.exit(1)
            # HLS upload endpoint base (no auth required)
            YOUTUBE_HLS_UPLOAD_BASE = os.getenv('YOUTUBE_HLS_UPLOAD_BASE', 'https://a.upload.youtube.com/http_upload_hls')
            # Using YOUTUBE_STREAM_KEY as CID (per YouTube Studio HLS ingest)
            STREAM_URL = f"{YOUTUBE_HLS_UPLOAD_BASE}?cid={YOUTUBE_STREAM_KEY}&copy=0&file=master.m3u8"
            logger.info('Using YouTube HLS ingest via CID from YOUTUBE_STREAM_KEY')
    else:
        if not YOUTUBE_STREAM_KEY:
            logger.error('YOUTUBE_STREAM_KEY is required for YouTube RTMP streaming')
            sys.exit(1)
        # Default RTMP (what YouTube Studio shows). Override with YOUTUBE_INGEST_URL if needed.
        YOUTUBE_INGEST_URL = os.getenv('YOUTUBE_INGEST_URL', 'rtmp://a.rtmp.youtube.com/live2')
        STREAM_URL = f"{YOUTUBE_INGEST_URL}/{YOUTUBE_STREAM_KEY}"
elif STREAM_PLATFORM == 'twitch':
    if not TWITCH_STREAM_KEY:
        logger.error('TWITCH_STREAM_KEY is required for Twitch streaming')
        sys.exit(1)
    STREAM_URL = f"rtmp://live.twitch.tv/app/{TWITCH_STREAM_KEY}"
else:
    logger.error(f'Unknown streaming platform: {STREAM_PLATFORM}')
    sys.exit(1)

ffmpeg_process = None
xvfb_process = None
puppeteer_process = None

def _is_x_display_showing_windows():
    """Return True if Xvfb has any child windows (Chromium should create at least one)."""
    try:
        out = subprocess.check_output(
            ['xwininfo', '-root', '-tree'],
            env={**os.environ, 'DISPLAY': ':99'},
            stderr=subprocess.STDOUT,
            text=True,
            timeout=5
        )
        # If there are children, xwininfo prints "N children:" where N > 0.
        return '0 children.' not in out
    except Exception:
        return False

def wait_for_x_windows(timeout=90):
    """Wait until Chromium creates a window in Xvfb so FFmpeg won't capture black."""
    start = time.time()
    while time.time() - start < timeout:
        if _is_x_display_showing_windows():
            return True
        time.sleep(1)
    return False

def _pipe_process_output(proc, name):
    """Pipe child process stdout/stderr into our logs so we can see crashes."""
    if not proc:
        return
    def _reader(stream, level):
        try:
            for line in iter(stream.readline, ''):
                line = (line or '').strip()
                if not line:
                    continue
                if level == 'info':
                    logger.info(f'{name}: {line}')
                else:
                    logger.debug(f'{name}: {line}')
        except Exception:
            pass
    if proc.stdout:
        threading.Thread(target=_reader, args=(proc.stdout, 'info'), daemon=True).start()
    if proc.stderr:
        threading.Thread(target=_reader, args=(proc.stderr, 'info'), daemon=True).start()

def wait_for_service(url, service_name, timeout=300):
    """Wait for a service to become available"""
    logger.info(f'Waiting for {service_name} to be ready...')
    start_time = time.time()
    
    # Faster polling to avoid long sleeps (user requested)
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{url}", timeout=5)
            if response.status_code == 200:
                logger.info(f'{service_name} is ready!')
                return True
        except requests.exceptions.RequestException:
            pass
        time.sleep(1)
    
    logger.error(f'{service_name} did not become ready within {timeout} seconds')
    return False

def start_xvfb():
    """Start virtual display server"""
    global xvfb_process
    logger.info('Starting Xvfb...')
    xvfb_process = subprocess.Popen([
        'Xvfb', ':99',
        '-screen', '0', f'{DISPLAY_WIDTH}x{DISPLAY_HEIGHT}x24',
        '-ac', '+extension', 'GLX', '+render', '-noreset'
    ])
    time.sleep(1)
    logger.info('Xvfb started')

def start_puppeteer_capture():
    """Start Puppeteer to capture the viewer"""
    global puppeteer_process
    
    # Start Node.js script to run Puppeteer
    if os.name == 'nt':
        # Windows: Use different approach
        logger.info('Windows detected - Puppeteer will run separately')
        return True
    
    # Ensure viewer HTTP is reachable before launching Chromium, otherwise Puppeteer will fail fast
    # and FFmpeg will capture a black screen.
    if not wait_for_service(SPECTATOR_URL, 'Spectator bot viewer'):
        return False

    logger.info('Starting Puppeteer capture script...')
    try:
        puppeteer_process = subprocess.Popen(
            ['node', '/app/capture-viewer.js'],
            env={**os.environ, 'DISPLAY': ':99'},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        _pipe_process_output(puppeteer_process, 'Puppeteer')
        time.sleep(1)  # short grace period
        logger.info('Puppeteer capture started')
        return True
    except Exception as e:
        logger.error(f'Failed to start Puppeteer: {e}')
        return False

def start_stream():
    """Start FFmpeg streaming process"""
    global ffmpeg_process
    
    # Wait for services to be ready
    if not wait_for_service(SPECTATOR_URL, 'Spectator bot viewer'):
        return False

    # Ensure Chromium window exists in Xvfb BEFORE starting FFmpeg capture
    # Otherwise YouTube gets a black stream after restarts.
    if os.name != 'nt':
        if not wait_for_x_windows(timeout=90):
            logger.error('Xvfb has no windows after waiting; restarting Puppeteer...')
            try:
                if puppeteer_process:
                    puppeteer_process.terminate()
            except Exception:
                pass
            start_puppeteer_capture()
            if not wait_for_x_windows(timeout=90):
                logger.error('Still no X windows; aborting start_stream to avoid black output.')
                return False
    
    logger.info(f'Starting stream to {STREAM_PLATFORM}...')
    
    # Build FFmpeg command
    # Capture from X11 display (where Puppeteer will render the viewer)
    # Mix Mumble audio with game audio (if available)
    
    # Check if we're on Windows (no /dev/dri)
    is_windows = os.name == 'nt' or not os.path.exists('/dev/dri/renderD128')
    
    # Video source: X11 display capture (Puppeteer will render viewer here)
    video_input = [
        '-f', 'x11grab',
        '-video_size', f'{DISPLAY_WIDTH}x{DISPLAY_HEIGHT}',
        '-framerate', str(YOUTUBE_FRAMERATE),  # Lower framerate = smoother streaming
        # Hide mouse cursor in the captured stream
        '-draw_mouse', '0',
        '-i', ':99.0'
    ]

    # ---- YouTube HLS ingestion (build a dedicated FFmpeg command) ----
    # We build this separately so we can ensure input ordering:
    # all `-i ...` inputs must come BEFORE any `-map` / output options.
    if STREAM_PLATFORM == 'youtube' and YOUTUBE_INGEST_METHOD == 'hls':
        # STREAM_URL can be either:
        # - base URL ending with `file=` (from YouTube Studio) -> we append filenames
        # - full URL with `file=master.m3u8`
        if STREAM_URL.endswith('file='):
            hls_master_url = f"{STREAM_URL}master.m3u8"
            hls_segment_url = f"{STREAM_URL}segment_%06d.ts"
        else:
            hls_master_url = STREAM_URL
            hls_segment_url = hls_master_url.replace('file=master.m3u8', 'file=segment_%06d.ts')

        ffmpeg_cmd = ['ffmpeg', '-hide_banner']
        ffmpeg_cmd += video_input
        
        # Audio: Try to capture Chrome's audio output via PulseAudio, fallback to silent
        # NOTE: prismarine-viewer currently doesn't produce game audio (it's visual only).
        # This infrastructure is ready for when audio is added or for ambient music.
        audio_source = 'anullsrc=channel_layout=stereo:sample_rate=44100'
        ffmpeg_cmd += ['-f', 'lavfi', '-i', audio_source]

        # Keyframe interval = framerate * 2 (keyframe every 2 seconds)
        keyframe_interval = YOUTUBE_FRAMERATE * 2

        # Video encoding (HLS-friendly, optimized for smooth streaming)
        ffmpeg_cmd += [
            # Scale to output resolution + force yuv420p (YouTube friendly)
            '-vf', f'scale={YOUTUBE_OUTPUT_WIDTH}:{YOUTUBE_OUTPUT_HEIGHT},format=yuv420p',
            '-c:v', 'libx264',
            '-profile:v', 'main',  # 'main' is more compatible and faster than 'high'
            '-level:v', '4.0',
            '-preset', 'superfast',  # Faster encoding = less CPU = smoother streaming
            '-tune', 'zerolatency',
            # CBR for consistent streaming (YouTube prefers this)
            '-minrate', YOUTUBE_VIDEO_BITRATE,
            '-b:v', YOUTUBE_VIDEO_BITRATE,
            '-maxrate', YOUTUBE_MAXRATE,
            '-bufsize', YOUTUBE_BUFSIZE,
            '-x264-params', 'nal-hrd=cbr:filler=1:force-cfr=1',
            '-g', str(keyframe_interval),
            '-keyint_min', str(keyframe_interval),
            '-sc_threshold', '0',
            '-pix_fmt', 'yuv420p'
        ]

        # Audio encoding (silent AAC)
        ffmpeg_cmd += [
            '-map', '0:v',
            '-map', '1:a',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '2'
        ]

        # HLS output to YouTube upload endpoint (POST)
        ffmpeg_cmd += [
            '-fflags', '+genpts',
            '-flags', '+global_header',
            # YouTube HLS: 1–4s segments recommended; using 4s tends to be more stable.
            '-hls_time', '4',
            '-hls_init_time', '4',
            # YouTube HLS requirement: rolling playlists must not have more than 5 segments.
            # Ref: https://support.google.com/youtube/answer/10349430 (HLS protocol requirements)
            '-hls_list_size', '5',
            # Avoid delete_segments for HTTP upload; keep a rolling playlist and omit endlist.
            '-hls_flags', 'independent_segments+omit_endlist',
            '-hls_segment_type', 'mpegts',
            '-hls_segment_filename', hls_segment_url,
            '-http_persistent', '1',
            # YouTube HLS requirements mention using HTTPS POST/PUT.
            # In practice, PUT tends to be more reliable for the upload endpoints.
            '-method', YOUTUBE_HLS_HTTP_METHOD,
            '-f', 'hls',
            hls_master_url
        ]

        try:
            logger.info(f'Starting FFmpeg (YouTube HLS): {" ".join(ffmpeg_cmd)}')
            ffmpeg_process = subprocess.Popen(
                ffmpeg_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            def monitor_ffmpeg():
                for line in ffmpeg_process.stderr:
                    msg = line.strip()
                    if ('http' in msg.lower()) or ('error' in msg.lower()) or ('failed' in msg.lower()):
                        logger.info(f'FFmpeg: {msg}')
                    else:
                        logger.debug(f'FFmpeg: {msg}')

            import threading
            monitor_thread = threading.Thread(target=monitor_ffmpeg, daemon=True)
            monitor_thread.start()

            logger.info('Stream started successfully!')
            return True

        except Exception as e:
            logger.error(f'Failed to start stream (YouTube HLS): {e}')
            return False
    
    # Audio sources: Mumble (via PulseAudio/ALSA) and game audio
    # Note: On Windows, audio capture is more complex
    audio_inputs = []
    audio_filters = []
    
    if not is_windows:
        # Linux: Use PulseAudio to capture Mumble output
        # Mumble outputs to PulseAudio sink, we capture it
        # For now, we'll use a virtual PulseAudio sink that Mumble can output to
        audio_inputs.extend([
            '-f', 'pulse',
            '-i', 'mumble_monitor'  # PulseAudio monitor source for Mumble
        ])
        audio_filters.append(f'[0:a]volume={VOICE_VOLUME_GAIN}[voice]')
        
        # Game audio (would need to capture from Minecraft client)
        # For now, we'll just use voice chat audio
        # TODO: Add game audio capture when Minecraft client audio is available
        audio_filters.append('[voice]acopy[out]')  # Just voice for now
    else:
        # Windows: Audio capture is complex
        # Would need to use Windows audio APIs or virtual audio cable
        # For now, video only - audio can be added later
        logger.warning('Windows audio capture not fully implemented - video only for now')
        logger.info('To add audio on Windows, consider using VB-Audio Virtual Cable or similar')
    
    # Base FFmpeg command
    ffmpeg_cmd = ['ffmpeg', '-hide_banner'] + video_input
    
    # Add audio inputs if available
    if audio_inputs:
        ffmpeg_cmd.extend(audio_inputs)
    
    # Video encoding - YouTube compatible settings
    if is_windows or not os.path.exists('/dev/dri/renderD128'):
        # Software encoding with YouTube-compatible settings
        ffmpeg_cmd.extend([
            '-vf', 'format=yuv420p',  # Force yuv420p format BEFORE encoding
            '-c:v', 'libx264',
            '-profile:v', 'high',  # YouTube prefers high profile
            '-level:v', '4.1',
            '-preset', 'veryfast',
            '-tune', 'zerolatency',
            '-b:v', '4500k',  # Increased bitrate for 1080p
            '-maxrate', '4500k',
            '-bufsize', '9000k',
            '-g', '60',  # Keyframe every 2 seconds at 30fps
            '-keyint_min', '60',
            '-sc_threshold', '0',  # Disable scene change detection for consistent keyframes
            '-pix_fmt', 'yuv420p'
        ])
    else:
        # Intel iGPU hardware encoding
        logger.info('Intel iGPU detected, using hardware encoding')
        ffmpeg_cmd.extend([
            '-vaapi_device', '/dev/dri/renderD128',
            '-vf', 'format=nv12,hwupload',
            '-c:v', 'h264_vaapi',
            '-b:v', '3000k',
            '-maxrate', '3000k',
            '-bufsize', '6000k',
            '-g', '60'
        ])
    
    # Audio encoding
    if audio_filters:
        ffmpeg_cmd.extend([
            '-filter_complex', ';'.join(audio_filters),
            '-map', '0:v',
            '-map', '[out]',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100'
        ])
    else:
        # No audio - video only stream
        ffmpeg_cmd.extend([
            '-map', '0:v',
            '-an'
        ])
    
    # Output (RTMP/FLV output for YouTube RTMP or Twitch)
    ffmpeg_cmd.extend([
        '-f', 'flv',
        STREAM_URL
    ])
    
    try:
        logger.info(f'Starting FFmpeg: {" ".join(ffmpeg_cmd)}')
        ffmpeg_process = subprocess.Popen(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Monitor FFmpeg output
        def monitor_ffmpeg():
            for line in ffmpeg_process.stderr:
                msg = line.strip()
                logger.debug(f'FFmpeg: {msg}')
        
        monitor_thread = threading.Thread(target=monitor_ffmpeg, daemon=True)
        monitor_thread.start()
        
        logger.info('Stream started successfully!')
        return True
        
    except Exception as e:
        logger.error(f'Failed to start stream: {e}')
        return False

def cleanup():
    """Clean up processes"""
    global ffmpeg_process, xvfb_process, puppeteer_process
    
    logger.info('Cleaning up...')
    
    if ffmpeg_process:
        ffmpeg_process.terminate()
        try:
            ffmpeg_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            ffmpeg_process.kill()
    
    if puppeteer_process:
        puppeteer_process.terminate()
        try:
            puppeteer_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            puppeteer_process.kill()
    
    if xvfb_process:
        xvfb_process.terminate()
        try:
            xvfb_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            xvfb_process.kill()
    
    logger.info('Cleanup complete')

def signal_handler(sig, frame):
    """Handle shutdown signals"""
    logger.info('Received shutdown signal')
    cleanup()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    """Main function"""
    logger.info('Minecraft Streaming Service starting...')
    
    # Start virtual display (Linux only)
    if os.name != 'nt':
        start_xvfb()
    
    # Start Puppeteer capture (and ensure it actually creates a window)
    if os.name != 'nt':
        if not start_puppeteer_capture():
            logger.error('Failed to start Puppeteer')
            cleanup()
            sys.exit(1)
        if not wait_for_x_windows(timeout=90):
            logger.error('Puppeteer did not create an X window; restarting Puppeteer once...')
            try:
                if puppeteer_process:
                    puppeteer_process.terminate()
            except Exception:
                pass
            start_puppeteer_capture()
            if not wait_for_x_windows(timeout=90):
                logger.error('Still no X window; cannot start streaming without black output.')
                cleanup()
                sys.exit(1)
    
    # Start streaming
    if not start_stream():
        logger.error('Failed to start streaming')
        cleanup()
        sys.exit(1)
    
    # Keep running
    try:
        while True:
            # If Puppeteer died, restart it AND restart FFmpeg to avoid black output.
            if puppeteer_process and puppeteer_process.poll() is not None:
                logger.error('Puppeteer process died, restarting Puppeteer + FFmpeg...')
                try:
                    if ffmpeg_process:
                        ffmpeg_process.terminate()
                        ffmpeg_process.wait(timeout=5)
                except Exception:
                    pass
                start_puppeteer_capture()
                # wait for window before restarting stream
                if os.name != 'nt':
                    wait_for_x_windows(timeout=90)
                start_stream()

            # If Xvfb lost its windows (Chromium crashed), restart Puppeteer + FFmpeg.
            if os.name != 'nt' and not _is_x_display_showing_windows():
                logger.error('Xvfb has no windows (black capture). Restarting Puppeteer + FFmpeg...')
                try:
                    if ffmpeg_process:
                        ffmpeg_process.terminate()
                        ffmpeg_process.wait(timeout=5)
                except Exception:
                    pass
                try:
                    if puppeteer_process:
                        puppeteer_process.terminate()
                        puppeteer_process.wait(timeout=5)
                except Exception:
                    pass
                start_puppeteer_capture()
                wait_for_x_windows(timeout=90)
                start_stream()

            if ffmpeg_process and ffmpeg_process.poll() is not None:
                logger.error('FFmpeg process died, restarting...')
                time.sleep(5)
                if not start_stream():
                    logger.error('Failed to restart stream')
                    break
            time.sleep(10)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()

if __name__ == '__main__':
    main()
