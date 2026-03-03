import { WebSocket } from 'ws';

export type TeamStatus = 'in gara' | 'eliminata' | 'qualificata' | 'in semifinale' | 'in finale' | 'vincitrice';

export interface Team {
  id: string;
  name: string;
  score: number;
  status: TeamStatus;
}

export type GamePhase = 'LOBBY' | 'QUAL_1' | 'QUAL_2' | 'QUAL_3' | 'QUAL_RESULTS' | 'SEMIS' | 'FINAL' | 'FINISHED';

export interface Question {
  id: string;
  text: string;
  options?: string[]; // Solo per qualificazioni
  correctAnswer?: number; // Indice 0-3
  difficulty: 'facile' | 'media' | 'difficile';
}

export interface GameState {
  phase: GamePhase;
  currentQuestionIndex: number;
  currentQuestion?: Question;
  usedQuestionIds: string[];
  isQuestionActive: boolean;
  teams: Team[];
  selectedAnswers: Record<string, number>; // teamId -> answerIndex
  buzzes: { teamId: string; timestamp: number }[];
  timer: number;
  timerActive: boolean;
  semisMatches: {
    match1: Match;
    match2: Match;
  } | null;
  finalMatch: Match | null;
}

export interface Match {
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  winnerId?: string;
}

export interface ServerMessage {
  type: 'STATE_UPDATE' | 'JOIN_SUCCESS';
  state?: GameState;
  team?: Team;
}
