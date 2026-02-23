const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

io.on("connection", (socket) => {

  socket.on("createRoom", ({ roomCode, classLevel, chapter }) => {
    if (!roomCode) {
      socket.emit("errorMsg", "Enter Room ID");
      return;
    }

    if (rooms[roomCode]) {
      socket.emit("errorMsg", "Room already exists");
      return;
    }

    rooms[roomCode] = {
      players: [socket.id],
      classLevel,
      chapter
    };

    socket.join(roomCode);
    socket.emit("roomCreated");

    console.log("Room created:", roomCode);
  });

  socket.on("joinRoom", ({ roomCode }) => {
    const room = rooms[roomCode];

    if (!room) {
      socket.emit("errorMsg", "Room not found");
      return;
    }

    if (room.players.length >= 4) {
      socket.emit("errorMsg", "Room full");
      return;
    }

    room.players.push(socket.id);
    socket.join(roomCode);

    console.log("Room started:", roomCode);

    io.to(roomCode).emit("startGame", room);
  });

  socket.on("disconnect", () => {
    for (let roomCode in rooms) {
      const room = rooms[roomCode];
      room.players = room.players.filter(id => id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomCode];
        console.log("Room deleted:", roomCode);
      }
    }
  });

});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});