export type TeamStatus = 'in gara' | 'eliminata' | 'qualificata' | 'in semifinale' | 'in finale' | 'vincitrice';

export interface Team {
  id: string;
  name: string;
  score: number;
  status: TeamStatus;
  lastAnswerFast?: boolean;
}

export type GamePhase = 'LOBBY' | 'QUAL_1' | 'QUAL_2' | 'QUAL_3' | 'QUAL_TIEBREAKER' | 'QUAL_RESULTS' | 'SEMIS_1' | 'SEMIS_2' | 'FINAL' | 'FINISHED';

export interface Question {
  id: string;
  text: string;
  options?: string[]; // Solo per qualificazioni
  correctAnswer?: number; // Indice 0-3
  difficulty: 'facile' | 'media' | 'difficile';
  source?: string; // Nome del file PDF o 'default'
}

export interface QuestionFolder {
  name: string;
  questions: Question[];
}

export interface GameState {
  phase: GamePhase;
  currentQuestionIndex: number;
  currentQuestion?: Question;
  usedQuestionIds: string[];
  isQuestionActive: boolean;
  isQuestionFinished: boolean;
  questionStartTime?: number;
  teams: Team[];
  selectedAnswers: Record<string, number>; // teamId -> answerIndex
  answerTimes: Record<string, number>; // teamId -> secondsTaken
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
  nextQuestionId?: string; // Deprecated in favor of queue
  questionQueue: string[]; // IDs of questions in queue
  uploadedFiles: string[]; // List of uploaded PDF names
  allQuestions: Record<string, Question[]>;
  leaderboardMusicUrl?: string;
  tiebreakerTeams?: string[]; // IDs of teams in tie-breaker
  tiebreakerScores?: Record<string, number>; // teamId -> score (0-3)
  tiebreakerSpots?: number; // Number of spots available in tie-breaker
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
