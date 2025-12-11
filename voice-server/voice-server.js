/**
 * WebRTC Voice Chat Server
 * Provides voice communication for players via web/mobile interface
 * Audio is mixed and made available for streaming integration
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.VOICE_SERVER_PORT || 8080;
const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '20');
const AUDIO_SAMPLE_RATE = parseInt(process.env.AUDIO_SAMPLE_RATE || '48000');

// Store active connections
const participants = new Map();
const audioStreams = new Map();

// Serve static files for web client
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    participants: participants.size,
    maxParticipants: MAX_PARTICIPANTS
  });
});

// Audio stream endpoint for streaming service
app.get('/audio-stream', (req, res) => {
  // This endpoint would provide the mixed audio stream
  // In a full implementation, you'd mix all participant audio here
  res.setHeader('Content-Type', 'audio/webm');
  // Placeholder - actual implementation would mix audio streams
  res.status(200).end();
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  if (participants.size >= MAX_PARTICIPANTS) {
    socket.emit('error', { message: 'Server is full' });
    socket.disconnect();
    return;
  }
  
  const participant = {
    id: socket.id,
    username: null,
    connectedAt: new Date(),
    audioEnabled: false
  };
  
  participants.set(socket.id, participant);
  
  // Send current participant list
  socket.emit('participants', Array.from(participants.values()).map(p => ({
    id: p.id,
    username: p.username,
    audioEnabled: p.audioEnabled
  })));
  
  // Broadcast new participant
  socket.broadcast.emit('participant-joined', {
    id: participant.id,
    username: participant.username
  });
  
  // Handle username setting
  socket.on('set-username', (username) => {
    participant.username = username;
    socket.broadcast.emit('participant-updated', {
      id: participant.id,
      username: username
    });
  });
  
  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      sender: socket.id
    });
  });
  
  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      sender: socket.id
    });
  });
  
  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });
  
  // Handle audio stream metadata
  socket.on('audio-enabled', () => {
    participant.audioEnabled = true;
    socket.broadcast.emit('participant-updated', {
      id: participant.id,
      audioEnabled: true
    });
  });
  
  socket.on('audio-disabled', () => {
    participant.audioEnabled = false;
    socket.broadcast.emit('participant-updated', {
      id: participant.id,
      audioEnabled: false
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    participants.delete(socket.id);
    audioStreams.delete(socket.id);
    
    socket.broadcast.emit('participant-left', {
      id: socket.id
    });
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Voice server listening on port ${PORT}`);
  console.log(`Max participants: ${MAX_PARTICIPANTS}`);
  console.log(`Audio sample rate: ${AUDIO_SAMPLE_RATE}Hz`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down voice server...');
  server.close(() => {
    console.log('Voice server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down voice server...');
  server.close(() => {
    console.log('Voice server closed');
    process.exit(0);
  });
});

