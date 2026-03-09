import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(process.cwd(), 'game_data.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `leaderboard-music${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// --- Types ---
type TeamStatus = 'in gara' | 'eliminata' | 'qualificata' | 'in semifinale' | 'in finale' | 'vincitrice';

interface Question {
  id: string;
  text: string;
  options?: string[];
  correctAnswer?: number;
  difficulty?: 'facile' | 'media' | 'difficile';
  source?: string;
}

interface Team {
  id: string;
  name: string;
  score: number;
  status: TeamStatus;
}

interface GameState {
  phase: 'LOBBY' | 'QUAL_1' | 'QUAL_2' | 'QUAL_3' | 'QUAL_RESULTS' | 'SEMIS' | 'FINAL' | 'FINISHED';
  currentQuestionIndex: number;
  currentQuestion?: Question;
  usedQuestionIds: string[];
  isQuestionActive: boolean;
  isQuestionFinished: boolean;
  teams: Team[];
  selectedAnswers: Record<string, number>;
  allTeamsAnswered: boolean;
  buzzes: { teamId: string; timestamp: number }[];
  timer: number;
  timerActive: boolean;
  timerEndTime?: number;
  countdown: number;
  countdownActive: boolean;
  countdownEndTime?: number;
  countdownType?: 'NEXT_QUESTION' | 'QUESTION_ENDING' | 'GAME_START';
  roundWinner?: string;
  showRoundWinner: boolean;
  round: number;
  nextQuestionId?: string;
  questionQueue: string[];
  uploadedFiles: string[];
  allQuestions: Record<string, Question[]>;
  leaderboardMusicUrl?: string;
  semisMatches: {
    match1: { teamAId: string; teamBId: string; scoreA: number; scoreB: number; winnerId?: string };
    match2: { teamAId: string; teamBId: string; scoreA: number; scoreB: number; winnerId?: string };
  } | null;
  finalMatch: { teamAId: string; teamBId: string; scoreA: number; scoreB: number; winnerId?: string } | null;
}

interface Room {
  id: string;
  state: GameState;
  timerInterval?: NodeJS.Timeout;
  countdownInterval?: NodeJS.Timeout;
  timerEndTime?: number;
  countdownEndTime?: number;
}

const rooms = new Map<string, Room>();

function createInitialState(): GameState {
  return {
    phase: 'LOBBY',
    currentQuestionIndex: 0,
    isQuestionActive: false,
    isQuestionFinished: false,
    teams: [],
    selectedAnswers: {},
    allTeamsAnswered: false,
    usedQuestionIds: [],
    buzzes: [],
    timer: 60,
    timerActive: false,
    countdown: 0,
    countdownActive: false,
    showRoundWinner: false,
    round: 1,
    questionQueue: [],
    uploadedFiles: [],
    allQuestions: {
      QUAL_1: [],
      QUAL_2: [],
      QUAL_3: [],
      SEMIS: [],
      FINAL: [],
    },
    leaderboardMusicUrl: '',
    semisMatches: null,
    finalMatch: null,
  };
}

function getRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      state: createInitialState(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

// --- Persistence ---
function saveState(roomId: string) {
  try {
    const room = getRoom(roomId);
    const data = JSON.stringify(room.state, null, 2);
    // For now, we only persist the default room to avoid cluttering disk
    if (roomId === '2001') {
      fs.writeFileSync(DATA_FILE, data);
    }
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      const room = getRoom('2001');
      room.state = { ...room.state, ...loaded };
      console.log('Default room state loaded from disk');
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

loadState();

let timerInterval: NodeJS.Timeout | null = null;
let countdownInterval: NodeJS.Timeout | null = null;

function updateCurrentQuestion(roomId: string, manualId?: string) {
  const room = getRoom(roomId);
  const gameState = room.state;
  const phaseQuestions = gameState.allQuestions[gameState.phase as keyof typeof gameState.allQuestions];
  if (phaseQuestions) {
    // 1. Check manual ID
    if (manualId) {
      const manual = phaseQuestions.find(q => q.id === manualId);
      if (manual) {
        gameState.currentQuestion = manual;
        if (!gameState.usedQuestionIds.includes(manual.id)) {
          gameState.usedQuestionIds.push(manual.id);
        }
        return;
      }
    }

    // 2. Check Queue
    if (gameState.questionQueue.length > 0) {
      const nextId = gameState.questionQueue.shift();
      const allQuestionsFlat = Object.values(gameState.allQuestions).flat();
      const queued = allQuestionsFlat.find(q => q.id === nextId);
      if (queued) {
        gameState.currentQuestion = queued;
        if (!gameState.usedQuestionIds.includes(queued.id)) {
          gameState.usedQuestionIds.push(queued.id);
        }
        return;
      }
    }

    // 3. Random
    let available = phaseQuestions.filter(q => !gameState.usedQuestionIds.includes(q.id));
    
    if (available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const selectedQuestion = available[randomIndex];
      gameState.currentQuestion = selectedQuestion;
      gameState.usedQuestionIds.push(selectedQuestion.id);
    } else {
      gameState.currentQuestion = phaseQuestions[0];
    }
  } else {
    gameState.currentQuestion = undefined;
  }
}

function calculateScores(roomId: string) {
  const room = getRoom(roomId);
  const gameState = room.state;
  if (!gameState.currentQuestion || gameState.currentQuestion.correctAnswer === undefined || gameState.isQuestionFinished) return;
  
  const correctIdx = gameState.currentQuestion.correctAnswer;
  
  gameState.teams.forEach(team => {
    const selectedIdx = gameState.selectedAnswers[team.id];
    if (selectedIdx !== undefined) {
      if (selectedIdx === correctIdx) {
        team.score += 10;
      } else {
        team.score = Math.max(0, team.score - 5);
      }
    }
  });

  gameState.isQuestionFinished = true;
}

// --- Server Setup ---
async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  
  app.use('/uploads', express.static(UPLOADS_DIR));

  // --- API Routes ---
  const apiRouter = express.Router();

  apiRouter.post('/upload-music', (req: any, res, next) => {
    console.log('Received music upload request');
    next();
  }, upload.single('music'), (req: any, res) => {
    if (!req.file) {
      console.error('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File uploaded successfully:', req.file.filename);
    const musicUrl = `/uploads/${req.file.filename}?t=${Date.now()}`;
    
    // For now, we update the default room if no roomId is provided in body
    const roomId = req.body.roomId || '2001';
    const room = getRoom(roomId);
    room.state.leaderboardMusicUrl = musicUrl;
    saveState(roomId);
    
    // Broadcast the update to all clients in that room
    broadcast(roomId, { type: 'STATE_UPDATE', state: room.state });
    
    res.json({ url: musicUrl });
  });

  // API Error Handler
  apiRouter.use((err: any, req: any, res: any, next: any) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({ 
      error: err.message || 'Internal Server Error',
      details: err.code || undefined
    });
  });

  // API 404 Handler
  apiRouter.use((req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  app.use('/api', apiRouter);
  const clients = new Map<WebSocket, string>(); // ws -> roomId

  function broadcast(roomId: string, data: any) {
    const message = JSON.stringify(data);
    clients.forEach((clientRoomId, client) => {
      if (clientRoomId === roomId && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    // Save state on every broadcast that might change it
    if (data.type === 'STATE_UPDATE') {
      saveState(roomId);
    }
  }

  function startTimer(roomId: string) {
    const room = getRoom(roomId);
    if (room.timerInterval) clearInterval(room.timerInterval);
    const duration = 60;
    room.state.timer = duration;
    room.state.timerActive = true;
    room.state.timerEndTime = Date.now() + duration * 1000;
    room.timerEndTime = room.state.timerEndTime;
    
    broadcast(roomId, { type: 'STATE_UPDATE', state: room.state });

    room.timerInterval = setInterval(() => {
      if (!room.timerEndTime) return;
      
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((room.timerEndTime - now) / 1000));
      
      if (remaining !== room.state.timer) {
        room.state.timer = remaining;
        if (room.state.timer <= 0) {
          stopTimer(roomId);
          room.state.isQuestionActive = false;
          calculateScores(roomId);
          
          // Se è l'ultima domanda del round, mostra il vincitore automaticamente
          if (room.state.currentQuestionIndex === 10 && room.state.phase.startsWith('QUAL_')) {
            const winner = [...room.state.teams].sort((a, b) => b.score - a.score)[0];
            room.state.roundWinner = winner?.name || 'Nessuna';
            room.state.showRoundWinner = true;
            room.state.timerActive = false;
          }
        }
        broadcast(roomId, { type: 'STATE_UPDATE', state: room.state });
      }
    }, 100); // Check more frequently but only broadcast on change
  }

  function stopTimer(roomId: string) {
    const room = getRoom(roomId);
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = undefined;
    }
    room.timerEndTime = undefined;
    room.state.timerEndTime = undefined;
    room.state.timerActive = false;
    broadcast(roomId, { type: 'STATE_UPDATE', state: room.state });
  }

  function startCountdown(roomId: string, type: 'NEXT_QUESTION' | 'QUESTION_ENDING' | 'GAME_START' = 'NEXT_QUESTION', duration: number = 3) {
    const room = getRoom(roomId);
    if (room.countdownInterval) clearInterval(room.countdownInterval);
    room.state.countdown = duration;
    room.state.countdownActive = true;
    room.state.countdownType = type;
    room.state.countdownEndTime = Date.now() + duration * 1000;
    room.countdownEndTime = room.state.countdownEndTime;
    
    broadcast(roomId, { type: 'STATE_UPDATE', state: room.state });

    room.countdownInterval = setInterval(() => {
      if (!room.countdownEndTime) return;
      
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((room.countdownEndTime - now) / 1000));
      
      if (remaining !== room.state.countdown) {
        room.state.countdown = remaining;
        if (room.state.countdown <= 0) {
          stopCountdown(roomId);
        }
        broadcast(roomId, { type: 'STATE_UPDATE', state: room.state });
      }
    }, 100);
  }

  function stopCountdown(roomId: string) {
    const room = getRoom(roomId);
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = undefined;
    }
    const type = room.state.countdownType;
    room.countdownEndTime = undefined;
    room.state.countdownEndTime = undefined;
    room.state.countdownActive = false;
    room.state.countdown = 0;
    room.state.countdownType = undefined;

    // Automatically start the question when countdown ends, but only if it's NEXT_QUESTION or GAME_START
    if (type === 'NEXT_QUESTION' || type === 'GAME_START') {
      const phasesWithQuestions = ['QUAL_1', 'QUAL_2', 'QUAL_3', 'SEMIS', 'FINAL'];
      if (phasesWithQuestions.includes(room.state.phase)) {
        room.state.isQuestionFinished = false;
        room.state.isQuestionActive = true;
        startTimer(roomId);
      }
    } else if (type === 'QUESTION_ENDING') {
      // Just stop the question and calculate scores
      stopTimer(roomId);
      calculateScores(roomId);
      room.state.allTeamsAnswered = false;
    }
    
    broadcast(roomId, { type: 'STATE_UPDATE', state: room.state });
  }

  wss.on('connection', (ws) => {
    console.log('New client connected');
    
    // Send initial state for default room immediately to avoid deadlock
    const defaultRoomId = '2001';
    const defaultRoom = getRoom(defaultRoomId);
    clients.set(ws, defaultRoomId);
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: defaultRoom.state }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        const roomId = data.roomId || clients.get(ws) || '2001';
        
        // Update room ID if provided
        if (data.roomId && clients.get(ws) !== data.roomId) {
          clients.set(ws, data.roomId);
          const room = getRoom(data.roomId);
          ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: room.state }));
        }

        handleClientMessage(ws, roomId, data);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  function handleClientMessage(ws: WebSocket, roomId: string, data: any) {
    const room = getRoom(roomId);
    const gameState = room.state;

    switch (data.type) {
      case 'JOIN_TEAM':
        const existingTeam = gameState.teams.find(t => t.name.toLowerCase() === data.name.toLowerCase());
        if (existingTeam) {
          ws.send(JSON.stringify({ type: 'JOIN_SUCCESS', team: existingTeam }));
        } else {
          const newTeam: Team = {
            id: uuidv4(),
            name: data.name,
            score: 0,
            status: 'in gara',
          };
          gameState.teams.push(newTeam);
          ws.send(JSON.stringify({ type: 'JOIN_SUCCESS', team: newTeam }));
          broadcast(roomId, { type: 'STATE_UPDATE', state: gameState });
        }
        break;

      case 'BUZZ':
        if (gameState.isQuestionActive && (gameState.phase === 'SEMIS' || gameState.phase === 'FINAL')) {
          const alreadyBuzzed = gameState.buzzes.find(b => b.teamId === data.teamId);
          if (!alreadyBuzzed) {
            gameState.buzzes.push({ teamId: data.teamId, timestamp: Date.now() });
            broadcast(roomId, { type: 'STATE_UPDATE', state: gameState });
          }
        }
        break;

      case 'LEAVE_TEAM':
        gameState.teams = gameState.teams.filter(t => t.id !== data.teamId);
        broadcast(roomId, { type: 'STATE_UPDATE', state: gameState });
        break;

      case 'SUBMIT_ANSWER':
        if (gameState.isQuestionActive && gameState.phase.startsWith('QUAL_')) {
          gameState.selectedAnswers[data.teamId] = data.answerIndex;
          
          // Check if all active teams have answered
          const activeTeams = gameState.teams.filter(t => t.status !== 'eliminata');
          const answeredCount = Object.keys(gameState.selectedAnswers).length;
          
          if (answeredCount >= activeTeams.length && activeTeams.length > 0) {
            gameState.allTeamsAnswered = true;
            // Start a countdown that indicates the question is ending
            setTimeout(() => {
              startCountdown(roomId, 'QUESTION_ENDING', 5);
            }, 2000);
          }
          
          broadcast(roomId, { type: 'STATE_UPDATE', state: gameState });
        }
        break;

      case 'PREVIOUS_QUESTION':
        if (gameState.currentQuestionIndex > 1) {
          gameState.currentQuestionIndex--;
          gameState.isQuestionActive = false;
          gameState.isQuestionFinished = false;
          gameState.buzzes = [];
          gameState.selectedAnswers = {};
          updateCurrentQuestion(roomId);
          broadcast(roomId, { type: 'STATE_UPDATE', state: gameState });
        }
        break;

      case 'SET_ROUND':
        gameState.round = data.round;
        broadcast(roomId, { type: 'STATE_UPDATE', state: gameState });
        break;

      case 'ADMIN_ACTION':
        if (data.action === 'START_COUNTDOWN') {
          startCountdown(roomId, 'NEXT_QUESTION');
        } else if (data.action === 'SET_NEXT_QUESTION') {
          gameState.nextQuestionId = data.payload.questionId;
        } else if (data.action === 'ADD_TO_QUEUE') {
          if (!gameState.questionQueue.includes(data.payload.questionId)) {
            gameState.questionQueue.push(data.payload.questionId);
          }
        } else if (data.action === 'REMOVE_FROM_QUEUE') {
          gameState.questionQueue = gameState.questionQueue.filter(id => id !== data.payload.questionId);
        } else if (data.action === 'REORDER_QUEUE') {
          gameState.questionQueue = data.payload.queue;
        } else if (data.action === 'DELETE_FILE') {
          const fileName = data.payload.fileName;
          gameState.uploadedFiles = gameState.uploadedFiles.filter(f => f !== fileName);
          Object.keys(gameState.allQuestions).forEach(phase => {
            gameState.allQuestions[phase] = gameState.allQuestions[phase].filter(q => q.source !== fileName);
          });
          gameState.questionQueue = gameState.questionQueue.filter(id => {
            const allQs = Object.values(gameState.allQuestions).flat();
            return allQs.some(q => q.id === id);
          });
        } else if (data.action === 'CLEAR_ALL_QUESTIONS') {
          gameState.uploadedFiles = [];
          gameState.questionQueue = [];
          Object.keys(gameState.allQuestions).forEach(phase => {
            gameState.allQuestions[phase] = [];
          });
          gameState.usedQuestionIds = [];
          gameState.currentQuestion = undefined;
        } else if (data.action === 'ADD_QUESTIONS') {
          const { phase, questions, fileName } = data.payload;
          if (fileName && !gameState.uploadedFiles.includes(fileName)) {
            gameState.uploadedFiles.push(fileName);
          }
          if (!gameState.allQuestions[phase]) gameState.allQuestions[phase] = [];
          const questionsWithSource = questions.map((q: any) => ({ ...q, source: fileName || 'default' }));
          gameState.allQuestions[phase].push(...questionsWithSource);
          broadcast(roomId, { type: 'STATE_UPDATE', state: gameState });
        } else if (data.action === 'SET_LEADERBOARD_MUSIC') {
          gameState.leaderboardMusicUrl = data.payload.url;
        } else if (data.action === 'DELETE_LEADERBOARD_MUSIC') {
          if (gameState.leaderboardMusicUrl && gameState.leaderboardMusicUrl.includes('/uploads/')) {
            const fileName = gameState.leaderboardMusicUrl.split('/').pop()?.split('?')[0];
            if (fileName) {
              const filePath = path.join(UPLOADS_DIR, fileName);
              if (fs.existsSync(filePath)) {
                try {
                  fs.unlinkSync(filePath);
                } catch (err) {
                  console.error('Error deleting music file:', err);
                }
              }
            }
          }
          gameState.leaderboardMusicUrl = undefined;
        } else {
          handleAdminAction(roomId, data.action, data.payload);
        }
        broadcast(roomId, { type: 'STATE_UPDATE', state: gameState });
        break;
    }
  }

  function handleAdminAction(roomId: string, action: string, payload: any) {
    const room = getRoom(roomId);
    const gameState = room.state;
    console.log(`Executing admin action in room ${roomId}:`, action);
    
    switch (action) {
      case 'START_GAME':
        gameState.phase = 'QUAL_1';
        gameState.currentQuestionIndex = 1;
        gameState.isQuestionActive = false;
        gameState.isQuestionFinished = false;
        gameState.selectedAnswers = {};
        gameState.allTeamsAnswered = false;
        gameState.round = 1;
        gameState.showRoundWinner = false;
        updateCurrentQuestion(roomId, gameState.nextQuestionId);
        gameState.nextQuestionId = undefined;
        stopTimer(roomId);
        startCountdown(roomId, 'GAME_START');
        break;
      case 'NEXT_QUESTION':
        stopTimer(roomId);
        calculateScores(roomId);
        
        if (gameState.currentQuestionIndex < 10) {
          gameState.currentQuestionIndex++;
          gameState.isQuestionActive = false;
          gameState.isQuestionFinished = false;
          gameState.buzzes = [];
          gameState.selectedAnswers = {};
          gameState.allTeamsAnswered = false;
          updateCurrentQuestion(roomId, gameState.nextQuestionId);
          gameState.nextQuestionId = undefined;
          startCountdown(roomId, 'NEXT_QUESTION');
        } else {
          const winner = [...gameState.teams].sort((a, b) => b.score - a.score)[0];
          gameState.roundWinner = winner?.name || 'Nessuna';
          gameState.showRoundWinner = true;
          gameState.isQuestionActive = false;
          gameState.timerActive = false;
        }
        break;
      case 'START_NEXT_ROUND':
        gameState.showRoundWinner = false;
        if (gameState.phase === 'QUAL_1') gameState.phase = 'QUAL_2';
        else if (gameState.phase === 'QUAL_2') gameState.phase = 'QUAL_3';
        else if (gameState.phase === 'QUAL_3') {
          gameState.phase = 'QUAL_RESULTS';
          calculateQualifiers(roomId);
          break;
        }
        gameState.round++;
        gameState.currentQuestionIndex = 1;
        gameState.isQuestionActive = false;
        gameState.isQuestionFinished = false;
        gameState.buzzes = [];
        gameState.selectedAnswers = {};
        gameState.allTeamsAnswered = false;
        updateCurrentQuestion(roomId, gameState.nextQuestionId);
        gameState.nextQuestionId = undefined;
        stopTimer(roomId);
        startCountdown(roomId, 'NEXT_QUESTION');
        break;
      case 'TOGGLE_QUESTION':
        if (gameState.isQuestionActive) {
          calculateScores(roomId);
          stopTimer(roomId);
          gameState.isQuestionActive = false;
        } else {
          gameState.isQuestionFinished = false;
          gameState.isQuestionActive = true;
          startTimer(roomId);
        }
        break;
      case 'UPDATE_SCORE':
        const team = gameState.teams.find(t => t.id === payload.teamId);
        if (team) {
          team.score += payload.amount;
          if (gameState.phase === 'SEMIS' && gameState.semisMatches) {
            updateMatchScore(roomId, payload.teamId, payload.amount);
          } else if (gameState.phase === 'FINAL' && gameState.finalMatch) {
            updateFinalScore(roomId, payload.teamId, payload.amount);
          }
        }
        break;
      case 'START_SEMIS':
        gameState.phase = 'SEMIS';
        gameState.currentQuestionIndex = 1;
        gameState.isQuestionActive = false;
        gameState.buzzes = [];
        gameState.allTeamsAnswered = false;
        updateCurrentQuestion(roomId, gameState.nextQuestionId);
        gameState.nextQuestionId = undefined;
        stopTimer(roomId);
        startCountdown(roomId, 'NEXT_QUESTION');
        break;
      case 'START_FINAL':
        gameState.phase = 'FINAL';
        gameState.currentQuestionIndex = 1;
        gameState.isQuestionActive = false;
        gameState.buzzes = [];
        gameState.allTeamsAnswered = false;
        updateCurrentQuestion(roomId, gameState.nextQuestionId);
        gameState.nextQuestionId = undefined;
        stopTimer(roomId);
        startCountdown(roomId, 'NEXT_QUESTION');
        break;
      case 'RESET_GAME':
        stopTimer(roomId);
        stopCountdown(roomId);
        room.state = createInitialState();
        break;
      case 'DELETE_TEAM':
        gameState.teams = gameState.teams.filter(t => t.id !== payload.teamId);
        break;
    }
  }

  function calculateQualifiers(roomId: string) {
    const room = getRoom(roomId);
    const gameState = room.state;
    const sorted = [...gameState.teams].sort((a, b) => b.score - a.score);
    sorted.forEach((team, index) => {
      if (index < 4) {
        team.status = 'qualificata';
      } else {
        team.status = 'eliminata';
      }
    });

    const qualifiers = sorted.slice(0, 4);
    if (qualifiers.length >= 4) {
      gameState.semisMatches = {
        match1: { teamAId: qualifiers[0].id, teamBId: qualifiers[2].id, scoreA: 0, scoreB: 0 },
        match2: { teamAId: qualifiers[1].id, teamBId: qualifiers[3].id, scoreA: 0, scoreB: 0 },
      };
      qualifiers.forEach(t => t.status = 'in semifinale');
    }
  }

  function updateMatchScore(roomId: string, teamId: string, amount: number) {
    const room = getRoom(roomId);
    const gameState = room.state;
    if (!gameState.semisMatches) return;
    const { match1, match2 } = gameState.semisMatches;
    
    [match1, match2].forEach(match => {
      if (match.teamAId === teamId) match.scoreA += amount;
      if (match.teamBId === teamId) match.scoreB += amount;

      if (match.scoreA >= 10 && !match.winnerId) {
        match.winnerId = match.teamAId;
        const winner = gameState.teams.find(t => t.id === match.teamAId);
        const loser = gameState.teams.find(t => t.id === match.teamBId);
        if (winner) winner.status = 'in finale';
        if (loser) loser.status = 'eliminata';
        checkFinalReady(roomId);
      }
      if (match.scoreB >= 10 && !match.winnerId) {
        match.winnerId = match.teamBId;
        const winner = gameState.teams.find(t => t.id === match.teamBId);
        const loser = gameState.teams.find(t => t.id === match.teamAId);
        if (winner) winner.status = 'in finale';
        if (loser) loser.status = 'eliminata';
        checkFinalReady(roomId);
      }
    });
  }

  function checkFinalReady(roomId: string) {
    const room = getRoom(roomId);
    const gameState = room.state;
    if (gameState.semisMatches?.match1.winnerId && gameState.semisMatches?.match2.winnerId) {
      gameState.finalMatch = {
        teamAId: gameState.semisMatches.match1.winnerId,
        teamBId: gameState.semisMatches.match2.winnerId,
        scoreA: 0,
        scoreB: 0
      };
    }
  }

  function updateFinalScore(roomId: string, teamId: string, amount: number) {
    const room = getRoom(roomId);
    const gameState = room.state;
    if (!gameState.finalMatch) return;
    const match = gameState.finalMatch;
    if (match.teamAId === teamId) match.scoreA += amount;
    if (match.teamBId === teamId) match.scoreB += amount;

    if (match.scoreA >= 10 && !match.winnerId) {
      match.winnerId = match.teamAId;
      gameState.teams.find(t => t.id === match.teamAId)!.status = 'vincitrice';
      gameState.teams.find(t => t.id === match.teamBId)!.status = 'eliminata';
      gameState.phase = 'FINISHED';
    }
    if (match.scoreB >= 10 && !match.winnerId) {
      match.winnerId = match.teamBId;
      gameState.teams.find(t => t.id === match.teamBId)!.status = 'vincitrice';
      gameState.teams.find(t => t.id === match.teamAId)!.status = 'eliminata';
      gameState.phase = 'FINISHED';
    }
  }

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
