import { Peer, DataConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { GameState, Team, Question } from '../types';
import { PRELOADED_QUESTIONS } from '../data/questions';

type MessageCallback = (data: any) => void;

class PeerService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private callbacks: Set<MessageCallback> = new Set();
  private isHost: boolean = false;
  private hostId: string | null = null;
  private gameState: GameState | null = null;
  private timerInterval: any = null;
  private countdownInterval: any = null;
  private messageQueue: any[] = [];

  private onIdCallbacks: Set<(id: string) => void> = new Set();

  constructor() {
    this.initializePeer();
  }

  private initializePeer() {
    const generate8DigitId = () => Math.floor(10000000 + Math.random() * 90000000).toString();
    const id = generate8DigitId();
    
    console.log('PeerJS: Initializing with ID:', id);
    
    this.peer = new Peer(id, {
      debug: 3,
      secure: window.location.protocol === 'https:',
      config: {
        'iceServers': [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
          { urls: 'stun:stun.stunprotocol.org' }
        ],
        'sdpSemantics': 'unified-plan',
        'iceCandidatePoolSize': 10
      }
    });
    
    this.peer.on('open', (id) => {
      console.log('PeerJS: Server connection established. My ID:', id);
      this.onIdCallbacks.forEach(cb => cb(id));
    });

    this.peer.on('connection', (conn) => {
      console.log('PeerJS: Incoming connection from:', conn.peer);
      if (this.isHost) {
        this.handleNewConnection(conn);
      } else {
        console.warn('PeerJS: Rejecting connection (not in host mode)');
        conn.close();
      }
    });

    this.peer.on('error', (err: any) => {
      console.error('PeerJS Global Error:', err.type, err);
      
      if (err.type === 'unavailable-id') {
        this.peer?.destroy();
        setTimeout(() => this.initializePeer(), 1000);
      } else if (err.type === 'peer-unavailable') {
        this.callbacks.forEach(cb => cb({ 
          type: 'CONNECTION_ERROR', 
          error: 'Stanza non trovata. Verifica l\'ID e assicurati che l\'Admin sia online.' 
        }));
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        this.callbacks.forEach(cb => cb({ 
          type: 'CONNECTION_ERROR', 
          error: 'Errore di rete o del server PeerJS. Riprova tra poco.' 
        }));
      }
    });

    this.peer.on('disconnected', () => {
      console.log('PeerJS: Disconnected from signaling server');
      this.peer?.reconnect();
    });
  }

  reset() {
    console.log('PeerJS: Resetting network service...');
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    this.peer?.destroy();
    this.initializePeer();
  }

  getPeerId(): string | undefined {
    return this.peer?.id;
  }

  // --- Host Logic ---
  startHost(initialState: GameState) {
    this.isHost = true;
    this.gameState = initialState;
    console.log('PeerJS: Started as Host');
  }

  private handleNewConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);
    
    conn.on('data', (data: any) => {
      console.log('PeerJS Host: Received data from', conn.peer, data);
      this.handleHostMessage(conn, data);
    });

    conn.on('open', () => {
      console.log('PeerJS Host: Connection opened with', conn.peer);
      // Always send current state immediately on open
      if (this.gameState) {
        console.log('PeerJS Host: Sending initial state to', conn.peer);
        // Strip library for new connections too
        const { allQuestions, ...strippedState } = this.gameState;
        
        // Also strip large music data from initial state, send it separately
        const musicUrl = strippedState.leaderboardMusicUrl;
        if (musicUrl && musicUrl.startsWith('data:')) {
          strippedState.leaderboardMusicUrl = 'DATA_URL_SYNCED';
        }
        
        conn.send({ type: 'STATE_UPDATE', state: strippedState });

        // If there's a large music URL, send it once separately
        if (musicUrl && musicUrl.startsWith('data:')) {
          conn.send({ type: 'MUSIC_UPDATE', url: musicUrl });
        }
      }
    });

    conn.on('close', () => {
      console.log('PeerJS Host: Connection closed by', conn.peer);
      this.connections.delete(conn.peer);
    });
  }

  private handleHostMessage(conn: DataConnection, data: any) {
    if (!this.gameState) return;

    switch (data.type) {
      case 'REQUEST_STATE':
        const { allQuestions, ...strippedState } = this.gameState;
        conn.send({ type: 'STATE_UPDATE', state: strippedState });
        break;
      case 'JOIN_TEAM':
        const existingTeam = this.gameState.teams.find(t => t.name.toLowerCase() === data.name.toLowerCase());
        if (existingTeam) {
          conn.send({ type: 'JOIN_SUCCESS', team: existingTeam });
        } else {
          const newTeam: Team = {
            id: uuidv4(),
            name: data.name,
            score: 0,
            status: 'in gara',
          };
          this.gameState.teams.push(newTeam);
          conn.send({ type: 'JOIN_SUCCESS', team: newTeam });
          this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        }
        break;

      case 'LEAVE_TEAM':
        this.gameState.teams = this.gameState.teams.filter(t => t.id !== data.teamId);
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        break;

      case 'BUZZ':
        if (this.gameState.isQuestionActive && (this.gameState.phase === 'SEMIS' || this.gameState.phase === 'FINAL')) {
          const alreadyBuzzed = this.gameState.buzzes.find(b => b.teamId === data.teamId);
          if (!alreadyBuzzed) {
            this.gameState.buzzes.push({ teamId: data.teamId, timestamp: Date.now() });
            this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
          }
        }
        break;

      case 'SUBMIT_ANSWER':
        if (this.gameState.isQuestionActive && this.gameState.phase.startsWith('QUAL_')) {
          if (this.gameState.selectedAnswers[data.teamId] === undefined) {
            this.gameState.selectedAnswers[data.teamId] = data.answerIndex;
            
            const activeTeams = this.gameState.teams.filter(t => t.status !== 'eliminata');
            const answeredCount = Object.keys(this.gameState.selectedAnswers).length;
            
            if (answeredCount >= activeTeams.length && activeTeams.length > 0) {
              this.gameState.allTeamsAnswered = true;
              setTimeout(() => {
                this.startCountdown('QUESTION_ENDING', 5);
              }, 2000);
            }
            
            this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
          }
        }
        break;

      case 'REORDER_QUEUE':
        this.gameState.questionQueue = [...data.payload.queue];
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        break;
        
      case 'SET_LEADERBOARD_MUSIC':
        this.gameState.leaderboardMusicUrl = data.payload.url;
        this.broadcast({ type: 'MUSIC_UPDATE', url: data.payload.url });
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        break;

      case 'DELETE_LEADERBOARD_MUSIC':
        this.gameState.leaderboardMusicUrl = '';
        this.broadcast({ type: 'MUSIC_UPDATE', url: '' });
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        break;

      case 'ADMIN_ACTION':
        this.handleAdminAction(data.action, data.payload);
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        break;
        
      case 'SET_ROUND':
        this.gameState.round = data.round;
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        break;
        
      case 'PREVIOUS_QUESTION':
        if (this.gameState.currentQuestionIndex > 1) {
          this.gameState.currentQuestionIndex--;
          this.gameState.isQuestionActive = false;
          this.gameState.isQuestionFinished = false;
          this.gameState.buzzes = [];
          this.gameState.selectedAnswers = {};
          this.updateCurrentQuestion();
          this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        }
        break;
    }
  }

  private handleAdminAction(action: string, payload: any) {
    if (!this.gameState) return;

    switch (action) {
      case 'START_GAME':
        this.gameState.phase = 'QUAL_1';
        this.gameState.currentQuestionIndex = 1;
        this.gameState.isQuestionActive = false;
        this.gameState.isQuestionFinished = false;
        this.gameState.selectedAnswers = {};
        this.gameState.allTeamsAnswered = false;
        this.gameState.round = 1;
        this.gameState.showRoundWinner = false;
        this.updateCurrentQuestion(payload?.questionId);
        this.stopTimer();
        this.startCountdown('GAME_START');
        break;
      case 'NEXT_QUESTION':
        this.stopTimer();
        this.calculateScores();
        
        if (this.gameState.currentQuestionIndex < 10) {
          this.gameState.currentQuestionIndex++;
          this.gameState.isQuestionActive = false;
          this.gameState.isQuestionFinished = false;
          this.gameState.buzzes = [];
          this.gameState.selectedAnswers = {};
          this.gameState.allTeamsAnswered = false;
          this.updateCurrentQuestion(payload?.questionId);
          this.startCountdown('NEXT_QUESTION');
        } else {
          const winner = [...this.gameState.teams].sort((a, b) => b.score - a.score)[0];
          this.gameState.roundWinner = winner?.name || 'Nessuna';
          this.gameState.showRoundWinner = true;
          this.gameState.isQuestionActive = false;
          this.gameState.timerActive = false;
        }
        break;
      case 'START_NEXT_ROUND':
        this.gameState.showRoundWinner = false;
        if (this.gameState.phase === 'QUAL_1') this.gameState.phase = 'QUAL_2';
        else if (this.gameState.phase === 'QUAL_2') this.gameState.phase = 'QUAL_3';
        else if (this.gameState.phase === 'QUAL_3') {
          this.gameState.phase = 'QUAL_RESULTS';
          this.calculateQualifiers();
          break;
        }
        this.gameState.round++;
        this.gameState.currentQuestionIndex = 1;
        this.gameState.isQuestionActive = false;
        this.gameState.isQuestionFinished = false;
        this.gameState.buzzes = [];
        this.gameState.selectedAnswers = {};
        this.gameState.allTeamsAnswered = false;
        this.updateCurrentQuestion(payload?.questionId);
        this.stopTimer();
        this.startCountdown('NEXT_QUESTION');
        break;
      case 'TOGGLE_QUESTION':
        if (this.gameState.isQuestionActive) {
          this.calculateScores();
          this.stopTimer();
          this.gameState.isQuestionActive = false;
        } else {
          this.gameState.isQuestionFinished = false;
          this.gameState.isQuestionActive = true;
          this.startTimer();
        }
        break;
      case 'UPDATE_SCORE':
        const team = this.gameState.teams.find(t => t.id === payload.teamId);
        if (team) {
          team.score += payload.amount;
          if (this.gameState.phase === 'SEMIS' && this.gameState.semisMatches) {
            this.updateMatchScore(payload.teamId, payload.amount);
          } else if (this.gameState.phase === 'FINAL' && this.gameState.finalMatch) {
            this.updateFinalScore(payload.teamId, payload.amount);
          }
        }
        break;
      case 'START_SEMIS':
        this.gameState.phase = 'SEMIS';
        this.gameState.currentQuestionIndex = 1;
        this.gameState.isQuestionActive = false;
        this.gameState.buzzes = [];
        this.gameState.allTeamsAnswered = false;
        this.updateCurrentQuestion(payload?.questionId);
        this.stopTimer();
        this.startCountdown('NEXT_QUESTION');
        break;
      case 'START_FINAL':
        this.gameState.phase = 'FINAL';
        this.gameState.currentQuestionIndex = 1;
        this.gameState.isQuestionActive = false;
        this.gameState.buzzes = [];
        this.gameState.allTeamsAnswered = false;
        this.updateCurrentQuestion(payload?.questionId);
        this.stopTimer();
        this.startCountdown('NEXT_QUESTION');
        break;
      case 'RESET_GAME':
        this.stopTimer();
        this.stopCountdown();
        this.gameState.phase = 'LOBBY';
        this.gameState.currentQuestionIndex = 0;
        this.gameState.isQuestionActive = false;
        this.gameState.isQuestionFinished = false;
        this.gameState.teams.forEach(t => { t.score = 0; t.status = 'in gara'; });
        this.gameState.selectedAnswers = {};
        this.gameState.allTeamsAnswered = false;
        this.gameState.buzzes = [];
        this.gameState.questionQueue = [];
        this.gameState.usedQuestionIds = [];
        this.gameState.showRoundWinner = false;
        this.gameState.round = 1;
        break;
      case 'DELETE_TEAM':
        this.gameState.teams = this.gameState.teams.filter(t => t.id !== payload.teamId);
        break;
      case 'ADD_TO_QUEUE':
        // The payload might contain 'question' or 'questionId'
        const qId = payload.questionId || payload.question?.id;
        if (!this.gameState.questionQueue) this.gameState.questionQueue = [];
        if (qId && !this.gameState.questionQueue.includes(qId)) {
          this.gameState.questionQueue = [...this.gameState.questionQueue, qId];
        }
        break;
      case 'REMOVE_FROM_QUEUE':
        const rId = payload.questionId || payload.question?.id;
        if (this.gameState.questionQueue) {
          this.gameState.questionQueue = this.gameState.questionQueue.filter(id => id !== rId);
        }
        break;
      case 'REMOVE_FILE':
      case 'DELETE_FILE':
        const { fileName } = payload;
        this.gameState.uploadedFiles = this.gameState.uploadedFiles.filter(f => f !== fileName);
        
        const newAllQuestions = { ...this.gameState.allQuestions };
        Object.keys(newAllQuestions).forEach(phase => {
          newAllQuestions[phase] = newAllQuestions[phase].filter(q => q.source !== fileName);
        });
        this.gameState.allQuestions = newAllQuestions;
        break;
      case 'CLEAR_ALL_QUESTIONS':
        this.gameState.uploadedFiles = [];
        Object.keys(this.gameState.allQuestions).forEach(phase => {
          this.gameState!.allQuestions[phase] = [];
        });
        this.gameState.questionQueue = [];
        break;
      case 'ADD_QUESTIONS':
        const { phase: targetPhase, questions: newQuestions, fileName: sourceFile } = payload;
        if (sourceFile && !this.gameState.uploadedFiles.includes(sourceFile)) {
          this.gameState.uploadedFiles.push(sourceFile);
        }
        if (!this.gameState.allQuestions[targetPhase]) this.gameState.allQuestions[targetPhase] = [];
        const questionsWithSource = newQuestions.map((q: any) => ({ ...q, source: sourceFile || 'default' }));
        this.gameState.allQuestions[targetPhase].push(...questionsWithSource);
        break;
      case 'CLEAR_BUZZES':
        this.gameState.buzzes = [];
        break;
      case 'RESET_BUZZES':
        this.gameState.buzzes = [];
        break;
    }
  }

  private updateCurrentQuestion(manualId?: string) {
    if (!this.gameState) return;
    
    // Combine all available questions (Preloaded + Library in state)
    const allAvailableQuestions = [
      ...PRELOADED_QUESTIONS.flatMap(f => f.questions),
      ...Object.values(this.gameState.allQuestions).flat()
    ];

    const phase = this.gameState.phase;
    const phaseQuestions = allAvailableQuestions.filter(q => {
      // If it's a preloaded question, we might need to check if it's intended for this phase
      // For now, if it's in the queue or manualId, we use it.
      // Otherwise, we filter by phase if the question has a phase property (which it doesn't yet)
      // So we'll rely on the queue or manual selection mostly.
      return true; 
    });

    if (manualId) {
      const manual = allAvailableQuestions.find(q => q.id === manualId);
      if (manual) {
        this.gameState.currentQuestion = manual;
        if (!this.gameState.usedQuestionIds.includes(manual.id)) {
          this.gameState.usedQuestionIds.push(manual.id);
        }
        return;
      }
    }

    if (this.gameState.questionQueue.length > 0) {
      const nextId = this.gameState.questionQueue.shift();
      const queued = allAvailableQuestions.find(q => q.id === nextId);
      if (queued) {
        this.gameState.currentQuestion = queued;
        if (!this.gameState.usedQuestionIds.includes(queued.id)) {
          this.gameState.usedQuestionIds.push(queued.id);
        }
        return;
      }
    }

    // Fallback: random from phase-appropriate questions
    // Since we don't have phase-mapping for preloaded yet, we'll just pick from what's in the state for that phase
    const statePhaseQuestions = this.gameState.allQuestions[phase as keyof typeof this.gameState.allQuestions] || [];
    let available = statePhaseQuestions.filter(q => !this.gameState!.usedQuestionIds.includes(q.id));
    
    if (available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length);
      const selectedQuestion = available[randomIndex];
      this.gameState.currentQuestion = selectedQuestion;
      this.gameState.usedQuestionIds.push(selectedQuestion.id);
    } else if (statePhaseQuestions.length > 0) {
      this.gameState.currentQuestion = statePhaseQuestions[0];
    }
  }

  private calculateScores() {
    if (!this.gameState || !this.gameState.currentQuestion || this.gameState.currentQuestion.correctAnswer === undefined || this.gameState.isQuestionFinished) return;
    const correctIdx = this.gameState.currentQuestion.correctAnswer;
    this.gameState.teams.forEach(team => {
      const selectedIdx = this.gameState!.selectedAnswers[team.id];
      if (selectedIdx !== undefined) {
        if (selectedIdx === correctIdx) {
          team.score += 10;
        } else {
          team.score = Math.max(0, team.score - 5);
        }
      }
    });
    this.gameState.isQuestionFinished = true;
  }

  private calculateQualifiers() {
    if (!this.gameState) return;
    const sorted = [...this.gameState.teams].sort((a, b) => b.score - a.score);
    sorted.forEach((team, index) => {
      if (index < 4) team.status = 'qualificata';
      else team.status = 'eliminata';
    });
    const qualifiers = sorted.slice(0, 4);
    if (qualifiers.length >= 4) {
      this.gameState.semisMatches = {
        match1: { teamAId: qualifiers[0].id, teamBId: qualifiers[2].id, scoreA: 0, scoreB: 0 },
        match2: { teamAId: qualifiers[1].id, teamBId: qualifiers[3].id, scoreA: 0, scoreB: 0 },
      };
      qualifiers.forEach(t => t.status = 'in semifinale');
    }
  }

  private updateMatchScore(teamId: string, amount: number) {
    if (!this.gameState || !this.gameState.semisMatches) return;
    const { match1, match2 } = this.gameState.semisMatches;
    [match1, match2].forEach(match => {
      if (match.teamAId === teamId) match.scoreA += amount;
      if (match.teamBId === teamId) match.scoreB += amount;
      if (match.scoreA >= 10 && !match.winnerId) {
        match.winnerId = match.teamAId;
        const winner = this.gameState!.teams.find(t => t.id === match.teamAId);
        const loser = this.gameState!.teams.find(t => t.id === match.teamBId);
        if (winner) winner.status = 'in finale';
        if (loser) loser.status = 'eliminata';
        this.checkFinalReady();
      }
      if (match.scoreB >= 10 && !match.winnerId) {
        match.winnerId = match.teamBId;
        const winner = this.gameState!.teams.find(t => t.id === match.teamBId);
        const loser = this.gameState!.teams.find(t => t.id === match.teamAId);
        if (winner) winner.status = 'in finale';
        if (loser) loser.status = 'eliminata';
        this.checkFinalReady();
      }
    });
  }

  private checkFinalReady() {
    if (!this.gameState) return;
    if (this.gameState.semisMatches?.match1.winnerId && this.gameState.semisMatches?.match2.winnerId) {
      this.gameState.finalMatch = {
        teamAId: this.gameState.semisMatches.match1.winnerId,
        teamBId: this.gameState.semisMatches.match2.winnerId,
        scoreA: 0,
        scoreB: 0
      };
    }
  }

  private updateFinalScore(teamId: string, amount: number) {
    if (!this.gameState || !this.gameState.finalMatch) return;
    const match = this.gameState.finalMatch;
    if (match.teamAId === teamId) match.scoreA += amount;
    if (match.teamBId === teamId) match.scoreB += amount;
    if (match.scoreA >= 10 && !match.winnerId) {
      match.winnerId = match.teamAId;
      this.gameState.teams.find(t => t.id === match.teamAId)!.status = 'vincitrice';
      this.gameState.teams.find(t => t.id === match.teamBId)!.status = 'eliminata';
      this.gameState.phase = 'FINISHED';
    }
    if (match.scoreB >= 10 && !match.winnerId) {
      match.winnerId = match.teamBId;
      this.gameState.teams.find(t => t.id === match.teamBId)!.status = 'vincitrice';
      this.gameState.teams.find(t => t.id === match.teamAId)!.status = 'eliminata';
      this.gameState.phase = 'FINISHED';
    }
  }

  private startTimer() {
    if (!this.gameState) return;
    if (this.timerInterval) clearInterval(this.timerInterval);
    const duration = 60;
    this.gameState.timer = duration;
    this.gameState.timerActive = true;
    this.gameState.timerEndTime = Date.now() + duration * 1000;
    
    this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });

    this.timerInterval = setInterval(() => {
      if (!this.gameState || !this.gameState.timerEndTime) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((this.gameState.timerEndTime - now) / 1000));
      if (remaining !== this.gameState.timer) {
        this.gameState.timer = remaining;
        if (this.gameState.timer <= 0) {
          this.stopTimer();
          this.gameState.isQuestionActive = false;
          this.gameState.isQuestionFinished = true;
          this.calculateScores();
          if (this.gameState.currentQuestionIndex === 10 && this.gameState.phase.startsWith('QUAL_')) {
            const winner = [...this.gameState.teams].sort((a, b) => b.score - a.score)[0];
            this.gameState.roundWinner = winner?.name || 'Nessuna';
            this.gameState.showRoundWinner = true;
            this.gameState.timerActive = false;
          }
        }
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
      }
    }, 100);
  }

  private stopTimer() {
    if (!this.gameState) return;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.gameState.timerEndTime = undefined;
    this.gameState.timerActive = false;
  }

  private startCountdown(type: 'NEXT_QUESTION' | 'QUESTION_ENDING' | 'GAME_START' = 'NEXT_QUESTION', duration: number = 3) {
    if (!this.gameState) return;
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.gameState.countdown = duration;
    this.gameState.countdownActive = true;
    this.gameState.countdownType = type;
    this.gameState.countdownEndTime = Date.now() + duration * 1000;
    
    this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });

    this.countdownInterval = setInterval(() => {
      if (!this.gameState || !this.gameState.countdownEndTime) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((this.gameState.countdownEndTime - now) / 1000));
      if (remaining !== this.gameState.countdown) {
        this.gameState.countdown = remaining;
        if (this.gameState.countdown <= 0) {
          this.stopCountdown();
        }
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
      }
    }, 100);
  }

  private stopCountdown() {
    if (!this.gameState) return;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    const type = this.gameState.countdownType;
    this.gameState.countdownEndTime = undefined;
    this.gameState.countdownActive = false;
    this.gameState.countdown = 0;
    this.gameState.countdownType = undefined;

    if (type === 'NEXT_QUESTION' || type === 'GAME_START') {
      const phasesWithQuestions = ['QUAL_1', 'QUAL_2', 'QUAL_3', 'SEMIS', 'FINAL'];
      if (phasesWithQuestions.includes(this.gameState.phase)) {
        this.gameState.isQuestionFinished = false;
        this.gameState.isQuestionActive = true;
        this.startTimer();
      }
    } else if (type === 'QUESTION_ENDING') {
      this.stopTimer();
      this.calculateScores();
      this.gameState.allTeamsAnswered = false;
    }
    
    this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
  }

  private broadcast(data: any) {
    if (!this.isHost) return;
    
    // Create a stripped version of the state for non-admin peers
    // to reduce payload size and lag.
    let clientData = data;
    if (data.type === 'STATE_UPDATE' && data.state) {
      const { allQuestions, ...strippedState } = data.state;
      
      // CRITICAL: Strip large music data URLs from frequent state updates
      // These can be several megabytes and will crash the DataChannel if sent 10x per second
      if (strippedState.leaderboardMusicUrl && strippedState.leaderboardMusicUrl.startsWith('data:')) {
        strippedState.leaderboardMusicUrl = 'DATA_URL_SYNCED';
      }
      
      clientData = { ...data, state: strippedState };
    }

    this.connections.forEach(conn => {
      if (conn.open) {
        // We could potentially send full state to some peers and stripped to others,
        // but for now, everyone except the host gets the stripped version.
        // The host (Admin) already has the full state in this.gameState.
        conn.send(clientData);
      }
    });

    // Trigger local callbacks for the host itself (Admin)
    // We send a shallow clone of the state to ensure React triggers a re-render
    if (data.type === 'STATE_UPDATE' && data.state) {
      this.callbacks.forEach(cb => cb({ ...data, state: { ...data.state } }));
    } else {
      this.callbacks.forEach(cb => cb(data));
    }
    
    // Persist state (FULL state)
    if (this.gameState) {
      localStorage.setItem('gameState', JSON.stringify(this.gameState));
    }
  }

  // --- Client Logic ---
  connect(hostId: string) {
    if (!hostId) return;
    
    this.isHost = false;
    this.hostId = hostId;
    
    const performConnect = () => {
      if (!this.peer || this.peer.destroyed) {
        this.initializePeer();
        this.peer?.once('open', () => performConnect());
        return;
      }

      console.log('PeerJS: Attempting to connect to host:', hostId);
      
      // Close existing connection if any
      const existing = this.connections.get(hostId);
      if (existing) existing.close();

      const conn = this.peer.connect(hostId, {
        reliable: true,
        metadata: { timestamp: Date.now() }
      });
      
      conn.on('open', () => {
        console.log('PeerJS: Connected to host:', hostId);
        this.connections.set(hostId, conn);
        // Clear any previous connection errors
        this.callbacks.forEach(cb => cb({ type: 'CONNECTION_SUCCESS' }));
        // Flush queue
        this.flushMessageQueue();
        // Request state explicitly just in case
        conn.send({ type: 'REQUEST_STATE' });
      });

      conn.on('data', (data: any) => {
        this.callbacks.forEach(cb => cb(data));
      });

      conn.on('close', () => {
        console.log('PeerJS: Connection to host closed');
        this.connections.delete(hostId);
        // Only auto-reconnect if we are still trying to be in this room
        if (this.hostId === hostId && !this.isHost) {
          console.log('PeerJS: Attempting auto-reconnect in 3s...');
          setTimeout(() => this.connect(hostId), 3000);
        }
      });

      conn.on('error', (err) => {
        console.error('PeerJS Connection Error:', err);
        // Don't trigger error immediately, let the peer-unavailable handler on the peer object handle it if it's a "not found"
      });
    };

    if (this.peer?.open) {
      performConnect();
    } else {
      console.log('PeerJS: Peer not open yet, waiting for open event...');
      this.peer?.once('open', () => performConnect());
      // If it takes too long to open the peer itself
      setTimeout(() => {
        if (!this.peer?.open) {
          this.callbacks.forEach(cb => cb({ 
            type: 'CONNECTION_ERROR', 
            error: 'Impossibile inizializzare il servizio di rete. Prova a ricaricare la pagina.' 
          }));
        }
      }, 8000);
    }
  }

  subscribe(cb: MessageCallback) {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  onId(cb: (id: string) => void) {
    this.onIdCallbacks.add(cb);
    if (this.peer?.id) cb(this.peer.id);
    return () => this.onIdCallbacks.delete(cb);
  }

  send(message: any) {
    if (this.isHost) {
      // Host handles its own messages
      this.handleHostMessage({ peer: 'self' } as any, message);
    } else if (this.hostId) {
      const conn = this.connections.get(this.hostId);
      if (conn && conn.open) {
        conn.send(message);
      } else {
        console.log('PeerJS: Connection not ready, queuing message:', message.type);
        this.messageQueue.push(message);
      }
    }
  }

  private flushMessageQueue() {
    if (this.hostId && this.messageQueue.length > 0) {
      const conn = this.connections.get(this.hostId);
      if (conn && conn.open) {
        console.log('PeerJS: Flushing message queue, items:', this.messageQueue.length);
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          conn.send(msg);
        }
      }
    }
  }
}

export const peerService = new PeerService();
