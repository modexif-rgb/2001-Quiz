import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { peerService } from './services/peerService';
import { GameState, Team, Question } from './types';
import { GoogleGenAI, Type } from "@google/genai";
import { Trophy, Users, Zap, Settings, LogOut, ChevronRight, AlertCircle, CheckCircle2, XCircle, FileText, Search, Plus, Folder, FolderOpen, Trash2, ArrowUp, ArrowDown, ListOrdered, ArrowLeft, Copy, Share2, X, BookOpen, Sun, Moon, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PRELOADED_QUESTIONS } from './data/questions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import * as pdfjs from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

function CountdownDisplay({ seconds, active, endTime }: { seconds: number, active: boolean, endTime?: number }) {
  const [displaySeconds, setDisplaySeconds] = useState(seconds);

  useEffect(() => {
    if (!active) {
      setDisplaySeconds(seconds);
      return;
    }

    const updateCountdown = () => {
      if (endTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        setDisplaySeconds(remaining);
      } else {
        setDisplaySeconds(seconds);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [active, seconds, endTime]);

  return <>{displaySeconds}</>;
}

function TimerDisplay({ seconds, active, endTime, className }: { seconds: number, active: boolean, endTime?: number, className?: string }) {
  const [displaySeconds, setDisplaySeconds] = useState(seconds);

  useEffect(() => {
    if (!active) {
      setDisplaySeconds(seconds);
      return;
    }

    const updateTimer = () => {
      if (endTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        setDisplaySeconds(remaining);
      } else {
        setDisplaySeconds(seconds);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [active, seconds, endTime]);

  if (className) {
    return (
      <div className={cn(
        className,
        active ? (displaySeconds <= 10 ? "bg-red-500 text-white animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.6)]" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20") : "bg-zinc-100 text-zinc-400"
      )}>
        <Zap className={cn("w-8 h-8 sm:w-12 sm:h-12", active && displaySeconds <= 10 && "animate-bounce")} />
        {String(Math.floor(displaySeconds / 60)).padStart(2, '0')}:{String(displaySeconds % 60).padStart(2, '0')}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-xl transition-all",
      active ? (displaySeconds <= 10 ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "bg-emerald-500/10 text-emerald-500") : "bg-zinc-100 text-zinc-400"
    )}>
      <Zap className={cn("w-5 h-5", active && displaySeconds <= 10 && "animate-bounce")} />
      {String(Math.floor(displaySeconds / 60)).padStart(2, '0')}:{String(displaySeconds % 60).padStart(2, '0')}
    </div>
  );
}

const ManualEntryModal = ({ isOpen, onClose, onImport, currentPhase }: { isOpen: boolean, onClose: () => void, onImport: (questions: Question[]) => void, currentPhase: string }) => {
  const [rows, setRows] = useState([{ text: '', options: ['', '', '', ''], correctAnswer: 0 }]);

  const addRow = () => {
    setRows([...rows, { text: '', options: ['', '', '', ''], correctAnswer: 0 }]);
  };

  const updateRow = (index: number, field: string, value: any) => {
    const newRows = [...rows];
    if (field.startsWith('option_')) {
      const optIndex = parseInt(field.split('_')[1]);
      newRows[index].options[optIndex] = value;
    } else {
      (newRows[index] as any)[field] = value;
    }
    setRows(newRows);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const handleImport = () => {
    const validQuestions = rows
      .filter(r => r.text.trim() !== '' && r.options.every(o => o.trim() !== ''))
      .map((r, idx) => ({
        id: `manual_${Date.now()}_${idx}`,
        text: r.text,
        options: r.options,
        correctAnswer: r.correctAnswer,
        difficulty: 'difficile' as const
      }));

    if (validQuestions.length > 0) {
      onImport(validQuestions);
      onClose();
    } else {
      alert("Inserisci almeno una domanda completa (testo e 4 opzioni).");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
          <div>
            <h2 className="text-2xl font-black text-zinc-950 dark:text-white">Inserimento Manuale Domande</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Aggiungi le domande riga per riga per la fase: <span className="font-bold text-emerald-600 dark:text-emerald-500">{currentPhase}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-all">
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <th className="pb-4 pl-2">Domanda</th>
                <th className="pb-4 px-2">Opzioni (A, B, C, D)</th>
                <th className="pb-4 px-2 w-32 text-center">Risposta Corretta</th>
                <th className="pb-4 pr-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {rows.map((row, idx) => (
                <tr key={idx} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-all">
                  <td className="py-4 pl-2 align-top">
                    <textarea
                      value={row.text}
                      onChange={(e) => updateRow(idx, 'text', e.target.value)}
                      placeholder="Testo della domanda..."
                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none h-24"
                    />
                  </td>
                  <td className="py-4 px-2 align-top">
                    <div className="grid grid-cols-2 gap-2">
                      {row.options.map((opt, optIdx) => (
                        <input
                          key={optIdx}
                          type="text"
                          value={opt}
                          onChange={(e) => updateRow(idx, `option_${optIdx}`, e.target.value)}
                          placeholder={`Opzione ${String.fromCharCode(65 + optIdx)}`}
                          className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        />
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-2 align-top text-center">
                    <select
                      value={row.correctAnswer}
                      onChange={(e) => updateRow(idx, 'correctAnswer', parseInt(e.target.value))}
                      className="bg-white border border-zinc-200 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value={0}>Opzione A</option>
                      <option value={1}>Opzione B</option>
                      <option value={2}>Opzione C</option>
                      <option value={3}>Opzione D</option>
                    </select>
                  </td>
                  <td className="py-4 pr-2 align-top text-right">
                    <button 
                      onClick={() => removeRow(idx)}
                      className="p-2 text-zinc-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button 
            onClick={addRow}
            className="mt-6 w-full py-4 border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-400 font-bold hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Aggiungi un'altra riga
          </button>
        </div>

        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-zinc-500 dark:text-zinc-400 font-bold hover:text-zinc-700 dark:hover:text-zinc-200 transition-all"
          >
            Annulla
          </button>
          <button 
            onClick={handleImport}
            className="px-8 py-3 bg-emerald-500 text-zinc-950 font-black rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            Importa {rows.length} Domande
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Synthetic Sound Generator removed from global scope

const ThemeToggle = ({ theme, toggleTheme }: { theme: 'light' | 'dark', toggleTheme: () => void }) => (
  <button
    onClick={toggleTheme}
    className="p-2.5 rounded-xl transition-all bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 border border-zinc-200 dark:border-zinc-700 shadow-sm"
    title={theme === 'light' ? "Passa a Modalità Scura" : "Passa a Modalità Chiara"}
  >
    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
  </button>
);

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    console.log('Theme changed to:', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    console.log('Toggling theme...');
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [savedTeam, setSavedTeam] = useState<Team | null>(() => {
    const saved = localStorage.getItem('myTeam');
    return saved ? JSON.parse(saved) : null;
  });
  const [teamName, setTeamName] = useState('');
  const [userRole, setUserRole] = useState<'TEAM' | 'ADMIN' | 'LEADERBOARD' | null>(null);
  const [view, setView] = useState<'SELECTION' | 'PASSWORD' | 'APP'>('SELECTION');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [isRolePopupOpen, setIsRolePopupOpen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isLeaderboard, setIsLeaderboard] = useState(false);

  const [audioEnabled, setAudioEnabled] = useState(false);
  const leaderboardMusicRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevCountdownActive = useRef(false);
  const prevCountdownValue = useRef(-1);
  const prevTimerValue = useRef(-1);
  const prevBuzzCount = useRef(0);
  const musicSyncedForTimer = useRef(false);

  // Synthetic Sound Generator - Now inside App to use shared context
  const playSyntheticSound = (type: 'beep' | 'siren' | 'countdown' | 'start' | 'finish' | 'buzz') => {
    if (!audioEnabled || !isLeaderboard) return;
    
    try {
      let audioCtx = audioCtxRef.current;
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;
      }
      
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'beep') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
      } else if (type === 'buzz') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'siren') {
        // More evident siren: dual oscillator with frequency modulation
        const now = audioCtx.currentTime;
        [440, 445].forEach(baseFreq => {
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.linearRampToValueAtTime(baseFreq * 2, now + 0.5);
          osc.frequency.linearRampToValueAtTime(baseFreq, now + 1.0);
          osc.frequency.linearRampToValueAtTime(baseFreq * 2, now + 1.5);
          osc.frequency.linearRampToValueAtTime(baseFreq, now + 2.0);
          
          g.gain.setValueAtTime(0.15, now);
          g.gain.linearRampToValueAtTime(0.15, now + 1.8);
          g.gain.linearRampToValueAtTime(0.01, now + 2.0);
          
          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 2.0);
        });
      } else if (type === 'countdown') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'start') {
        const now = audioCtx.currentTime;
        // Fanfare style start
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);
          g.gain.setValueAtTime(0.3, now + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.5);
          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(now + i * 0.05);
          osc.stop(now + i * 0.05 + 0.5);
        });
      } else if (type === 'finish') {
        // Dramatic finish sound
        const now = audioCtx.currentTime;
        const freqs = [440, 349.23, 261.63, 196.00];
        freqs.forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          g.gain.setValueAtTime(0.2, now + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.8);
          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.8);
        });
      }
    } catch (e) {
      console.error(`Synthetic ${type} failed`, e);
    }
  };
  
  // Initialize audio objects once
  useEffect(() => {
    const lbMusic = new Audio();
    lbMusic.crossOrigin = "anonymous";
    lbMusic.preload = "auto";
    lbMusic.loop = true; // User requested loop
    lbMusic.volume = 0.5;
    leaderboardMusicRef.current = lbMusic;
    
    console.log("Audio initialized with synthetic SFX and leaderboard music");
    
    return () => {
      lbMusic.pause();
      lbMusic.src = "";
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const lastLoadedMusicUrl = useRef<string>("");

  // Update music source when it changes in gameState
  useEffect(() => {
    if (gameState?.leaderboardMusicUrl && gameState.leaderboardMusicUrl !== 'DATA_URL_SYNCED' && leaderboardMusicRef.current) {
      if (lastLoadedMusicUrl.current !== gameState.leaderboardMusicUrl) {
        console.log("Loading new leaderboard music...");
        leaderboardMusicRef.current.src = gameState.leaderboardMusicUrl;
        leaderboardMusicRef.current.load();
        lastLoadedMusicUrl.current = gameState.leaderboardMusicUrl;
      }
    }
  }, [gameState?.leaderboardMusicUrl]);

  const lastSyncedTimerRef = useRef<number>(-1);

  const prevPhase = useRef<string>('');

  // Handle Phase Transition SFX
  useEffect(() => {
    if (!audioEnabled || !gameState || !isLeaderboard) return;

    if (gameState.phase === 'FINISHED' && prevPhase.current !== 'FINISHED') {
      playSyntheticSound('siren');
    }

    if (gameState.phase !== 'LOBBY' && prevPhase.current === 'LOBBY') {
      playSyntheticSound('start');
    }

    prevPhase.current = gameState.phase;
  }, [gameState?.phase, audioEnabled, isLeaderboard]);

  // Handle Music and SFX for Leaderboard
  useEffect(() => {
    if (!audioEnabled || !gameState || !isLeaderboard) {
      if (leaderboardMusicRef.current && !leaderboardMusicRef.current.paused) {
        leaderboardMusicRef.current.pause();
      }
      musicSyncedForTimer.current = false;
      return;
    }

    // Music logic for leaderboard: "background musicale solamente nella leaderboard quando parte il timer"
    if (isLeaderboard && audioEnabled && gameState.timerActive && gameState.timer > 0 && gameState.leaderboardMusicUrl) {
      if (leaderboardMusicRef.current) {
        const audio = leaderboardMusicRef.current;
        
        // Ensure src is set correctly
        if (audio.src !== gameState.leaderboardMusicUrl && !gameState.leaderboardMusicUrl.startsWith('DATA_URL_SYNCED')) {
           console.log("Syncing audio src in timer effect");
           audio.src = gameState.leaderboardMusicUrl;
           audio.load();
        }

        const targetTime = 80 - gameState.timer;
        const isWayOff = Math.abs(audio.currentTime - targetTime) > 2;

        if (audio.paused || (!musicSyncedForTimer.current && isWayOff)) {
          console.log(`Syncing music: paused=${audio.paused}, isWayOff=${isWayOff}, target=${targetTime}, current=${audio.currentTime}`);
          if (!isNaN(targetTime) && targetTime >= 0) {
            audio.currentTime = targetTime;
          }
          musicSyncedForTimer.current = true;
        }
        
        if (audio.paused) {
          audio.play().then(() => {
            console.log("Music playback started successfully");
          }).catch(e => {
            console.error("Music play failed - likely needs user interaction", e);
          });
        }
      }
    } else {
      if (leaderboardMusicRef.current && !leaderboardMusicRef.current.paused) {
        console.log("Stopping music (timer inactive or not leaderboard)");
        leaderboardMusicRef.current.pause();
      }
      musicSyncedForTimer.current = false;
    }

    // SFX: "quello prima che finisca il tempo" (last 3 seconds)
    if (gameState.timerActive && gameState.timer <= 3 && gameState.timer > 0) {
      if (prevTimerValue.current !== gameState.timer) {
        playSyntheticSound('beep');
      }
    }

    // SFX: "quando finisce il tempo"
    if (!gameState.timerActive && prevTimerValue.current === 1 && gameState.timer === 0) {
      playSyntheticSound('siren');
    }

    prevTimerValue.current = gameState.timer;
  }, [gameState?.timer, gameState?.timerActive, audioEnabled, isLeaderboard]);

  // Handle Countdown SFX
  useEffect(() => {
    if (!audioEnabled || !gameState) return;

    // SFX: "3,2,1 prima delle domande"
    if (gameState.countdownActive && gameState.countdown > 0) {
      if (prevCountdownValue.current !== gameState.countdown) {
        playSyntheticSound('countdown');
      }
    }

    // SFX: "via" (when countdown reaches 0)
    if (!gameState.countdownActive && prevCountdownActive.current && gameState.countdown === 0) {
      playSyntheticSound('start');
    }

    prevCountdownValue.current = gameState.countdown;
    prevCountdownActive.current = gameState.countdownActive;
  }, [gameState?.countdown, gameState?.countdownActive, audioEnabled]);

  // Handle Buzz SFX
  useEffect(() => {
    if (!audioEnabled || !gameState || !isLeaderboard) return;

    if (gameState.buzzes.length > prevBuzzCount.current) {
      playSyntheticSound('buzz');
    }
    prevBuzzCount.current = gameState.buzzes.length;
  }, [gameState?.buzzes, audioEnabled, isLeaderboard]);

  useEffect(() => {
    const unsubscribeId = peerService.onId((id) => {
      setMyPeerId(id);
    });

    const unsubscribe = peerService.subscribe((msg) => {
      console.log('Received message from peer:', msg.type);
      if (msg.type === 'STATE_UPDATE' && msg.state) {
        setGameState(prev => {
          const newState = { ...msg.state };
          // Preserve music URL if the incoming state has the placeholder
          if (newState.leaderboardMusicUrl === 'DATA_URL_SYNCED' && prev?.leaderboardMusicUrl) {
            newState.leaderboardMusicUrl = prev.leaderboardMusicUrl;
          }
          return newState;
        });
        setIsConnecting(false);
        setConnectionError(null);
      }
      if (msg.type === 'CONNECTION_SUCCESS') {
        setIsConnecting(false);
        setConnectionError(null);
      }
      if (msg.type === 'MUSIC_UPDATE') {
        setGameState(prev => prev ? { ...prev, leaderboardMusicUrl: msg.url } : null);
      }
      if (msg.type === 'JOIN_SUCCESS' && msg.team) {
        setMyTeam(msg.team);
        localStorage.setItem('myTeam', JSON.stringify(msg.team));
        setIsConnecting(false);
      }
      if (msg.type === 'CONNECTION_ERROR') {
        setConnectionError(msg.error);
        setIsConnecting(false);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeId();
    };
  }, []);

  const createInitialState = (): GameState => ({
    phase: 'LOBBY',
    currentQuestionIndex: 0,
    isQuestionActive: false,
    isQuestionFinished: false,
    teams: [],
    selectedAnswers: {},
    answerTimes: {},
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
    allQuestions: PRELOADED_QUESTIONS.reduce((acc, folder) => {
      // Map preloaded folders to phases or just a general pool
      // For now, let's put them in a 'LIBRARY' phase or similar if needed
      // But the app expects QUAL_1, QUAL_2, etc.
      // We'll initialize them as empty and let the admin pick
      return acc;
    }, {
      QUAL_1: [],
      QUAL_2: [],
      QUAL_3: [],
      SEMIS: [],
      FINAL: [],
    }),
    leaderboardMusicUrl: '',
    semisMatches: null,
    finalMatch: null,
  });

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim() && roomId.trim()) {
      setIsConnecting(true);
      setConnectionError(null);
      peerService.connect(roomId.trim());
      
      // Send join message immediately - it will be queued if connection is not ready
      peerService.send({ type: 'JOIN_TEAM', name: teamName });

      // Safety timeout for connection
      setTimeout(() => {
        setIsConnecting(prev => {
          if (prev) {
            setConnectionError("La connessione sta impiegando troppo tempo. Assicurati che l'Admin abbia già effettuato l'accesso e che la tua rete non blocchi WebRTC.");
            return false;
          }
          return false;
        });
      }, 20000);
    }
  };

  const handleBuzz = () => {
    if (myTeam) {
      peerService.send({ type: 'BUZZ', teamId: myTeam.id });
    }
  };

  const handleAnswer = (idx: number) => {
    if (myTeam && gameState?.isQuestionActive && gameState.selectedAnswers[myTeam.id] === undefined) {
      setPendingAnswer(idx);
      setShowConfirmation(true);
    }
  };

  const confirmAnswer = () => {
    if (myTeam && pendingAnswer !== null) {
      peerService.send({ type: 'SUBMIT_ANSWER', teamId: myTeam.id, answerIndex: pendingAnswer });
      setPendingAnswer(null);
      setShowConfirmation(false);
    }
  };

  const handleRoleSelect = (role: 'TEAM' | 'ADMIN' | 'LEADERBOARD') => {
    setUserRole(role);
    if (role === 'TEAM') {
      setIsAdmin(false);
      setIsLeaderboard(false);
      setView('APP');
    } else {
      setView('PASSWORD');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '12345678') {
      if (userRole === 'ADMIN') {
        setIsAdmin(true);
        setIsLeaderboard(false);
        // Start hosting if Admin - always start from zero when creating a new room
        localStorage.removeItem('gameState');
        const initialState = createInitialState();
        peerService.startHost(initialState);
        setGameState(initialState);
        setMyPeerId(peerService.getPeerId() || null);
      } else if (userRole === 'LEADERBOARD') {
        setIsAdmin(false);
        setIsLeaderboard(true);
        // Leaderboard can either host or connect
        // For simplicity, let's assume Admin hosts and Leaderboard connects
        if (roomId.trim()) {
          setIsConnecting(true);
          setConnectionError(null);
          peerService.connect(roomId.trim());
          
          setTimeout(() => {
            setIsConnecting(prev => {
              if (prev && !gameState) {
                setConnectionError("La connessione della Leaderboard sta impiegando troppo tempo. Assicurati che l'Admin sia online e che l'ID sia corretto.");
                return false;
              }
              return false;
            });
          }, 20000);
        } else {
          const savedState = localStorage.getItem('gameState');
          const initialState = savedState ? JSON.parse(savedState) : createInitialState();
          peerService.startHost(initialState);
          setGameState(initialState);
          setMyPeerId(peerService.getPeerId() || null);
        }
      }
      setView('APP');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (view === 'SELECTION') {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
        {/* Theme Toggle in Selection Screen */}
        <div className="fixed top-6 right-6 z-50">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </div>
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[100px]" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[3rem] p-10 shadow-[0_30px_100px_rgba(0,0,0,0.08)] space-y-12 relative z-10"
        >
          <div className="text-center space-y-2">
            <motion.button 
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsRolePopupOpen(true)}
              className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 cursor-pointer hover:bg-emerald-500/20 transition-all group relative"
            >
              <Trophy className="w-10 h-10 text-emerald-500 group-hover:scale-110 transition-transform" />
              <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 p-2 rounded-xl shadow-sm">
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
              </div>
            </motion.button>
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-zinc-950 dark:text-white tracking-tight">
                Benvenuto <span className="text-emerald-500">al Quiz</span>
              </h1>
              <div className="flex items-center justify-center gap-3">
                <div className="h-[1px] w-12 bg-zinc-200 dark:bg-zinc-800" />
                <p className="text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-[0.4em] text-sm">2001 Domande</p>
                <div className="h-[1px] w-12 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.9, rotate: -1 }}
              onClick={() => handleRoleSelect('TEAM')}
              className="w-full py-10 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-[3rem] transition-all flex flex-col items-center justify-center gap-4 shadow-[0_20px_50px_rgba(16,185,129,0.3)] group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/30 to-transparent rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              
              <div className="w-16 h-16 bg-zinc-950/10 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-zinc-950/20 transition-all duration-500 relative z-10">
                <Users className="w-8 h-8 text-zinc-950" />
              </div>
              
              <div className="space-y-1 relative z-10">
                <span className="text-2xl tracking-tight block">ACCEDI COME SQUADRA</span>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-950/60 font-bold uppercase tracking-[0.2em]">
                  <span className="w-1 h-1 bg-zinc-950 rounded-full animate-pulse" />
                  <span>Inizia la sfida</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* Role Selection Popup */}
        <AnimatePresence>
          {isRolePopupOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsRolePopupOpen(false)}
                className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl relative z-10 space-y-6"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black text-zinc-950 dark:text-white uppercase tracking-tight">Opzioni Avanzate</h2>
                  <button 
                    onClick={() => setIsRolePopupOpen(false)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>

                <div className="grid gap-3">
                  <button
                    onClick={() => {
                      setIsRolePopupOpen(false);
                      handleRoleSelect('LEADERBOARD');
                    }}
                    className="w-full p-5 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-zinc-950 dark:text-white font-bold transition-all flex items-center gap-4 group text-left"
                  >
                    <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <ListOrdered className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-black">Leaderboard</p>
                      <p className="text-[10px] text-zinc-400 font-medium">Visualizza la classifica</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsRolePopupOpen(false);
                      handleRoleSelect('ADMIN');
                    }}
                    className="w-full p-5 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-zinc-950 dark:text-white font-bold transition-all flex items-center gap-4 group text-left"
                  >
                    <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Settings className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-black">Crea Stanza</p>
                      <p className="text-[10px] text-zinc-400 font-medium">Pannello di controllo</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (view === 'PASSWORD') {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-6 transition-colors duration-500">
        <div className="fixed top-6 right-6 z-50">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-zinc-950 dark:text-white">Accesso Riservato</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Inserisci la password per {userRole}</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {userRole === 'LEADERBOARD' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">ID Stanza</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Es. 12345678"
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-5 py-4 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={cn(
                  "w-full bg-white dark:bg-zinc-800 border rounded-2xl px-5 py-4 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all",
                  passwordError ? "border-red-500" : "border-zinc-200 dark:border-zinc-700"
                )}
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-xs font-bold ml-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Password non corretta
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setView('SELECTION')}
                className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
              >
                Indietro
              </button>
              <button
                type="submit"
                className="flex-[2] py-4 bg-emerald-500 text-zinc-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all"
              >
                Accedi
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  if (!audioEnabled && isLeaderboard) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-6 transition-colors duration-500">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-zinc-50 border border-zinc-200 p-8 rounded-3xl text-center max-w-sm space-y-6 shadow-2xl"
        >
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2 text-zinc-950">Attiva Audio</h3>
            <p className="text-zinc-600 text-sm">Clicca per abilitare la musica e gli effetti sonori del gioco.</p>
          </div>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                setAudioEnabled(true);
                
                // Initialize and unlock AudioContext
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioCtxRef.current = ctx;
                if (ctx.state === 'suspended') ctx.resume();

                // Unlock audio elements and connect to context
                [leaderboardMusicRef.current].forEach(a => {
                  if (a) {
                    a.play().then(() => {
                      a.pause();
                      a.currentTime = 0;
                    }).catch(() => {});
                  }
                });
                
                // We call the logic directly here because audioEnabled state isn't updated yet
                if (isLeaderboard) {
                  try {
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.connect(g);
                    g.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(880, ctx.currentTime); 
                    g.gain.setValueAtTime(0.2, ctx.currentTime);
                    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.2);
                  } catch (e) {}
                }
              }}
              className="w-full py-4 bg-emerald-500 text-zinc-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Abilita Audio e Inizia
            </button>
            <button 
              onClick={() => {
                if (isLeaderboard) playSyntheticSound('beep');
              }}
              className="w-full py-3 bg-zinc-100 text-zinc-500 font-bold rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 text-sm"
            >
              Prova Suono (Test)
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard gameState={gameState!} playSyntheticSound={playSyntheticSound} onBack={() => setView('SELECTION')} myPeerId={myPeerId} theme={theme} toggleTheme={toggleTheme} leaderboardMusicRef={leaderboardMusicRef} />;
  }

    if (isLeaderboard) {
      if (!gameState) {
        return (
          <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-6 transition-colors duration-500">
            <div className="fixed top-6 right-6 z-50">
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            </div>
            <div className="text-center space-y-6 max-w-xs">
              {connectionError ? (
                <>
                  <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-zinc-950 dark:text-white">Errore di Connessione</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">{connectionError}</p>
                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl space-y-2 mt-4 text-left">
                      <p className="text-[10px] text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        Consigli per la connessione:
                      </p>
                      <ul className="text-[10px] text-amber-700 dark:text-amber-500/80 space-y-1 list-disc pl-4">
                        <li>Assicurati che l'Admin abbia già effettuato l'accesso alla Dashboard.</li>
                        <li>Se sei su rete mobile (4G/5G), prova a passare al Wi-Fi.</li>
                        <li>Verifica che l'ID Stanza sia esattamente lo stesso mostrato dall'Admin.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        peerService.reset();
                        peerService.connect(roomId.trim());
                        setConnectionError(null);
                        setIsConnecting(true);
                      }}
                      className="w-full py-4 bg-emerald-500 text-zinc-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all"
                    >
                      Riprova
                    </button>
                    <button
                      onClick={() => setView('SELECTION')}
                      className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                    >
                      Torna Indietro
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-zinc-500 dark:text-zinc-400 font-bold animate-pulse">Connessione alla stanza...</p>
                </>
              )}
            </div>
          </div>
        );
      }
      return <Leaderboard gameState={gameState} audioEnabled={audioEnabled} playSyntheticSound={playSyntheticSound} onBack={() => setView('SELECTION')} myPeerId={myPeerId} theme={theme} toggleTheme={toggleTheme} isAdmin={isAdmin} roomId={roomId} leaderboardMusicRef={leaderboardMusicRef} />;
    }

  if (!myTeam) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-6 transition-colors duration-500">
        <div className="fixed top-6 right-6 z-50">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl relative"
        >
          <button
            onClick={() => setView('SELECTION')}
            className="absolute top-6 left-6 p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
            title="Torna alla selezione"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
              <Trophy className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-zinc-950 dark:text-white text-center mb-2">2001 Domande</h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-center mb-8">Inserisci l'ID della stanza e il nome della tua squadra</p>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">ID Stanza</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Es. 12345678"
                  className={cn(
                    "w-full bg-white dark:bg-zinc-800 border rounded-2xl px-5 py-4 text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all",
                    connectionError ? "border-red-200" : "border-zinc-200 dark:border-zinc-700"
                  )}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">Nome Squadra</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Es. I Geni del Quiz"
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-5 py-4 text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  required
                />
              </div>
            </div>

            {connectionError && (
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium leading-relaxed">{connectionError}</p>
                    <p className="text-[10px] text-red-400 dark:text-red-500/60 italic">Consiglio: Se sei su rete mobile, prova a collegarti al Wi-Fi dell'Admin.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    peerService.reset();
                    handleJoin({ preventDefault: () => {} } as any);
                  }}
                  className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Riprova Connessione
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isConnecting}
              className={cn(
                "w-full py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 font-bold",
                isConnecting ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
              )}
            >
              {isConnecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-500 rounded-full animate-spin" />
                  Connessione...
                </>
              ) : (
                <>
                  Entra in partita
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {savedTeam && (
            <div className="mt-8 pt-8 border-t border-zinc-200">
              <p className="text-center text-xs text-zinc-500 uppercase tracking-widest font-bold mb-4">Oppure riconnettiti</p>
              <button
                onClick={() => setMyTeam(savedTeam)}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Continua come {savedTeam.name}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center transition-colors duration-500">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-zinc-500 font-bold animate-pulse">Sincronizzazione dati...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white flex flex-col transition-colors duration-500">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-zinc-950">Confermi la risposta?</h3>
                <p className="text-zinc-500">Hai scelto la risposta <span className="font-bold text-emerald-500">{String.fromCharCode(65 + (pendingAnswer ?? 0))}</span></p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmAnswer}
                  className="w-full py-4 bg-emerald-500 text-zinc-950 font-black rounded-2xl hover:bg-emerald-400 transition-all"
                >
                  Sì, conferma
                </button>
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    setPendingAnswer(null);
                  }}
                  className="w-full py-4 bg-zinc-100 text-zinc-500 font-bold rounded-2xl hover:bg-zinc-200 transition-all"
                >
                  No, cambia
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-4 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
          </div>
          <div className="max-w-[120px] sm:max-w-none">
            <h2 className="font-bold text-xs sm:text-sm leading-tight truncate dark:text-white">{myTeam.name}</h2>
            <p className="text-[8px] sm:text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{myTeam.status}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          <TimerDisplay seconds={gameState.timer} active={gameState.timerActive} endTime={gameState.timerEndTime} />
          <div className="text-right">
            <p className="text-[8px] sm:text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5 sm:mb-1">Punti</p>
            <p className="text-lg sm:text-xl font-black text-emerald-500">
              {gameState.teams.find(t => t.id === myTeam.id)?.score ?? 0}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {gameState.phase === 'LOBBY' && (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-6"
            >
              <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500/20">
                <Users className="w-10 h-10 text-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-950 dark:text-white">In attesa dell'host...</h1>
              <p className="text-zinc-600 dark:text-zinc-400">La partita inizierà a breve. Preparati!</p>
              
              <button
                onClick={() => {
                  if (myTeam) {
                    peerService.send({ type: 'LEAVE_TEAM', teamId: myTeam.id });
                    setMyTeam(null);
                    localStorage.removeItem('myTeam');
                  }
                }}
                className="text-zinc-500 hover:text-zinc-950 text-sm font-bold flex items-center gap-2 mx-auto transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cambia squadra o esci
              </button>

              <div className="flex flex-wrap justify-center gap-2 mt-8">
                {gameState.teams.map(t => (
                  <span key={t.id} className="px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-full text-xs text-zinc-500">
                    {t.name}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {gameState.phase.startsWith('QUAL_') && gameState.phase !== 'QUAL_RESULTS' && (
            <motion.div 
              key="qual"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-[0.2em]">
                  Round {gameState.round} | {gameState.phase === 'QUAL_1' ? 'Cultura Generale' : 
                   gameState.phase === 'QUAL_2' ? 'Arti' : 
                   gameState.phase === 'QUAL_3' ? 'Storia e Geopolitica' : 'Qualificazioni'}
                </span>
                <h2 className="text-6xl font-black">Domanda {gameState.currentQuestionIndex}/10</h2>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 text-center shadow-2xl space-y-8">
                {gameState.isQuestionActive && gameState.currentQuestion ? (
                  <>
                    {gameState.selectedAnswers[myTeam.id] !== undefined ? (
                      <div className="py-12 flex flex-col items-center gap-6">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <p className="text-3xl font-black text-emerald-500 uppercase tracking-tighter text-center">In attesa della prossima domanda... Preparatevi!</p>
                        
                        {gameState.answerTimes[myTeam.id] <= 5 && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex items-center gap-2 bg-amber-500 text-zinc-950 px-4 py-2 rounded-full font-black text-sm uppercase tracking-widest shadow-lg"
                          >
                            <Zap className="w-4 h-4 fill-current" />
                            Risposta Veloce! (+3 punti)
                          </motion.div>
                        )}

                        <div className="w-full max-w-md space-y-4">
                          <div className="p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-zinc-400">La tua risposta</p>
                            <p className="text-xl font-bold text-zinc-900 dark:text-white">
                              {String.fromCharCode(65 + (gameState.selectedAnswers[myTeam.id] ?? 0))}: {gameState.currentQuestion.options?.[gameState.selectedAnswers[myTeam.id] ?? 0]}
                            </p>
                          </div>

                          {gameState.isQuestionFinished && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-6 bg-zinc-950 text-white rounded-3xl shadow-xl border border-zinc-800"
                            >
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-emerald-500">Risposta Corretta</p>
                              <p className="text-2xl font-black">
                                {String.fromCharCode(65 + (gameState.currentQuestion.correctAnswer ?? 0))}: {gameState.currentQuestion.options?.[gameState.currentQuestion.correctAnswer ?? 0]}
                              </p>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-zinc-950 dark:text-white">{gameState.currentQuestion.text}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {gameState.currentQuestion.options?.map((option, idx) => (
                            <button
                              key={idx}
                              disabled={!gameState.isQuestionActive || gameState.selectedAnswers[myTeam.id] !== undefined}
                              onClick={() => handleAnswer(idx)}
                              className={cn(
                                "bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-6 text-left transition-all flex items-center gap-4 group relative overflow-hidden",
                                gameState.selectedAnswers[myTeam.id] === idx 
                                  ? "border-emerald-500 bg-emerald-500/10" 
                                  : gameState.selectedAnswers[myTeam.id] !== undefined
                                    ? "border-zinc-200 opacity-50 cursor-not-allowed"
                                    : "border-zinc-200 hover:bg-zinc-100 active:scale-95"
                              )}
                            >
                              {gameState.selectedAnswers[myTeam.id] === idx && (
                                <motion.div 
                                  initial={{ x: '-100%' }}
                                  animate={{ x: '100%' }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent"
                                />
                              )}
                              <div className={cn(
                                "w-10 h-10 rounded-xl border flex items-center justify-center font-black transition-colors relative z-10",
                                gameState.selectedAnswers[myTeam.id] === idx
                                  ? "bg-emerald-500 text-zinc-950 border-emerald-400"
                                  : "bg-zinc-50 border-zinc-200 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-zinc-950"
                              )}>
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <span className={cn(
                                "font-bold transition-colors relative z-10",
                                gameState.selectedAnswers[myTeam.id] === idx ? "text-zinc-950" : "text-zinc-700 group-hover:text-zinc-950"
                              )}>{option}</span>
                              {gameState.selectedAnswers[myTeam.id] === idx && (
                                <CheckCircle2 className="w-6 h-6 text-emerald-500 ml-auto relative z-10" />
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="py-12 flex flex-col items-center gap-6">
                    {gameState.isQuestionFinished && gameState.currentQuestion && (
                       <div className="w-full max-w-md space-y-4">
                          <div className="p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm text-center relative overflow-hidden">
                            {gameState.phase.startsWith('QUAL_') && 
                             gameState.selectedAnswers[myTeam.id] === gameState.currentQuestion.correctAnswer && 
                             gameState.answerTimes?.[myTeam.id] !== undefined &&
                             gameState.answerTimes[myTeam.id] <= 3 && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                className="absolute top-2 right-2 bg-amber-500 text-zinc-950 text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg z-20"
                              >
                                <Zap className="w-3 h-3" />
                                BONUS VELOCITÀ +3
                              </motion.div>
                            )}
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-zinc-400">La tua risposta</p>
                            <p className="text-xl font-bold text-zinc-900 dark:text-white">
                              {gameState.selectedAnswers[myTeam.id] !== undefined 
                                ? `${String.fromCharCode(65 + (gameState.selectedAnswers[myTeam.id] ?? 0))}: ${gameState.currentQuestion.options?.[gameState.selectedAnswers[myTeam.id] ?? 0]}`
                                : "Nessuna risposta data"}
                            </p>
                          </div>

                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-6 bg-zinc-950 text-white rounded-3xl w-full shadow-xl text-center border border-zinc-800"
                          >
                             <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-emerald-500">Risposta Corretta</p>
                             <p className="text-2xl font-black">
                               {String.fromCharCode(65 + (gameState.currentQuestion.correctAnswer ?? 0))}: {gameState.currentQuestion.options?.[gameState.currentQuestion.correctAnswer ?? 0]}
                             </p>
                          </motion.div>
                       </div>
                    )}
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center animate-pulse">
                      <Zap className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
                    </div>
                    <p className="text-3xl font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em]">Prossima Domanda</p>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">L'host sta preparando la sfida...</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {gameState.phase === 'QUAL_RESULTS' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-8"
            >
              {myTeam.status === 'qualificata' || myTeam.status === 'in semifinale' ? (
                <>
                  <div className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                  </div>
                  <h1 className="text-5xl font-black text-zinc-950">QUALIFICATI!</h1>
                  <p className="text-zinc-600 text-xl font-bold">Complimenti! Hai passato il turno</p>
                </>
              ) : (
                <>
                  <div className="w-32 h-32 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="w-16 h-16 text-zinc-400" />
                  </div>
                  <h1 className="text-5xl font-black text-zinc-400">FINE CORSA</h1>
                  <p className="text-zinc-500 text-xl font-bold">Il tuo percorso si chiude qua</p>
                </>
              )}
            </motion.div>
          )}

          {(gameState.phase.startsWith('SEMIS_') || gameState.phase === 'FINAL') && (
            <motion.div 
              key="buzz-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex flex-col items-center gap-4 sm:gap-8"
            >
              <div className="text-center space-y-2">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em]">
                  {gameState.phase === 'SEMIS' ? 'Semifinale' : 'Finale'}
                </span>
                <h2 className="text-4xl font-black">Domanda {gameState.currentQuestionIndex}</h2>
              </div>

              {gameState.isQuestionActive && gameState.currentQuestion ? (
                <div className="w-full space-y-4 sm:space-y-8">
                  <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-8 text-center w-full shadow-2xl">
                    <p className="text-xl sm:text-3xl font-bold text-zinc-950 dark:text-white leading-tight">{gameState.currentQuestion.text}</p>
                  </div>

                  {gameState.currentQuestion.options && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full">
                      {gameState.currentQuestion.options.map((option, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 sm:p-6 text-left flex items-center gap-2 sm:gap-4 opacity-50 cursor-not-allowed group"
                        >
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-center font-black text-zinc-400 text-xs sm:text-base">
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="text-zinc-500 font-bold text-xs sm:text-base line-clamp-2">{option}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center w-full flex flex-col items-center gap-6">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center animate-pulse">
                    <Zap className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
                  </div>
                  <p className="text-3xl font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em]">Prossima Domanda</p>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">L'host sta preparando la sfida...</p>
                </div>
              )}

              {gameState.isQuestionActive && (gameState.phase.startsWith('SEMIS_') || gameState.phase === 'FINAL') && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBuzz}
                  disabled={gameState.buzzes.some(b => b.teamId === myTeam?.id)}
                  className={cn(
                    "w-32 h-32 sm:w-48 sm:h-48 rounded-full border-4 sm:border-8 flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all shadow-[0_0_30px_rgba(245,158,11,0.2)] relative overflow-hidden",
                    gameState.buzzes.some(b => b.teamId === myTeam?.id)
                      ? "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
                      : "bg-amber-500 border-amber-400 text-zinc-950 hover:bg-amber-400 hover:shadow-[0_0_60px_rgba(245,158,11,0.4)] active:scale-90"
                  )}
                >
                  {!gameState.buzzes.some(b => b.teamId === myTeam?.id) && (
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.3, 0.1] 
                      }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute inset-0 bg-white rounded-full"
                    />
                  )}
                  <Zap className={cn("w-10 h-10 sm:w-16 sm:h-16 relative z-10", !gameState.buzzes.some(b => b.teamId === myTeam?.id) && "animate-pulse")} />
                  <span className="text-sm sm:text-xl font-black uppercase tracking-tighter relative z-10">BUZZ</span>
                </motion.button>
              )}
              
              {gameState.buzzes.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-6 py-4 flex items-center gap-4 shadow-lg"
                >
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-zinc-950" />
                  </div>
                  <p className="font-bold text-zinc-950">
                    {gameState.teams.find(t => t.id === gameState.buzzes[0].teamId)?.name} ha premuto!
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {gameState.phase === 'FINISHED' && (
            <motion.div 
              key="finished"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse" />
                <Trophy className="w-48 h-48 text-emerald-500 mx-auto relative" />
              </div>
              <h1 className="text-6xl font-black">PARTITA FINITA</h1>
              <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8">
                <p className="text-zinc-500 uppercase tracking-widest font-bold mb-2">Vincitore</p>
                <p className="text-4xl font-black text-emerald-500">
                  {gameState.teams.find(t => t.status === 'vincitrice')?.name || '---'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Stats */}
      <footer className="p-6 border-t border-zinc-200 bg-zinc-50/30">
        <div className="max-w-2xl mx-auto flex justify-between items-center text-xs text-zinc-500 font-bold uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", gameState.isQuestionActive ? "bg-emerald-500" : "bg-red-500")} />
            {gameState.isQuestionActive ? 'Domanda Attiva' : 'In Pausa'}
          </div>
          <div>Fase: {gameState.phase}</div>
        </div>
      </footer>
    </div>
  );
}

function AdminDashboard({ gameState, playSyntheticSound, onBack, myPeerId, theme, toggleTheme, leaderboardMusicRef }: { gameState: GameState, playSyntheticSound: (type: 'beep' | 'siren' | 'countdown' | 'start' | 'finish' | 'buzz') => void, onBack: () => void, myPeerId: string | null, theme: 'light' | 'dark', toggleTheme: () => void, leaderboardMusicRef: React.RefObject<HTMLAudioElement> }) {
  const [uploadPhase, setUploadPhase] = useState<string>(gameState.phase === 'LOBBY' ? 'QUAL_1' : gameState.phase);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { 'default': true };
    PRELOADED_QUESTIONS.forEach(f => { initial[f.name] = f.name === 'Cultura Generale - Facile'; });
    return initial;
  });
  const [isMusicUploading, setIsMusicUploading] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  // Memoize sendAction to avoid re-renders and lag
  const sendAction = useCallback((action: string, payload: any = {}) => {
    // Some actions are top-level, others are ADMIN_ACTION
    const topLevelActions = ['SET_LEADERBOARD_MUSIC', 'SET_ROUND', 'REORDER_QUEUE'];
    if (topLevelActions.includes(action)) {
      peerService.send({ type: action as any, payload });
    } else {
      peerService.send({ type: 'ADMIN_ACTION', action, payload });
    }
  }, []);

  const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsMusicUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        sendAction('SET_LEADERBOARD_MUSIC', { url: base64 });
        alert("Musica caricata con successo!");
        setIsMusicUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Music upload error:", err);
      alert("Errore durante il caricamento della musica.");
      setIsMusicUploading(false);
    }
  };

  const availableQuestions = gameState.allQuestions[gameState.phase] || [];
  const allQuestionsFlat = useMemo(() => {
    const stateQuestions = Object.values(gameState.allQuestions).flat();
    const preloadedQuestions = PRELOADED_QUESTIONS.flatMap(f => f.questions);
    // Combine both, ensuring no duplicates by ID
    const combined = [...preloadedQuestions];
    stateQuestions.forEach(q => {
      if (!combined.some(existing => existing.id === q.id)) {
        combined.push(q);
      }
    });
    return combined;
  }, [gameState]);
  
  // Group ALL questions from ALL sources (Preloaded + Uploaded + Manual)
  const questionsBySource = useMemo(() => {
    const acc: Record<string, Question[]> = {};
    
    // 1. Add Preloaded Questions
    PRELOADED_QUESTIONS.forEach(folder => {
      let sourceName = folder.name;
      // Normalizzazione: se contiene "PDF 1", "PDF 2", ecc. usa quel prefisso
      const pdfMatch = sourceName.match(/PDF\s*(\d)/i);
      if (pdfMatch) {
        sourceName = `PDF ${pdfMatch[1]}`;
      }
      
      if (!acc[sourceName]) acc[sourceName] = [];
      
      const filteredQs = folder.questions.filter(q => 
        q.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      filteredQs.forEach(q => {
        if (!acc[sourceName].some(existing => existing.id === q.id)) {
          acc[sourceName].push(q);
        }
      });
    });

    // 2. Add Questions from State (Uploaded/Manual)
    allQuestionsFlat.forEach(q => {
      let source = q.source || 'Manuale';
      
      const pdfMatch = source.match(/PDF\s*(\d)/i);
      if (pdfMatch) {
        source = `PDF ${pdfMatch[1]}`;
      }

      if (!acc[source]) acc[source] = [];
      if (!acc[source].some(existing => existing.id === q.id)) {
        if (q.text.toLowerCase().includes(searchQuery.toLowerCase())) {
          acc[source].push(q);
        }
      }
    });

    return acc;
  }, [allQuestionsFlat, searchQuery]);

  const toggleSource = (source: string) => {
    setExpandedSources(prev => ({ ...prev, [source]: !prev[source] }));
  };

  const moveQueueItem = (index: number, direction: 'up' | 'down') => {
    const newQueue = [...gameState.questionQueue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;
    
    [newQueue[index], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[index]];
    sendAction('REORDER_QUEUE', { queue: newQueue });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white p-4 sm:p-8 transition-colors duration-500">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        <header className="flex flex-col lg:flex-row justify-between items-center gap-6 text-center lg:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <button
              onClick={onBack}
              className="p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
              title="Torna alla selezione"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center shrink-0">
              <Settings className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black">Admin Dashboard</h1>
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-2">
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">ID Stanza: <span className="font-black text-emerald-500">{myPeerId || 'Inizializzazione...'}</span></p>
                  <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    myPeerId ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                  )} title={myPeerId ? "Connesso al server" : "Connessione..."} />
                  {myPeerId && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(myPeerId);
                        alert("ID Stanza copiato!");
                      }}
                      className="p-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-400 hover:text-emerald-500 transition-all"
                      title="Copia ID"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                  {gameState.leaderboardMusicUrl && (
                    <button 
                      onClick={() => {
                        if (leaderboardMusicRef.current) {
                          if (leaderboardMusicRef.current.paused) {
                            leaderboardMusicRef.current.play().catch(console.error);
                          } else {
                            leaderboardMusicRef.current.pause();
                          }
                        }
                      }}
                      className="p-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-400 hover:text-emerald-500 transition-all"
                      title="Play/Pause Musica"
                    >
                      <Zap className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
                  <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Sei su mobile: usa il Wi-Fi per evitare blocchi di rete
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full lg:w-auto">
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <TimerDisplay seconds={gameState.timer} active={gameState.timerActive} endTime={gameState.timerEndTime} />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              {(gameState.phase.startsWith('QUAL_') || gameState.phase.startsWith('SEMIS_') || gameState.phase === 'FINAL') && gameState.phase !== 'QUAL_RESULTS' && (
                <>
                  <button onClick={() => sendAction('NEXT_QUESTION')} className="px-6 py-3 bg-emerald-500 text-zinc-950 font-black rounded-2xl hover:bg-emerald-400 transition-all text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    Prossima Domanda
                  </button>
                  <button onClick={() => sendAction('TOGGLE_QUESTION')} className={cn("px-6 py-3 font-black rounded-2xl transition-all text-sm", gameState.isQuestionActive ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20")}>
                    {gameState.isQuestionActive ? 'Ferma Tempo' : 'Attiva Domanda'}
                  </button>
                </>
              )}
              <button 
                onClick={() => setShowManualEntry(true)}
                className="flex-1 sm:flex-none px-6 py-3 bg-zinc-950 text-white rounded-2xl font-black hover:bg-zinc-800 transition-all text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Domande
              </button>
              {gameState.phase === 'LOBBY' && (
                <button 
                  onClick={() => sendAction('START_GAME')}
                  className="flex-1 sm:flex-none px-6 py-3 bg-emerald-500 text-zinc-950 rounded-2xl font-black hover:bg-emerald-400 transition-all text-sm"
                >
                  Inizia Partita
                </button>
              )}
              <button 
                onClick={() => {
                  if (confirm("Sei sicuro di voler resettare l'intera partita? Tutti i punteggi verranno azzerati.")) {
                    sendAction('RESET_GAME');
                  }
                }}
                className="flex-1 sm:flex-none px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold hover:bg-red-500/20 transition-all text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        </header>

        {/* Question Library Section */}
        <section className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-black text-zinc-950 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                Libreria Domande
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Seleziona le domande dai PDF caricati o dalle cartelle predefinite</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 shadow-sm">
                <Search className="w-3 h-3 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Cerca domanda..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs bg-transparent outline-none w-32 sm:w-48 text-zinc-950 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Destinazione:</span>
                <select 
                  value={uploadPhase}
                  onChange={(e) => setUploadPhase(e.target.value)}
                  className="text-xs font-bold text-emerald-600 bg-transparent outline-none cursor-pointer"
                >
                  <option value="QUAL_1">Qualificazioni 1</option>
                  <option value="QUAL_2">Qualificazioni 2</option>
                  <option value="QUAL_3">Qualificazioni 3</option>
                  <option value="SEMIS">Semifinali</option>
                  <option value="FINAL">Finale</option>
                </select>
              </div>
              <button 
                onClick={() => {
                  if (window.confirm('Sei sicuro di voler svuotare tutta la libreria domande (escluse quelle precaricate)?')) {
                    sendAction('CLEAR_ALL_QUESTIONS', {});
                  }
                }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl border border-zinc-200 transition-all shadow-sm"
                title="Svuota Libreria"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(questionsBySource).map(([source, questions]) => {
              const qs = questions as Question[];
              return (
                <div key={source} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden group hover:border-emerald-500/50 transition-all shadow-sm">
                  <div className="p-4 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                        <Folder className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 truncate">{source}</p>
                        <p className="text-[10px] text-zinc-400 font-medium">{qs.length} domande</p>
                      </div>
                    </div>
                    {!PRELOADED_QUESTIONS.some(f => f.name === source) && (
                      <button 
                        onClick={() => sendAction('REMOVE_FILE', { fileName: source })}
                        className="p-2 text-zinc-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="p-2">
                    <button 
                      onClick={() => toggleSource(source)}
                      className="w-full py-2 px-3 text-[10px] font-bold text-zinc-500 hover:text-emerald-600 flex items-center justify-between rounded-lg hover:bg-emerald-50 transition-all"
                    >
                      {expandedSources[source] ? 'Nascondi domande' : 'Mostra domande'}
                      <ChevronRight className={cn("w-3 h-3 transition-transform", expandedSources[source] && "rotate-90")} />
                    </button>
                    <AnimatePresence>
                      {expandedSources[source] && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                            {qs.map(q => (
                              <div key={q.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-zinc-50 group/item">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {gameState.usedQuestionIds.includes(q.id) && (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                  )}
                                  <p className="text-[10px] text-zinc-600 truncate">{q.text}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => sendAction('ADD_QUESTIONS', { phase: uploadPhase, questions: [q], fileName: source })}
                                    className="p-1.5 bg-zinc-100 text-zinc-400 hover:bg-emerald-500 hover:text-white rounded-md transition-all"
                                    title={`Aggiungi a ${uploadPhase}`}
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                  <button 
                                    onClick={() => sendAction('ADD_TO_QUEUE', { question: q })}
                                    disabled={gameState.questionQueue.some(item => item === q.id)}
                                    className={cn(
                                      "p-1.5 rounded-md transition-all",
                                      gameState.questionQueue.some(item => item === q.id)
                                        ? "bg-emerald-50 text-emerald-500"
                                        : "bg-zinc-100 text-zinc-400 hover:bg-amber-500 hover:text-white"
                                    )}
                                    title="Metti in coda"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Music Management Section */}
        <section className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Musica per la Leaderboard
              </h3>
              <p className="text-[10px] text-zinc-500">
                L'audio verrà riprodotto in loop sulla leaderboard quando il timer è attivo.
              </p>
            </div>
            {gameState.leaderboardMusicUrl && (
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                MUSICA IMPOSTATA
              </span>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex gap-2 w-full sm:w-auto">
              <label className="flex-1 sm:flex-none px-6 py-3 bg-zinc-100 text-zinc-500 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer">
                <Plus className="w-4 h-4" />
                {isMusicUploading ? 'Caricamento...' : 'Carica MP3'}
                <input type="file" accept="audio/*" onChange={handleMusicUpload} className="hidden" disabled={isMusicUploading} />
              </label>
              {gameState.leaderboardMusicUrl && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (isMusicPlaying) {
                        testAudioRef.current?.pause();
                        setIsMusicPlaying(false);
                      } else {
                        if (!testAudioRef.current) {
                          testAudioRef.current = new Audio(gameState.leaderboardMusicUrl);
                          testAudioRef.current.onended = () => setIsMusicPlaying(false);
                        } else {
                          testAudioRef.current.src = gameState.leaderboardMusicUrl;
                        }
                        testAudioRef.current.play().catch(e => alert("Impossibile riprodurre l'audio: " + e.message));
                        setIsMusicPlaying(true);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-2xl border transition-all",
                      isMusicPlaying ? "bg-emerald-500 text-zinc-950 border-emerald-400" : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:text-zinc-950"
                    )}
                    title={isMusicPlaying ? "Ferma Test" : "Prova Audio"}
                  >
                    {isMusicPlaying ? <XCircle className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Sei sicuro di voler eliminare la musica caricata?")) {
                        if (isMusicPlaying) {
                          testAudioRef.current?.pause();
                          setIsMusicPlaying(false);
                        }
                        sendAction('DELETE_LEADERBOARD_MUSIC');
                      }
                    }}
                    className="p-3 bg-zinc-100 text-zinc-500 border border-zinc-200 rounded-2xl hover:text-red-500 hover:bg-red-500/10 transition-all"
                    title="Elimina Musica"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            {gameState.leaderboardMusicUrl && (
              <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-2xl w-full sm:w-auto overflow-hidden">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-xs text-zinc-500 truncate max-w-[200px]">
                  {gameState.leaderboardMusicUrl.includes('/uploads/') ? 'Musica Caricata' : 'Musica Predefinita'}
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Game Controls */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 space-y-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-950">
                <Zap className="w-5 h-5 text-emerald-500" />
                Stato Partita
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Round</p>
                    <p className="text-lg font-black text-emerald-500">{gameState.round}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => peerService.send({ type: 'SET_ROUND', round: gameState.round + 1 })} className="p-1 text-zinc-400 hover:text-emerald-500"><ArrowUp className="w-3 h-3" /></button>
                    <button onClick={() => peerService.send({ type: 'SET_ROUND', round: Math.max(1, gameState.round - 1) })} className="p-1 text-zinc-400 hover:text-emerald-500"><ArrowDown className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-zinc-200">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Domanda</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-black text-emerald-500">{gameState.currentQuestionIndex}/10</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => peerService.send({ type: 'PREVIOUS_QUESTION' })}
                        disabled={gameState.currentQuestionIndex <= 1}
                        className="p-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-400 hover:text-emerald-500 disabled:opacity-20"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-zinc-200">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Squadre</p>
                  <p className="text-lg font-black text-emerald-500">{gameState.teams.length}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-zinc-200">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Stato</p>
                  <p className={cn("text-lg font-black", gameState.isQuestionActive ? "text-emerald-500" : "text-red-500")}>
                    {gameState.isQuestionActive ? 'ATTIVA' : 'INATTIVA'}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-zinc-200">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Buzz</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-black text-amber-500">{gameState.buzzes.length}</p>
                    <button 
                      onClick={() => sendAction('CLEAR_BUZZES')}
                      disabled={gameState.buzzes.length === 0}
                      className="text-[10px] font-bold text-zinc-400 hover:text-zinc-950 disabled:opacity-20 uppercase tracking-widest"
                    >
                      Svuota
                    </button>
                  </div>
                </div>
              </div>

              {gameState.currentQuestion && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Domanda Corrente</p>
                  <p className="text-xl font-bold text-zinc-950">{gameState.currentQuestion.text}</p>
                  {gameState.currentQuestion.options && (
                    <div className="grid grid-cols-2 gap-2">
                      {gameState.currentQuestion.options.map((opt, i) => (
                        <div key={i} className={cn("p-3 rounded-xl border text-sm", i === gameState.currentQuestion?.correctAnswer ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 font-bold" : "bg-zinc-50 border-zinc-200 text-zinc-500")}>
                          {String.fromCharCode(65 + i)}: {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Question Queue Section */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <ListOrdered className="w-4 h-4" />
                  Coda Domande ({gameState.questionQueue.length})
                </h3>
                <div className="space-y-2">
                  {gameState.questionQueue.map((qId, idx) => {
                    const q = allQuestionsFlat.find(item => item.id === qId);
                    if (!q) return null;
                    return (
                      <div key={`${qId}-${idx}`} className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                        <span className="w-6 h-6 bg-zinc-200 rounded-lg flex items-center justify-center text-[10px] font-black text-zinc-500">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-700 truncate">{q.text}</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold">{q.source || 'default'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveQueueItem(idx, 'up')} disabled={idx === 0} className="p-1.5 text-zinc-400 hover:text-emerald-500 disabled:opacity-20"><ArrowUp className="w-4 h-4" /></button>
                          <button onClick={() => moveQueueItem(idx, 'down')} disabled={idx === gameState.questionQueue.length - 1} className="p-1.5 text-zinc-400 hover:text-emerald-500 disabled:opacity-20"><ArrowDown className="w-4 h-4" /></button>
                          <button onClick={() => sendAction('REMOVE_FROM_QUEUE', { questionId: qId })} className="p-1.5 text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {gameState.questionQueue.length === 0 && (
                    <p className="text-center text-zinc-400 text-sm py-4 italic">Coda vuota. Aggiungi domande dalla lista sotto.</p>
                  )}
                </div>
              </div>

              {/* Next Question Selector (Grouped by Source) - REMOVED DUPLICATE */}

              <div className="flex flex-wrap gap-4 pt-4 items-center">
                {(gameState.phase.startsWith('QUAL_')) && (
                  <>
                    {gameState.showRoundWinner && (
                      <button onClick={() => sendAction('START_NEXT_ROUND')} className="px-8 py-4 bg-amber-500 text-zinc-950 font-black rounded-2xl hover:bg-amber-400 transition-all animate-bounce">
                        Avvia Prossimo Round
                      </button>
                    )}
                  </>
                )}
                {gameState.phase === 'QUAL_RESULTS' && (
                  <button onClick={() => sendAction('START_SEMIS')} className="px-8 py-4 bg-amber-500 text-zinc-950 font-black rounded-2xl hover:bg-amber-400 transition-all">
                    Avvia Semifinale 1
                  </button>
                )}
                {gameState.phase === 'SEMIS_1' && gameState.showRoundWinner && (
                  <button onClick={() => sendAction('START_SEMIS_2')} className="px-8 py-4 bg-amber-500 text-zinc-950 font-black rounded-2xl hover:bg-amber-400 transition-all">
                    Avvia Semifinale 2
                  </button>
                )}
                {gameState.phase === 'SEMIS_2' && gameState.showRoundWinner && (
                  <button onClick={() => sendAction('START_FINAL')} className="px-8 py-4 bg-purple-500 text-white font-black rounded-2xl hover:bg-purple-400 transition-all animate-bounce">
                    Avvia Finale
                  </button>
                )}
              </div>
            </section>

            {/* Buzz List */}
            {gameState.buzzes.length > 0 && (
              <section className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-zinc-950">Ordine di Buzz</h3>
                  <button 
                    onClick={() => sendAction('RESET_BUZZES')}
                    className="text-[10px] font-bold text-zinc-500 hover:text-zinc-950 uppercase tracking-widest px-3 py-1 bg-zinc-100 rounded-lg border border-zinc-200 transition-all"
                  >
                    Resetta Buzz
                  </button>
                </div>
                <div className="space-y-2">
                  {gameState.buzzes.map((buzz, i) => (
                    <div key={buzz.teamId} className={cn("flex justify-between items-center p-4 rounded-2xl border", i === 0 ? "bg-emerald-500/10 border-emerald-500/30 ring-2 ring-emerald-500/20" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60")}>
                      <div className="flex items-center gap-4">
                        <span className={cn("w-8 h-8 flex items-center justify-center rounded-full font-black text-sm", i === 0 ? "bg-emerald-500 text-zinc-950" : "bg-zinc-100 text-zinc-500")}>
                          {i + 1}
                        </span>
                        <span className="font-bold text-lg text-zinc-950">{gameState.teams.find(t => t.id === buzz.teamId)?.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-zinc-400">+{((buzz.timestamp - gameState.buzzes[0].timestamp) / 1000).toFixed(3)}s</span>
                        {i === 0 && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => sendAction('CORRECT_BUZZ')}
                              className="px-3 py-1 bg-emerald-500 text-zinc-950 text-[10px] font-black rounded-lg hover:bg-emerald-400 uppercase"
                            >
                              Corretto (+10)
                            </button>
                            <button 
                              onClick={() => sendAction('INCORRECT_BUZZ')}
                              className="px-3 py-1 bg-red-500 text-white text-[10px] font-black rounded-lg hover:bg-red-400 uppercase"
                            >
                              Errato (-5)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Teams List */}
            <div className="space-y-8">
            <section className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 space-y-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-zinc-950">
                <Users className="w-5 h-5 text-emerald-500" />
                Squadre
              </h3>
              <div className="space-y-4">
                {[...gameState.teams]
                  .filter(t => {
                    if (gameState.phase.startsWith('SEMIS_')) return t.status === 'in semifinale';
                    if (gameState.phase === 'FINAL') return t.status === 'in finale' || t.status === 'vincitrice';
                    return true;
                  })
                  .sort((a, b) => b.score - a.score)
                  .map(team => (
                  <div key={team.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-zinc-950">{team.name}</p>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">{team.status}</p>
                      </div>
                      <p className="text-xl font-black text-emerald-500">{team.score}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => sendAction('UPDATE_SCORE', { teamId: team.id, amount: 1 })} className="flex-1 bg-zinc-50 hover:bg-zinc-100 p-2 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-500">+1</button>
                      <button onClick={() => sendAction('UPDATE_SCORE', { teamId: team.id, amount: -1 })} className="flex-1 bg-zinc-50 hover:bg-zinc-100 p-2 rounded-xl text-xs font-bold border border-zinc-200 text-zinc-500">-1</button>
                      <button onClick={() => sendAction('DELETE_TEAM', { teamId: team.id })} className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all">
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {gameState.teams.length === 0 && (
                  <p className="text-center text-zinc-400 italic py-8">Nessuna squadra collegata</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>

    <ManualEntryModal 
      isOpen={showManualEntry}
      onClose={() => setShowManualEntry(false)}
      onImport={(questions) => {
        sendAction('ADD_QUESTIONS', { phase: uploadPhase, questions, fileName: `Manuale_${new Date().toLocaleTimeString()}` });
        alert(`Caricate ${questions.length} domande manualmente nella fase ${uploadPhase}!`);
      }}
      currentPhase={uploadPhase}
    />
  </div>
);
}

function Leaderboard({ gameState, audioEnabled, playSyntheticSound, onBack, myPeerId, theme, toggleTheme, isAdmin, roomId, leaderboardMusicRef }: { gameState: GameState, audioEnabled: boolean, playSyntheticSound: (type: 'beep' | 'siren' | 'countdown' | 'start' | 'finish' | 'buzz') => void, onBack: () => void, myPeerId: string | null, theme: 'light' | 'dark', toggleTheme: () => void, isAdmin: boolean, roomId: string, leaderboardMusicRef: React.RefObject<any> }) {
  const sortedTeams = useMemo(() => {
    let teams = [...gameState.teams];
    if (gameState.phase.startsWith('QUAL_')) {
      // Show all teams during all qualification rounds
    } else if (gameState.phase === 'SEMIS_1') {
      if (gameState.semisMatches) {
        const m1 = gameState.semisMatches.match1;
        teams = teams.filter(t => t.id === m1.teamAId || t.id === m1.teamBId);
      } else {
        teams = teams.filter(t => t.status === 'in semifinale');
      }
    } else if (gameState.phase === 'SEMIS_2') {
      if (gameState.semisMatches) {
        const m2 = gameState.semisMatches.match2;
        teams = teams.filter(t => t.id === m2.teamAId || t.id === m2.teamBId);
      } else {
        teams = teams.filter(t => t.status === 'in semifinale');
      }
    } else if (gameState.phase === 'FINAL') {
      teams = teams.filter(t => t.status === 'in finale' || t.status === 'vincitrice');
    }
    return teams.sort((a, b) => b.score - a.score);
  }, [gameState.teams, gameState.phase, gameState.semisMatches]);

  const roundType = gameState.phase === 'QUAL_1' ? 'Cultura Generale' : 
                    gameState.phase === 'QUAL_2' ? 'Arti' : 
                    gameState.phase === 'QUAL_3' ? 'Storia e Geopolitica' : 
                    gameState.phase === 'SEMIS_1' ? 'Semifinale 1' : 
                    gameState.phase === 'SEMIS_2' ? 'Semifinale 2' : 
                    gameState.phase === 'FINAL' ? 'Finale' : 'Gara';

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white p-4 sm:p-8 flex flex-col items-center overflow-x-hidden transition-colors duration-500">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="fixed top-4 left-4 sm:top-8 sm:left-8 z-40 p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-all"
        title="Torna alla selezione"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Audio Status Indicator & Theme Toggle */}
      <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-40 flex flex-col gap-2">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <button 
          onClick={() => {
            // This button allows manual unlocking if needed
            playSyntheticSound('beep');
          }}
          className="p-3 bg-white border border-zinc-200 rounded-full text-zinc-400 hover:text-zinc-950 transition-all shadow-lg"
          title="Test Suono"
        >
          <Zap className="w-4 h-4" />
        </button>
        <div 
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg",
            audioEnabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-600"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full", audioEnabled ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
          Audio {audioEnabled ? 'Attivo' : 'Disattivato'}
        </div>
      </div>
      <AnimatePresence>
        {gameState.buzzes.length > 0 && gameState.isQuestionActive && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[80] w-full max-w-2xl px-4"
          >
            <div className="bg-amber-500 border-4 border-amber-400 rounded-[2rem] p-6 shadow-[0_20px_50px_rgba(245,158,11,0.4)] flex items-center gap-6 overflow-hidden relative">
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-20 h-20 bg-zinc-950 rounded-2xl flex items-center justify-center shrink-0"
              >
                <Zap className="w-10 h-10 text-amber-500" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-950 text-xs font-black uppercase tracking-[0.2em] mb-1">Prenotazione Risposta</p>
                <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 truncate uppercase tracking-tighter">
                  {gameState.teams.find(t => t.id === gameState.buzzes[0].teamId)?.name}
                </h2>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-20">
                <Zap className="w-32 h-32 text-zinc-950" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState.showRoundWinner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/95 dark:bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="w-32 h-32 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="w-16 h-16 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-4xl sm:text-6xl font-black text-zinc-950">Round {gameState.round} terminato</h2>
                <p className="text-xl sm:text-2xl text-zinc-500 font-medium">
                  Questo round è stato vinto dalla squadra:
                </p>
              </div>
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1.1 }}
                transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}
                className="text-5xl sm:text-8xl font-black text-amber-500 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]"
              >
                {gameState.roundWinner}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState.allTeamsAnswered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-4xl sm:text-7xl font-black text-zinc-950 uppercase tracking-tight">
                  Tutte le squadre hanno risposto
                </h2>
                <p className="text-xl sm:text-2xl text-zinc-400 font-bold uppercase tracking-widest animate-pulse">
                  Preparatevi per il prossimo round...
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState.countdownActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center space-y-8"
            >
              <motion.div 
                key={gameState.countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  "text-[15rem] sm:text-[25rem] font-black drop-shadow-[0_0_50px_rgba(16,185,129,0.5)] leading-none",
                  gameState.countdownType === 'QUESTION_ENDING' ? "text-red-500" : "text-emerald-500"
                )}
              >
                <CountdownDisplay seconds={gameState.countdown} active={gameState.countdownActive} endTime={gameState.countdownEndTime} />
              </motion.div>
              <h2 className="text-4xl sm:text-6xl font-black text-zinc-300 uppercase tracking-[0.3em]">
                {gameState.countdownType === 'QUESTION_ENDING' ? 'Fine Domanda' : 'Prossima Domanda'}
              </h2>
              <p className="text-xl sm:text-2xl font-bold text-zinc-400 uppercase tracking-widest animate-pulse">
                {gameState.countdownType === 'QUESTION_ENDING' ? 'Tempo quasi scaduto!' : 'Preparatevi...'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 sm:mb-12 w-full max-w-4xl flex flex-col items-center"
      >
        <div className="flex flex-col sm:flex-row justify-between items-center w-full mb-6 sm:mb-12 px-4 gap-6">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-emerald-500/10 rounded-2xl sm:rounded-3xl flex items-center justify-center shrink-0">
            <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-emerald-500" />
          </div>
          
          <TimerDisplay 
            seconds={gameState.timer} 
            active={gameState.timerActive} 
            endTime={gameState.timerEndTime}
            className="flex items-center gap-4 px-8 py-4 rounded-3xl font-mono font-black text-4xl sm:text-7xl transition-all shadow-2xl bg-white text-zinc-950 border border-zinc-100"
          />

          <div className="w-16 h-16 sm:w-24 sm:h-24 shrink-0 hidden sm:block" /> {/* Spacer */}
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight px-4 text-zinc-950 uppercase">
            {gameState.phase.startsWith('QUAL_') ? 'Qualificazioni' : 'Classifica Real-Time'}
          </h1>
          {(isAdmin ? myPeerId : roomId) && (
            <div className="flex flex-wrap items-center justify-center gap-3 mx-auto w-fit">
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">ID Stanza:</p>
                <p className="text-xs font-black text-emerald-500">{isAdmin ? myPeerId : roomId}</p>
              </div>
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm">
                <div className={cn("w-2 h-2 rounded-full", gameState.leaderboardMusicUrl ? "bg-emerald-500 animate-pulse" : "bg-zinc-300")} />
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Musica:</p>
                <p className="text-xs font-black text-zinc-600 dark:text-zinc-400">{gameState.leaderboardMusicUrl ? 'Caricata' : 'Non presente'}</p>
                {gameState.leaderboardMusicUrl && (
                  <button 
                    onClick={() => {
                      if (leaderboardMusicRef.current) {
                        if (leaderboardMusicRef.current.paused) {
                          leaderboardMusicRef.current.play().catch(console.error);
                        } else {
                          leaderboardMusicRef.current.pause();
                        }
                      }
                    }}
                    className="ml-1 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
                  >
                    <Zap className="w-3 h-3 text-emerald-500" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sync:</p>
                <p className="text-xs font-black text-zinc-600 dark:text-zinc-400">Live</p>
              </div>
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            <p className="text-emerald-500 text-sm sm:text-lg font-black uppercase tracking-[0.3em]">Round {gameState.round} | {roundType}</p>
            <p className="text-zinc-400 text-xs sm:text-sm font-bold uppercase tracking-widest">Domanda {gameState.currentQuestionIndex}/10</p>
          </div>
        </div>
      </motion.div>
      
      {/* Layout Grid: Question + Leaderboard */}
      <div className="w-full max-w-7xl px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-20">
        
        {/* Left Column: Question (Always visible on large if not empty) */}
        <div className={cn(
          "lg:col-span-5 space-y-6 lg:sticky lg:top-24",
          !(gameState.timerActive || gameState.isQuestionFinished || gameState.currentQuestion) && "hidden lg:block lg:opacity-0"
        )}>
          <AnimatePresence mode="wait">
            {(gameState.timerActive || gameState.isQuestionFinished || gameState.currentQuestion) && gameState.currentQuestion && (
              <motion.div
                key={gameState.currentQuestion.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
                
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "px-4 py-1.5 text-zinc-950 dark:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full",
                      gameState.isQuestionFinished ? "bg-amber-500" : "bg-emerald-500"
                    )}>
                      {gameState.isQuestionFinished ? "Risultato Domanda" : "Domanda in corso"}
                    </div>
                    {gameState.timerActive && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-700">
                        <Timer className={cn("w-4 h-4", gameState.timer <= 10 ? "text-red-500 animate-pulse" : "text-emerald-500")} />
                        <span className={cn("text-lg font-black tabular-nums", gameState.timer <= 10 ? "text-red-500" : "text-zinc-900 dark:text-white")}>
                          {gameState.timer}s
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-2xl sm:text-4xl font-black text-zinc-950 dark:text-white leading-[1.1] tracking-tighter">
                    {gameState.currentQuestion.text}
                  </h3>

                  {gameState.buzzes.length > 0 && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-amber-500 text-zinc-950 p-6 rounded-3xl shadow-[0_0_40px_rgba(245,158,11,0.3)] border-4 border-amber-400 text-center space-y-2"
                    >
                      <p className="text-xs font-black uppercase tracking-[0.3em] opacity-70">Prenotazione effettuata!</p>
                      <p className="text-3xl sm:text-5xl font-black uppercase tracking-tighter">
                        {gameState.teams.find(t => t.id === gameState.buzzes[0].teamId)?.name}
                      </p>
                      <p className="text-lg font-bold">ha prenotato la risposta</p>
                    </motion.div>
                  )}

                  {gameState.currentQuestion.options && (
                    <div className="grid grid-cols-1 gap-3 mt-8">
                      {gameState.currentQuestion.options.map((option, idx) => {
                        const isCorrect = gameState.phase === 'QUAL_RESULTS' && idx === gameState.currentQuestion?.correctAnswer;
                        return (
                          <div 
                            key={idx}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all",
                              isCorrect 
                                ? "bg-emerald-500 border-emerald-400 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg",
                              isCorrect ? "bg-zinc-950 text-emerald-500" : "bg-white dark:bg-zinc-700 text-zinc-400"
                            )}>
                              {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="font-bold text-lg">{option}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {gameState.isQuestionFinished && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-6 bg-zinc-950 dark:bg-zinc-800 text-white rounded-3xl border border-zinc-800"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-emerald-500">Risposta Corretta</p>
                      <p className="text-2xl sm:text-3xl font-black">
                        {String.fromCharCode(65 + (gameState.currentQuestion.correctAnswer ?? 0))}: {gameState.currentQuestion.options?.[gameState.currentQuestion.correctAnswer ?? 0]}
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* If no question, show a placeholder or nothing */}
          {!(gameState.timerActive || gameState.isQuestionFinished || gameState.currentQuestion) && (
            <div className="hidden lg:flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] text-center space-y-4">
              <Zap className="w-12 h-12 text-zinc-200 dark:text-zinc-800" />
              <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">In attesa della prossima sfida</p>
            </div>
          )}
        </div>

        {/* Right Column: Leaderboard */}
        <div className={cn(
          "space-y-3 sm:space-y-4",
          (gameState.timerActive || gameState.isQuestionFinished || gameState.currentQuestion) ? "lg:col-span-7" : "lg:col-span-12 max-w-4xl mx-auto w-full"
        )}>
          <AnimatePresence mode="popLayout">
            {sortedTeams.map((team, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;

            return (
              <motion.div
                key={team.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={cn(
                  "relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 flex items-center justify-between shadow-xl",
                  isFirst && "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20",
                  isSecond && "border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50",
                  isThird && "border-orange-200 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-900/10"
                )}
              >
                {isFirst && (
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Trophy className="w-32 h-32 text-amber-500" />
                  </div>
                )}

                <div className="flex items-center gap-6 relative z-10">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner",
                    isFirst ? "bg-amber-500 text-zinc-950" :
                    isSecond ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300" :
                    isThird ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" :
                    "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-100 dark:border-zinc-700"
                  )}>
                    {isFirst ? (
                      <div className="relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-500">
                          <motion.div
                            animate={{ rotate: [0, -10, 10, 0] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                          >
                            <Trophy className="w-6 h-6" />
                          </motion.div>
                        </div>
                        1
                      </div>
                    ) : index + 1}
                  </div>
                  
                  <div>
                    <h3 className={cn(
                      "text-2xl font-black tracking-tight flex items-center gap-2",
                      isFirst ? "text-amber-600 dark:text-amber-500" : "text-zinc-950 dark:text-white"
                    )}>
                      {team.name}
                      {team.lastAnswerFast && (
                        <motion.span
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className="text-amber-500"
                          title="Risposta Veloce! (+3 punti)"
                        >
                          <Zap className="w-5 h-5 fill-current" />
                        </motion.span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        team.status === 'eliminata' ? "bg-red-500" : "bg-emerald-500"
                      )} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        {team.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right relative z-10">
                  <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Punteggio</p>
                  <p className={cn(
                    "text-4xl font-black",
                    isFirst ? "text-amber-600 dark:text-amber-500" : "text-zinc-950 dark:text-white"
                  )}>
                    {team.score}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sortedTeams.length === 0 && (
          <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
            <Users className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-400 dark:text-zinc-500 font-medium">Nessuna squadra collegata</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
