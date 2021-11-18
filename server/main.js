const { config } = require('dotenv');
config();
const { CLOCK_MIN, VOTE_TIME_SEC } = process.env;
// https://albert-gonzalez.github.io/easytimer.js/
const clock = Number(CLOCK_MIN);
const vote_time = Number(VOTE_TIME_SEC);

const { Timer } = require("easytimer.js");
const _ = require('lodash');
const { Chess } = require('chess.js');
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

function isPromotionMove(move, chess) {
  const { from, to } = move || {};
  if(!from || !to) {
    return false;
  }
  const piece = chess.get(from);
  if(!piece) {
    return false;
  }
  const { type, color } = piece || {};
  if(type !== chess.PAWN) {
    return false;
  }
  const black = color === chess.BLACK && to.endsWith('1');
  const white =  color === chess.WHITE && to.endsWith('8');
  return black || white;
}

function calcSelectedPromotion(players) {
  const votes = players.map(p => p.vote.promotion);
  const votesCount = {};
  for(const p of votes) {
    if(p) {
      votesCount[p] ? 
          votesCount[p] ++ : 
          votesCount[p] = 1; 
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
  
  return win;
}
function cleanMoves(players) {
    for(const p of players) {
      p.vote.move = null;
    }
}
function cleanPromotions(players) {
  for(const p of players) {
    p.vote.promotion = null;
  }
}
async function gameState(room) {
  const { chess, timer } = games[room] || {};
  if(!chess || !timer) {
    return {};
  }

  const sockets = await GameNS.in(room).fetchSockets();
  const size = sockets.length;
  const players = [];
  const turn = chess.turn();
  for(const s of sockets) {
    if(s.data?.side) {
      players.push(s.data);
    }
  }



  const currentPlayers = players.filter(p => p.side === turn);
  const prevPlayers = players.filter(p => p.side !== turn);

  const move = calcMove(currentPlayers);
  cleanMoves(prevPlayers);
  const selectedPromotion = calcSelectedPromotion(currentPlayers);
  cleanPromotions(prevPlayers);

  let promotion = false;
  
  if(move) {
    promotion = !selectedPromotion && isPromotionMove(move, chess);
    chess.move({ ...move, promotion: selectedPromotion });

  }

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
    size,
    players,
    promotion,
    png: chess.pgn(),
    ascii: chess.ascii()
  };
}

async function emitState(room) {
  const state = await gameState(room);
  GameNS.to(room).emit('state', state);
}

function disconnect(socket) {
  return () => {
    io.emit('rooms', getRooms());
  }
}

async function getRoomInfo(room) {
  const sockets = await GameNS.in(room).fetchSockets();
  return sockets.map(s => s.data);
}


function getRooms() {
  const rooms = Array.from(GameNS.adapter.rooms.keys());
  const sids = Array.from(GameNS.sockets.keys());
  const roomsNames =  _.difference(rooms, sids);
  return roomsNames;
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

function createTimer(room) {
  const timer = new Timer({ 
    countdown: true, 
    startValues: { minutes: clock } 
  });
 
  timer.on('secondsUpdated', () => {
    const time = timer.getTimeValues().toString(['minutes', 'seconds']);
    console.log('emit ' + time + ' to ' + room);
    GameNS.to(room).emit('timer', time);
  });

  timer.addEventListener('targetAchieved', function (e) {
      GameNS.to(room).emit('timeout');
  });
  return timer;
}

GameNS.adapter.on("create-room", room => {
  if(getRooms().includes(room)) {
    const chess = new Chess();
    const timer = createTimer(room);
    timer.start();
    games[room] = { chess, timer };
    io.emit('rooms', getRooms());
  }
});

GameNS.adapter.on("delete-room", room => {
  if(!games[room]) {
    return;
  }
  const { timer } = games[room];
  timer.stop();
  timer.removeAllEventListeners('secondsUpdated');
  delete games[room];
  io.emit('rooms', getRooms());
});

GameNS.adapter.on("join-room", (room, id) => {
  emitState(room);
});

GameNS.adapter.on("leave-room", (room, id) => {
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

app.get('/rooms/info/:room?', async (req, res) => {
  const { room: name } = req.params;
  const rooms = name ? [ name ] : getRooms();
  const result = [];
  for(const room of rooms) {
    const info = await getRoomInfo(room);
    result.push({ room, info })
  }
  return res.json(result);
});

server.listen(PORT, () => {
  console.log('listening on ' + PORT);
});