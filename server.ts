import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { QUESTIONS } from './src/questions';

// --- Types ---
type TeamStatus = 'in gara' | 'eliminata' | 'qualificata' | 'in semifinale' | 'in finale' | 'vincitrice';

interface Question {
  text: string;
  options?: string[];
  correctAnswer?: number;
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
  teams: Team[];
  selectedAnswers: Record<string, number>;
  buzzes: { teamId: string; timestamp: number }[];
  timer: number;
  timerActive: boolean;
  semisMatches: {
    match1: { teamAId: string; teamBId: string; scoreA: number; scoreB: number; winnerId?: string };
    match2: { teamAId: string; teamBId: string; scoreA: number; scoreB: number; winnerId?: string };
  } | null;
  finalMatch: { teamAId: string; teamBId: string; scoreA: number; scoreB: number; winnerId?: string } | null;
}

// --- Initial State ---
let gameState: GameState = {
  phase: 'LOBBY',
  currentQuestionIndex: 0,
  isQuestionActive: false,
  teams: [],
  selectedAnswers: {},
  usedQuestionIds: [],
  buzzes: [],
  timer: 60,
  timerActive: false,
  semisMatches: null,
  finalMatch: null,
};

let timerInterval: NodeJS.Timeout | null = null;

function updateCurrentQuestion(difficulty?: string) {
  const phaseQuestions = QUESTIONS[gameState.phase];
  if (phaseQuestions) {
    let available = phaseQuestions.filter(q => !gameState.usedQuestionIds.includes(q.id));
    
    if (difficulty) {
      const difficultyAvailable = available.filter(q => q.difficulty === difficulty);
      if (difficultyAvailable.length > 0) {
        available = difficultyAvailable;
      }
    }

    if (available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const selectedQuestion = available[randomIndex];
      gameState.currentQuestion = selectedQuestion;
      gameState.usedQuestionIds.push(selectedQuestion.id);
    } else {
      // If no unused questions left in this phase, reset used for this phase or just pick first
      gameState.currentQuestion = phaseQuestions[0];
    }
  } else {
    gameState.currentQuestion = undefined;
  }
}

function calculateScores() {
  if (!gameState.currentQuestion || gameState.currentQuestion.correctAnswer === undefined) return;
  
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
}

// --- Server Setup ---
async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // --- WebSocket Logic ---
  const clients = new Set<WebSocket>();

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    gameState.timer = 60;
    gameState.timerActive = true;
    timerInterval = setInterval(() => {
      if (gameState.timer > 0) {
        gameState.timer--;
        broadcast({ type: 'STATE_UPDATE', state: gameState });
      } else {
        stopTimer();
        gameState.isQuestionActive = false;
        calculateScores();
        broadcast({ type: 'STATE_UPDATE', state: gameState });
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    gameState.timerActive = false;
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected. Total clients:', clients.size);
    
    // Send current state on connection
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: gameState }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data.type, data.action || '');
        handleClientMessage(ws, data);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected. Total clients:', clients.size);
    });
  });

  function handleClientMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case 'JOIN_TEAM':
        const newTeam: Team = {
          id: uuidv4(),
          name: data.name,
          score: 0,
          status: 'in gara',
        };
        gameState.teams.push(newTeam);
        ws.send(JSON.stringify({ type: 'JOIN_SUCCESS', team: newTeam }));
        broadcast({ type: 'STATE_UPDATE', state: gameState });
        break;

      case 'BUZZ':
        if (gameState.isQuestionActive && (gameState.phase === 'SEMIS' || gameState.phase === 'FINAL')) {
          const alreadyBuzzed = gameState.buzzes.find(b => b.teamId === data.teamId);
          if (!alreadyBuzzed) {
            gameState.buzzes.push({ teamId: data.teamId, timestamp: Date.now() });
            broadcast({ type: 'STATE_UPDATE', state: gameState });
          }
        }
        break;

      case 'LEAVE_TEAM':
        gameState.teams = gameState.teams.filter(t => t.id !== data.teamId);
        broadcast({ type: 'STATE_UPDATE', state: gameState });
        break;

      case 'SUBMIT_ANSWER':
        if (gameState.isQuestionActive && gameState.phase.startsWith('QUAL_')) {
          gameState.selectedAnswers[data.teamId] = data.answerIndex;
          broadcast({ type: 'STATE_UPDATE', state: gameState });
        }
        break;

      case 'ADMIN_ACTION':
        handleAdminAction(data.action, data.payload);
        broadcast({ type: 'STATE_UPDATE', state: gameState });
        break;
    }
  }

  function handleAdminAction(action: string, payload: any) {
    console.log('Executing admin action:', action);
    switch (action) {
      case 'START_GAME':
        gameState.phase = 'QUAL_1';
        gameState.currentQuestionIndex = 1;
        gameState.isQuestionActive = true;
        gameState.selectedAnswers = {};
        updateCurrentQuestion(payload.difficulty);
        startTimer();
        break;
      case 'NEXT_QUESTION':
        stopTimer();
        calculateScores();
        if (gameState.currentQuestionIndex < 10) {
          gameState.currentQuestionIndex++;
          gameState.isQuestionActive = true;
          gameState.buzzes = [];
          gameState.selectedAnswers = {};
          updateCurrentQuestion(payload.difficulty);
          startTimer();
        } else {
          if (gameState.phase === 'QUAL_1') gameState.phase = 'QUAL_2';
          else if (gameState.phase === 'QUAL_2') gameState.phase = 'QUAL_3';
          else if (gameState.phase === 'QUAL_3') {
            gameState.phase = 'QUAL_RESULTS';
            calculateQualifiers();
          }
          gameState.currentQuestionIndex = 1;
          gameState.isQuestionActive = true;
          gameState.buzzes = [];
          gameState.selectedAnswers = {};
          updateCurrentQuestion(payload.difficulty);
          startTimer();
        }
        break;
      case 'TOGGLE_QUESTION':
        if (gameState.isQuestionActive) {
          calculateScores();
          stopTimer();
        } else {
          startTimer();
        }
        gameState.isQuestionActive = !gameState.isQuestionActive;
        break;
      case 'UPDATE_SCORE':
        const team = gameState.teams.find(t => t.id === payload.teamId);
        if (team) {
          team.score += payload.amount;
          if (gameState.phase === 'SEMIS' && gameState.semisMatches) {
            updateMatchScore(payload.teamId, payload.amount);
          } else if (gameState.phase === 'FINAL' && gameState.finalMatch) {
            updateFinalScore(payload.teamId, payload.amount);
          }
        }
        break;
      case 'START_SEMIS':
        gameState.phase = 'SEMIS';
        gameState.currentQuestionIndex = 1;
        gameState.isQuestionActive = true;
        gameState.buzzes = [];
        updateCurrentQuestion();
        startTimer();
        break;
      case 'START_FINAL':
        gameState.phase = 'FINAL';
        gameState.currentQuestionIndex = 1;
        gameState.isQuestionActive = true;
        gameState.buzzes = [];
        updateCurrentQuestion();
        startTimer();
        break;
      case 'RESET_GAME':
        stopTimer();
        gameState.phase = 'LOBBY';
        gameState.currentQuestionIndex = 0;
        gameState.isQuestionActive = false;
        gameState.teams = [];
        gameState.selectedAnswers = {};
        gameState.usedQuestionIds = [];
        gameState.buzzes = [];
        gameState.semisMatches = null;
        gameState.finalMatch = null;
        gameState.currentQuestion = undefined;
        gameState.timer = 60;
        gameState.timerActive = false;
        break;
      case 'DELETE_TEAM':
        gameState.teams = gameState.teams.filter(t => t.id !== payload.teamId);
        break;
    }
  }

  function calculateQualifiers() {
    const sorted = [...gameState.teams].sort((a, b) => b.score - a.score);
    sorted.forEach((team, index) => {
      if (index < 4) {
        team.status = 'qualificata';
      } else {
        team.status = 'eliminata';
      }
    });

    // Setup Semis: 1 vs 3, 2 vs 4
    const qualifiers = sorted.slice(0, 4);
    if (qualifiers.length >= 4) {
      gameState.semisMatches = {
        match1: { teamAId: qualifiers[0].id, teamBId: qualifiers[2].id, scoreA: 0, scoreB: 0 },
        match2: { teamAId: qualifiers[1].id, teamBId: qualifiers[3].id, scoreA: 0, scoreB: 0 },
      };
      qualifiers.forEach(t => t.status = 'in semifinale');
    }
  }

  function updateMatchScore(teamId: string, amount: number) {
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
        checkFinalReady();
      }
      if (match.scoreB >= 10 && !match.winnerId) {
        match.winnerId = match.teamBId;
        const winner = gameState.teams.find(t => t.id === match.teamBId);
        const loser = gameState.teams.find(t => t.id === match.teamAId);
        if (winner) winner.status = 'in finale';
        if (loser) loser.status = 'eliminata';
        checkFinalReady();
      }
    });
  }

  function checkFinalReady() {
    if (gameState.semisMatches?.match1.winnerId && gameState.semisMatches?.match2.winnerId) {
      gameState.finalMatch = {
        teamAId: gameState.semisMatches.match1.winnerId,
        teamBId: gameState.semisMatches.match2.winnerId,
        scoreA: 0,
        scoreB: 0
      };
    }
  }

  function updateFinalScore(teamId: string, amount: number) {
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
