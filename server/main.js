const _ = require('lodash');
const { Chess } = require('chess.js');
const chess = new Chess();
const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { resolve } = require('path');
const io = new Server(server);
const PORT = process.env.PORT || 4000;
const ROOM_SPACE = "/games";
const games = {};
app.use(cors());
app.use(express.static(resolve(__dirname, '..', 'client')))

const GameNS = io.of(ROOM_SPACE);

function calcMove(players) {
  const votes = players.map(p => p.vote.move);
  const votesCount = {};
  for(const v of votes) {
    const {from, to} = v || {};
    if(from && to) {
      votesCount[JSON.stringify(v)] ? 
          votesCount[JSON.stringify(v)] ++ : 
          votesCount[JSON.stringify(v)] = 1; 
    } else {
      return null;
    }
  }
 
  let win;
  for(const k in votesCount) {
    if(!win) {
      win = k;
    } else if(votesCount[win] < votesCount[k]) {
      win = k;
    }
  }
  
  return win && JSON.parse(win);
}

async function gameState(room) {
  const chess = games[room];
  if(!chess) {
    return {};
  }
  const sockets = await GameNS.in(room).fetchSockets();
  const players = [];
  const turn = chess.turn();
  for(const s of sockets) {
    if(s.data?.side) {
      players.push(s.data);
    }
  }

  const move = calcMove(players.filter(p => p.side === turn));

  if(move) {
    chess.move(move);
  }

  const rooms = GameNS.adapter.rooms;
  const current = rooms.get(room);

  const over = chess.game_over() ? (
    chess.in_stalemate() && "stalemate" ||
    chess.in_checkmate() && "checkmate" ||
    chess.in_draw() && "draw" ||
    chess.insufficient_material() && 'insufficient material' ||
    chess.in_threefold_repetition() && "threefold repetition"
  ) : '';
  return {
    turn: chess.turn(),
    over,
    check: chess.in_check(),
    fen: chess.fen(),
    size: current?.size || 0,
    players
  };
}

async function emitState(room) {
  const state = await gameState(room);
  GameNS.to(room).emit('state', state);
}

function disconnect(socket) {
  console.log('disconnected: ',socket.id);
  return () => {
    io.emit('rooms', getRooms());
  }
}

 function getRooms() {
  const rooms = Array.from(GameNS.adapter.rooms.keys());
  const sids = Array.from(GameNS.sockets.keys());
  return _.difference(rooms, sids);
}

function joinUser(socket) {
  return async (room) => {

    const sockets = await GameNS.in(room).fetchSockets();

    const wCount = sockets.filter(s => s.data.side === 'w').length;
    const bCount = sockets.filter(s => s.data.side === 'b').length;

    socket.data.side = (wCount > bCount) ? 'b' : 'w';

    socket.data.id = socket.id;
    socket.data.vote = { promotion: null, move: null };

    socket.join(room);

  }
}

GameNS.adapter.on("create-room", room => {
  const chess = new Chess();
  games[room] = chess;
  io.emit('rooms', getRooms());
});

GameNS.adapter.on("delete-room ", room => {
  delete games[room];
  io.emit('rooms', getRooms());
});

GameNS.adapter.on("join-room", (room, id) => {
  console.log('join room:', room);
  emitState(room);
});

GameNS.adapter.on("leave-room", (room, id) => {
  console.log('leave room:', room);
  emitState(room);
});

GameNS.on("connection", socket => {
  socket.on('disconnect', disconnect(socket));
  socket.on('join', joinUser(socket));
  socket.on('vote', ({ move, promotion }) => {
      socket.data.vote = { move, promotion };
      const sids = GameNS.adapter.sids;
      const rooms = sids.get(socket.id);
      rooms.forEach(r => {
        if(r !== socket.id) {
          emitState(r);
        }
      });
  });
});

io.on('connection', (socket) => {
  socket.on('disconnect', disconnect(socket));
  socket.emit('rooms', getRooms());
});

server.listen(PORT, () => {
  console.log('listening on ' + PORT);
});