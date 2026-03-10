import { Peer, DataConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { GameState, Team, Question } from '../types';

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

  private onIdCallbacks: Set<(id: string) => void> = new Set();

  constructor() {
    this.initializePeer();
  }

  private initializePeer() {
    const generate8DigitId = () => Math.floor(10000000 + Math.random() * 90000000).toString();
    const id = generate8DigitId();
    
    // Explicit configuration for PeerJS cloud server to ensure compatibility with HTTPS
    this.peer = new Peer(id, {
      debug: 1,
      secure: true,
      host: '0.peerjs.com',
      port: 443
    });
    
    this.peer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
      this.onIdCallbacks.forEach(cb => cb(id));
    });

    this.peer.on('connection', (conn) => {
      if (this.isHost) {
        this.handleNewConnection(conn);
      } else {
        console.warn('Received connection but not in host mode');
        conn.close();
      }
    });

    this.peer.on('error', (err: any) => {
      console.error('Peer error:', err.type, err);
      if (err.type === 'unavailable-id') {
        console.log('ID taken, retrying with new ID...');
        this.peer?.destroy();
        this.initializePeer();
      } else if (err.type === 'peer-unavailable') {
        // This happens if the host ID we are trying to connect to is wrong
        this.callbacks.forEach(cb => cb({ type: 'CONNECTION_ERROR', error: 'Stanza non trovata. Verifica l\'ID.' }));
      }
    });

    this.peer.on('disconnected', () => {
      console.log('Peer disconnected, reconnecting...');
      this.peer?.reconnect();
    });
  }

  getPeerId(): string | undefined {
    return this.peer?.id;
  }

  // --- Host Logic ---
  startHost(initialState: GameState) {
    this.isHost = true;
    this.gameState = initialState;
    console.log('Started as Host');
  }

  private handleNewConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);
    
    conn.on('data', (data: any) => {
      console.log('Host received data:', data);
      this.handleHostMessage(conn, data);
    });

    conn.on('open', () => {
      console.log('Connection opened with peer:', conn.peer);
      // Send current state to new client
      if (this.gameState) {
        conn.send({ type: 'STATE_UPDATE', state: this.gameState });
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      console.log('Connection closed with peer:', conn.peer);
    });
  }

  private handleHostMessage(conn: DataConnection, data: any) {
    if (!this.gameState) return;

    switch (data.type) {
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
        this.gameState.questionQueue = data.payload.queue;
        this.broadcast({ type: 'STATE_UPDATE', state: this.gameState });
        break;
        
      case 'SET_LEADERBOARD_MUSIC':
        this.gameState.leaderboardMusicUrl = data.payload.url;
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
        // Reset state logic would go here
        break;
      case 'DELETE_TEAM':
        this.gameState.teams = this.gameState.teams.filter(t => t.id !== payload.teamId);
        break;
      case 'ADD_TO_QUEUE':
        if (!this.gameState.questionQueue.includes(payload.questionId)) {
          this.gameState.questionQueue.push(payload.questionId);
        }
        break;
      case 'REMOVE_FROM_QUEUE':
        this.gameState.questionQueue = this.gameState.questionQueue.filter(id => id !== payload.questionId);
        break;
      case 'ADD_QUESTIONS':
        const { phase, questions, fileName } = payload;
        if (fileName && !this.gameState.uploadedFiles.includes(fileName)) {
          this.gameState.uploadedFiles.push(fileName);
        }
        if (!this.gameState.allQuestions[phase]) this.gameState.allQuestions[phase] = [];
        const questionsWithSource = questions.map((q: any) => ({ ...q, source: fileName || 'default' }));
        this.gameState.allQuestions[phase].push(...questionsWithSource);
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
    const phaseQuestions = this.gameState.allQuestions[this.gameState.phase as keyof typeof this.gameState.allQuestions];
    if (phaseQuestions) {
      if (manualId) {
        const manual = phaseQuestions.find(q => q.id === manualId);
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
        const allQuestionsFlat = Object.values(this.gameState.allQuestions).flat();
        const queued = allQuestionsFlat.find(q => q.id === nextId);
        if (queued) {
          this.gameState.currentQuestion = queued;
          if (!this.gameState.usedQuestionIds.includes(queued.id)) {
            this.gameState.usedQuestionIds.push(queued.id);
          }
          return;
        }
      }

      let available = phaseQuestions.filter(q => !this.gameState!.usedQuestionIds.includes(q.id));
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        const selectedQuestion = available[randomIndex];
        this.gameState.currentQuestion = selectedQuestion;
        this.gameState.usedQuestionIds.push(selectedQuestion.id);
      } else {
        this.gameState.currentQuestion = phaseQuestions[0];
      }
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
    const message = data;
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(message);
      }
    });
    // Trigger local callbacks for the host itself
    this.callbacks.forEach(cb => cb(data));
    
    // Persist state
    if (this.gameState) {
      localStorage.setItem('gameState', JSON.stringify(this.gameState));
    }
  }

  // --- Client Logic ---
  connect(hostId: string) {
    this.isHost = false;
    this.hostId = hostId;
    
    const performConnect = () => {
      console.log('Attempting to connect to host:', hostId);
      const conn = this.peer!.connect(hostId, {
        reliable: true
      });
      
      conn.on('open', () => {
        console.log('Connected to host:', hostId);
        this.connections.set(hostId, conn);
      });

      conn.on('data', (data: any) => {
        console.log('Client received data:', data);
        this.callbacks.forEach(cb => cb(data));
      });

      conn.on('close', () => {
        console.log('Connection to host closed');
        this.connections.delete(hostId);
        // Try to reconnect if we still have a hostId
        if (this.hostId === hostId) {
          setTimeout(() => this.connect(hostId), 3000);
        }
      });

      conn.on('error', (err) => {
        console.error('Connection error:', err);
        this.callbacks.forEach(cb => cb({ type: 'CONNECTION_ERROR', error: 'Errore durante la connessione alla stanza.' }));
      });
    };

    if (this.peer?.open) {
      performConnect();
    } else {
      console.log('Peer not open yet, waiting...');
      this.peer?.once('open', () => performConnect());
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
        console.warn('Connection to host not open');
      }
    }
  }
}

export const peerService = new PeerService();
