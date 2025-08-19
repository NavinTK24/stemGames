const path = require('path');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ---------------- In-memory state -----------------
const rooms = new Map();
/* Room shape
{
  code: string,
  hostId: string,
  players: Map<socketId,{name,score}>,
  scores: { [name]: number },
  config: { classLevel?: string, topic?: string, roundSec: number },
  topicSelected: boolean,
  gameStarted: boolean,
  currentRound: { id, q, endsAt, won } | null,
  roundTimer: NodeJS.Timeout | null
}
*/

const BASE_QUESTIONS = {
  class10: [
    { eq: '2x + 3 = 7', solutions: ['x=2', '2'] },
    { eq: '5x - 10 = 0', solutions: ['x=2', '2'] },
    { eq: 'Area of a square of side 6?', solutions: ['36'] },
    { eq: 'Simplify: 12/3 + 4', solutions: ['8'] },
    { eq: 'Probability of head in a fair coin?', solutions: ['1/2', '0.5'] },
  ],
  class11: [
    { eq: 'det([[1,2],[3,4]])', solutions: ['-2'] },
    { eq: 'i^2 = ?', solutions: ['-1'] },
    { eq: 'Slope of line through (0,0) & (4,2)', solutions: ['1/2', '0.5'] },
    { eq: 'If A=[1 0;0 1], trace(A)=?', solutions: ['2'] },
    { eq: 'Solve: 3x - 9 = 0', solutions: ['x=3', '3'] },
  ],
  class12: [
    { eq: '∫(2x+3) dx from 0 to 1', solutions: ['5/2', '2.5'] },
    { eq: 'lim(x→0) sin x / x', solutions: ['1'] },
    { eq: 'cos^2θ + sin^2θ = ?', solutions: ['1'] },
    { eq: 'd/dx (x^2)', solutions: ['2x'] },
    { eq: '∫ 0→π sin x dx', solutions: ['2'] },
  ],
};

function normalize(ans) { return String(ans).toLowerCase().replace(/\s+/g, '').replace(/\u2212/g, '-'); }
function pickQuestion(topic) {
  const bank = BASE_QUESTIONS[topic] || BASE_QUESTIONS.class12;
  return bank[Math.floor(Math.random() * bank.length)];
}

function scheduleRoundEnd(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.currentRound) return;
  clearTimeout(room.roundTimer);
  const ms = Math.max(0, room.currentRound.endsAt - Date.now());
  room.roundTimer = setTimeout(() => {
    io.to(roomCode).emit('roundResult', {
      winner: null,
      correctAnswer: room.currentRound.q.solutions[0],
      scores: room.scores,
    });
    setTimeout(() => startRound(roomCode), 1200);
  }, ms);
}

function startRound(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const q = pickQuestion(room.config.classLevel || 'class12');
  const roundId = Math.random().toString(36).slice(2, 9);
  const endsAt = Date.now() + (room.config.roundSec * 1000);
  room.currentRound = { id: roundId, q, endsAt, won: false };
  room.gameStarted = true;
  io.to(roomCode).emit('round', { roundId, eq: q.eq, endsAt });
  scheduleRoundEnd(roomCode);
}

function maybeStart(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.players.size >= 2 && room.topicSelected) {
    startRound(roomCode);
  }
}

io.on('connection', (socket) => {
  let joinedRoom = null;

  socket.on('createRoomWithId', ({ roomCode, name, roundSec }) => {
    const code = (roomCode || '').trim().toUpperCase();
    if (!code) return socket.emit('errorMsg', 'Enter a room ID.');
    if (rooms.has(code)) return socket.emit('errorMsg', 'ID already exists. Try another.');
    const room = {
      code,
      hostId: socket.id,
      players: new Map(),
      scores: {},
      config: { classLevel: null, topic: null, roundSec: Math.min(Math.max(parseInt(roundSec||'45',10),10),120) },
      topicSelected: false,
      gameStarted: false,
      currentRound: null,
      roundTimer: null,
    };
    rooms.set(code, room);
    joinedRoom = code;
    socket.join(code);
    room.players.set(socket.id, { name, score: 0 });
    room.scores[name] = 0;
    socket.emit('roomCreated', { roomCode: code, youAreHost: true });
    io.to(code).emit('roster', Array.from(room.players.values()));
  });

  socket.on('joinRoomWithId', ({ roomCode, name }) => {
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('errorMsg', 'Room not found.');
    joinedRoom = code;
    socket.join(code);
    room.players.set(socket.id, { name, score: 0 });
    room.scores[name] = room.scores[name] || 0;
    socket.emit('roomJoined', { roomCode: code, youAreHost: socket.id === room.hostId, config: room.config, topicSelected: room.topicSelected });
    io.to(code).emit('roster', Array.from(room.players.values()));
    // If host already selected topic, and we now have 2+ players, start
    if (!room.gameStarted && room.topicSelected && room.players.size >= 2) {
      maybeStart(code);
    }
  });

  socket.on('setConfig', ({ roomCode, classLevel, topic }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (socket.id !== room.hostId) return; // only host sets
    room.config.classLevel = classLevel || 'class12';
    room.config.topic = topic || classLevel || 'class12';
    room.topicSelected = true;
    io.to(roomCode).emit('topicUpdated', { classLevel: room.config.classLevel, topic: room.config.topic });
    // Start only when at least one more player has joined
    if (!room.gameStarted) maybeStart(roomCode);
  });

  socket.on('startManually', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || socket.id !== room.hostId) return;
    if (room.players.size < 2) return socket.emit('errorMsg', 'Need at least 2 players.');
    if (!room.topicSelected) return socket.emit('errorMsg', 'Choose class & topic first.');
    startRound(roomCode);
  });

  socket.on('answer', ({ roomCode, roundId, answer }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.currentRound || room.currentRound.id !== roundId || room.currentRound.won) return;
    const ok = room.currentRound.q.solutions.some((s) => normalize(s) === normalize(answer));
    if (ok) {
      room.currentRound.won = true;
      clearTimeout(room.roundTimer);
      const p = room.players.get(socket.id);
      if (p) {
        p.score += 1;
        room.scores[p.name] = p.score;
      }
      io.to(roomCode).emit('roundResult', { winner: p ? p.name : null, correctAnswer: room.currentRound.q.solutions[0], scores: room.scores });
      setTimeout(() => startRound(roomCode), 1200);
    } else {
      socket.emit('wrong');
    }
  });

  socket.on('disconnect', () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;
    const player = room.players.get(socket.id);
    room.players.delete(socket.id);
    if (player) delete room.scores[player.name];
    if (socket.id === room.hostId || room.players.size === 0) {
      clearTimeout(room.roundTimer);
      rooms.delete(joinedRoom);
      io.to(joinedRoom).emit('roomClosed');
      io.socketsLeave(joinedRoom);
    } else {
      io.to(joinedRoom).emit('roster', Array.from(room.players.values()));
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));