import React, { useEffect, useState } from 'react';
import { socketService } from './services/socketService';
import { GameState, Team } from './types';
import { Trophy, Users, Zap, Settings, LogOut, ChevronRight, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function TimerDisplay({ seconds, active }: { seconds: number, active: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-xl transition-all",
      active ? (seconds <= 10 ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "bg-emerald-500/10 text-emerald-500") : "bg-zinc-800 text-zinc-500"
    )}>
      <Zap className={cn("w-5 h-5", active && seconds <= 10 && "animate-bounce")} />
      {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
    </div>
  );
}

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(() => {
    const saved = localStorage.getItem('myTeam');
    return saved ? JSON.parse(saved) : null;
  });
  const [teamName, setTeamName] = useState('');
  const [isAdmin, setIsAdmin] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    return path === '/admin' || path === '/admin/';
  });
  const [isLeaderboard, setIsLeaderboard] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    return path === '/leaderboard' || path === '/leaderboard/';
  });

  useEffect(() => {
    console.log('Connecting to socket...');
    socketService.connect();
    
    const unsubscribe = socketService.subscribe((msg) => {
      console.log('Received message from server:', msg.type);
      if (msg.type === 'STATE_UPDATE' && msg.state) {
        setGameState(msg.state);
      }
      if (msg.type === 'JOIN_SUCCESS' && msg.team) {
        setMyTeam(msg.team);
        localStorage.setItem('myTeam', JSON.stringify(msg.team));
      }
    });

    return () => {
      console.log('Cleaning up socket subscription');
      unsubscribe();
    };
  }, []);

  // Separate effect to update myTeam when gameState changes
  useEffect(() => {
    if (gameState && myTeam) {
      const updated = gameState.teams.find(t => t.id === myTeam.id);
      if (updated) {
        setMyTeam(updated);
        localStorage.setItem('myTeam', JSON.stringify(updated));
      }
    }
  }, [gameState]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim()) {
      socketService.send({ type: 'JOIN_TEAM', name: teamName });
    }
  };

  const handleBuzz = () => {
    if (myTeam) {
      socketService.send({ type: 'BUZZ', teamId: myTeam.id });
    }
  };

  const handleAnswer = (idx: number) => {
    if (myTeam && gameState?.isQuestionActive) {
      socketService.send({ type: 'SUBMIT_ANSWER', teamId: myTeam.id, answerIndex: idx });
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="font-medium animate-pulse">Connessione al server...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard gameState={gameState} />;
  }

  if (isLeaderboard) {
    return <Leaderboard gameState={gameState} />;
  }

  if (!myTeam) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
              <Trophy className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white text-center mb-2">2001 Domande</h1>
          <p className="text-zinc-400 text-center mb-8">Inserisci il nome della tua squadra per iniziare</p>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Nome Squadra</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Es. I Geni del Quiz"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Entra in partita
              <ChevronRight className="w-5 h-5" />
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight">{myTeam.name}</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{myTeam.status}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <TimerDisplay seconds={gameState.timer} active={gameState.timerActive} />
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Punteggio</p>
            <p className="text-xl font-black text-emerald-500">{myTeam.score}</p>
          </div>
        </div>
        <div className="bg-zinc-800 px-4 py-2 rounded-2xl border border-zinc-700">
          <span className="text-xs font-bold text-zinc-400 mr-2">PUNTI</span>
          <span className="text-lg font-black text-emerald-500">{myTeam.score}</span>
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
              <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border-4 border-emerald-500/20">
                <Users className="w-10 h-10 text-emerald-500 animate-pulse" />
              </div>
              <h1 className="text-4xl font-black tracking-tight">In attesa dell'host...</h1>
              <p className="text-zinc-400">La partita inizierà a breve. Preparati!</p>
              
              <button
                onClick={() => {
                  if (myTeam) {
                    socketService.send({ type: 'LEAVE_TEAM', teamId: myTeam.id });
                    setMyTeam(null);
                    localStorage.removeItem('myTeam');
                  }
                }}
                className="text-zinc-500 hover:text-zinc-300 text-sm font-bold flex items-center gap-2 mx-auto transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cambia squadra o esci
              </button>

              <div className="flex flex-wrap justify-center gap-2 mt-8">
                {gameState.teams.map(t => (
                  <span key={t.id} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-500">
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
                  {gameState.phase === 'QUAL_1' ? 'Manche 1: Cultura Generale' : 
                   gameState.phase === 'QUAL_2' ? 'Manche 2: Arti' : 'Manche 3: Mista'}
                </span>
                <h2 className="text-6xl font-black">Domanda {gameState.currentQuestionIndex}</h2>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center shadow-2xl space-y-8">
                {gameState.isQuestionActive && gameState.currentQuestion ? (
                  <>
                    <p className="text-2xl font-bold text-white">{gameState.currentQuestion.text}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {gameState.currentQuestion.options?.map((option, idx) => (
                        <button
                          key={idx}
                          disabled={!gameState.isQuestionActive}
                          onClick={() => handleAnswer(idx)}
                          className={cn(
                            "bg-zinc-950 border rounded-2xl p-6 text-left transition-all flex items-center gap-4 group",
                            gameState.selectedAnswers[myTeam.id] === idx 
                              ? "border-emerald-500 bg-emerald-500/10" 
                              : "border-zinc-800 hover:bg-zinc-800 active:scale-95"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl border flex items-center justify-center font-black transition-colors",
                            gameState.selectedAnswers[myTeam.id] === idx
                              ? "bg-emerald-500 text-zinc-950 border-emerald-400"
                              : "bg-zinc-900 border-zinc-800 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-zinc-950"
                          )}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className={cn(
                            "font-bold transition-colors",
                            gameState.selectedAnswers[myTeam.id] === idx ? "text-white" : "text-zinc-300 group-hover:text-white"
                          )}>{option}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-2xl font-medium text-zinc-500 italic">In attesa della prossima domanda...</p>
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
                  <h1 className="text-5xl font-black">QUALIFICATI!</h1>
                  <p className="text-zinc-400 text-xl">Ottimo lavoro, siete tra le migliori 4 squadre!</p>
                </>
              ) : (
                <>
                  <div className="w-32 h-32 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="w-16 h-16 text-zinc-500" />
                  </div>
                  <h1 className="text-5xl font-black text-zinc-500">FINE CORSA</h1>
                  <p className="text-zinc-400 text-xl">Il vostro percorso si ferma qui... ma ottima partita!</p>
                </>
              )}
            </motion.div>
          )}

          {(gameState.phase === 'SEMIS' || gameState.phase === 'FINAL') && (
            <motion.div 
              key="buzz-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex flex-col items-center gap-8"
            >
              <div className="text-center space-y-2">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em]">
                  {gameState.phase === 'SEMIS' ? 'Semifinale' : 'Finale'}
                </span>
                <h2 className="text-4xl font-black">Domanda {gameState.currentQuestionIndex}</h2>
              </div>

              {gameState.currentQuestion && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center w-full">
                  <p className="text-2xl font-bold text-white">{gameState.currentQuestion.text}</p>
                </div>
              )}

              {myTeam.status === 'eliminata' ? (
                <div className="text-center space-y-4">
                  <p className="text-zinc-500 italic">Sei stato eliminato. Goditi lo spettacolo!</p>
                </div>
              ) : (
                <button
                  onClick={handleBuzz}
                  disabled={!gameState.isQuestionActive || gameState.buzzes.length > 0}
                  className={cn(
                    "w-64 h-64 rounded-full border-8 transition-all flex items-center justify-center shadow-2xl active:scale-90",
                    gameState.isQuestionActive && gameState.buzzes.length === 0
                      ? "bg-red-600 border-red-800 hover:bg-red-500 animate-pulse"
                      : "bg-zinc-800 border-zinc-900 opacity-50 cursor-not-allowed"
                  )}
                >
                  <Zap className={cn("w-24 h-24", gameState.isQuestionActive ? "text-white" : "text-zinc-600")} />
                </button>
              )}

              {gameState.buzzes.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 flex items-center gap-4"
                >
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-zinc-950" />
                  </div>
                  <p className="font-bold">
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
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
      <footer className="p-6 border-t border-zinc-800 bg-zinc-900/30">
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

function AdminDashboard({ gameState }: { gameState: GameState }) {
  const [nextDifficulty, setNextDifficulty] = useState<'facile' | 'media' | 'difficile'>('facile');

  const sendAction = (action: string, payload: any = {}) => {
    socketService.send({ type: 'ADMIN_ACTION', action, payload });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black">Admin Dashboard</h1>
              <p className="text-zinc-500">Controllo totale della partita</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <TimerDisplay seconds={gameState.timer} active={gameState.timerActive} />
            <div className="flex gap-3">
              <button 
                onClick={() => sendAction('RESET_GAME')}
                className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold hover:bg-red-500/20 transition-all"
              >
                Reset Totale
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Game Controls */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-500" />
                Stato Partita
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Fase</p>
                  <p className="text-lg font-black text-emerald-500">{gameState.phase}</p>
                </div>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Domanda</p>
                  <p className="text-lg font-black text-emerald-500">{gameState.currentQuestionIndex}/10</p>
                </div>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Squadre</p>
                  <p className="text-lg font-black text-emerald-500">{gameState.teams.length}</p>
                </div>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Buzz</p>
                  <p className="text-lg font-black text-emerald-500">{gameState.buzzes.length}</p>
                </div>
              </div>

              {gameState.currentQuestion && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Domanda Corrente</p>
                  <p className="text-xl font-bold">{gameState.currentQuestion.text}</p>
                  {gameState.currentQuestion.options && (
                    <div className="grid grid-cols-2 gap-2">
                      {gameState.currentQuestion.options.map((opt, i) => (
                        <div key={i} className={cn("p-3 rounded-xl border text-sm", i === gameState.currentQuestion?.correctAnswer ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 font-bold" : "bg-zinc-900 border-zinc-800 text-zinc-500")}>
                          {String.fromCharCode(65 + i)}: {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-4 items-center">
                {gameState.phase === 'LOBBY' && (
                  <button onClick={() => sendAction('START_GAME', { difficulty: nextDifficulty })} className="px-8 py-4 bg-emerald-500 text-zinc-950 font-black rounded-2xl hover:bg-emerald-400 transition-all">
                    Inizia Partita
                  </button>
                )}
                {gameState.phase.startsWith('QUAL_') && gameState.phase !== 'QUAL_RESULTS' && (
                  <>
                    <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
                      {(['facile', 'media', 'difficile'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setNextDifficulty(d)}
                          className={cn(
                            "px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                            nextDifficulty === d ? "bg-emerald-500 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => sendAction('NEXT_QUESTION', { difficulty: nextDifficulty })} className="px-8 py-4 bg-emerald-500 text-zinc-950 font-black rounded-2xl hover:bg-emerald-400 transition-all">
                      Prossima Domanda
                    </button>
                    <button onClick={() => sendAction('TOGGLE_QUESTION')} className={cn("px-8 py-4 font-black rounded-2xl transition-all", gameState.isQuestionActive ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20")}>
                      {gameState.isQuestionActive ? 'Ferma Tempo' : 'Attiva Domanda'}
                    </button>
                  </>
                )}
                {gameState.phase === 'QUAL_RESULTS' && (
                  <button onClick={() => sendAction('START_SEMIS')} className="px-8 py-4 bg-amber-500 text-zinc-950 font-black rounded-2xl hover:bg-amber-400 transition-all">
                    Avvia Semifinali
                  </button>
                )}
                {gameState.phase === 'SEMIS' && gameState.finalMatch && (
                  <button onClick={() => sendAction('START_FINAL')} className="px-8 py-4 bg-purple-500 text-white font-black rounded-2xl hover:bg-purple-400 transition-all">
                    Avvia Finale
                  </button>
                )}
              </div>
            </section>

            {/* Buzz List */}
            {gameState.buzzes.length > 0 && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-4">
                <h3 className="text-xl font-bold">Ordine di Buzz</h3>
                <div className="space-y-2">
                  {gameState.buzzes.map((buzz, i) => (
                    <div key={buzz.teamId} className={cn("flex justify-between items-center p-4 rounded-2xl border", i === 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-zinc-950 border-zinc-800")}>
                      <span className="font-bold">{gameState.teams.find(t => t.id === buzz.teamId)?.name}</span>
                      <span className="text-xs font-mono text-zinc-500">+{((buzz.timestamp - gameState.buzzes[0].timestamp) / 1000).toFixed(3)}s</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Match Details */}
            {(gameState.phase === 'SEMIS' || gameState.phase === 'FINAL') && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
                <h3 className="text-xl font-bold">Dettagli Scontri</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {gameState.phase === 'SEMIS' && gameState.semisMatches && (
                    <>
                      <MatchCard match={gameState.semisMatches.match1} teams={gameState.teams} onScore={(id, amt) => sendAction('UPDATE_SCORE', { teamId: id, amount: amt })} />
                      <MatchCard match={gameState.semisMatches.match2} teams={gameState.teams} onScore={(id, amt) => sendAction('UPDATE_SCORE', { teamId: id, amount: amt })} />
                    </>
                  )}
                  {gameState.phase === 'FINAL' && gameState.finalMatch && (
                    <div className="md:col-span-2">
                      <MatchCard match={gameState.finalMatch} teams={gameState.teams} onScore={(id, amt) => sendAction('UPDATE_SCORE', { teamId: id, amount: amt })} />
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Teams List */}
          <div className="space-y-8">
            <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                Squadre
              </h3>
              <div className="space-y-4">
                {gameState.teams.sort((a, b) => b.score - a.score).map(team => (
                  <div key={team.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{team.name}</p>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{team.status}</p>
                      </div>
                      <p className="text-xl font-black text-emerald-500">{team.score}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => sendAction('UPDATE_SCORE', { teamId: team.id, amount: 1 })} className="flex-1 bg-zinc-900 hover:bg-zinc-800 p-2 rounded-xl text-xs font-bold border border-zinc-800">+1</button>
                      <button onClick={() => sendAction('UPDATE_SCORE', { teamId: team.id, amount: -1 })} className="flex-1 bg-zinc-900 hover:bg-zinc-800 p-2 rounded-xl text-xs font-bold border border-zinc-800">-1</button>
                      <button onClick={() => sendAction('DELETE_TEAM', { teamId: team.id })} className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all">
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {gameState.teams.length === 0 && (
                  <p className="text-center text-zinc-600 italic py-8">Nessuna squadra collegata</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, teams, onScore }: { match: any, teams: Team[], onScore: (id: string, amt: number) => void }) {
  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 text-center space-y-2">
          <p className="font-bold truncate">{teamA?.name}</p>
          <p className="text-4xl font-black text-emerald-500">{match.scoreA}</p>
          <div className="flex gap-1 justify-center">
            <button onClick={() => onScore(match.teamAId, 1)} className="w-8 h-8 bg-zinc-900 rounded-lg text-xs font-bold border border-zinc-800">+</button>
            <button onClick={() => onScore(match.teamAId, -1)} className="w-8 h-8 bg-zinc-900 rounded-lg text-xs font-bold border border-zinc-800">-</button>
          </div>
        </div>
        <div className="text-zinc-700 font-black italic">VS</div>
        <div className="flex-1 text-center space-y-2">
          <p className="font-bold truncate">{teamB?.name}</p>
          <p className="text-4xl font-black text-emerald-500">{match.scoreB}</p>
          <div className="flex gap-1 justify-center">
            <button onClick={() => onScore(match.teamBId, 1)} className="w-8 h-8 bg-zinc-900 rounded-lg text-xs font-bold border border-zinc-800">+</button>
            <button onClick={() => onScore(match.teamBId, -1)} className="w-8 h-8 bg-zinc-900 rounded-lg text-xs font-bold border border-zinc-800">-</button>
          </div>
        </div>
      </div>
      {match.winnerId && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-center">
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Vincitore</p>
          <p className="font-black">{teams.find(t => t.id === match.winnerId)?.name}</p>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ gameState }: { gameState: GameState }) {
  const sortedTeams = [...gameState.teams].sort((a, b) => b.score - a.score);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    if (!audioEnabled) return;
    let music: HTMLAudioElement | null = null;
    if (gameState.timerActive) {
      music = new Audio('https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3');
      music.loop = true;
      music.volume = 0.2;
      music.play().catch(e => console.log("Audio play failed", e));
    }
    return () => {
      if (music) {
        music.pause();
        music.src = "";
      }
    };
  }, [gameState.timerActive, audioEnabled]);

  useEffect(() => {
    if (!audioEnabled || !gameState.timerActive) return;
    if (gameState.timer <= 3 && gameState.timer > 0) {
      const beep = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
      beep.volume = 0.5;
      beep.play().catch(e => console.log("Audio play failed", e));
    }
    if (gameState.timer === 0) {
      const siren = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-emergency-siren-1002.mp3');
      siren.volume = 0.5;
      siren.play().catch(e => console.log("Audio play failed", e));
    }
  }, [gameState.timer, gameState.timerActive, audioEnabled]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 flex flex-col items-center">
      {!audioEnabled && (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl text-center max-w-sm space-y-6 shadow-2xl"
          >
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Attiva Audio</h3>
              <p className="text-zinc-500 text-sm">Clicca per abilitare la musica e gli effetti sonori della classifica.</p>
            </div>
            <button 
              onClick={() => setAudioEnabled(true)}
              className="w-full py-4 bg-emerald-500 text-zinc-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all active:scale-95"
            >
              Abilita Audio
            </button>
          </motion.div>
        </div>
      )}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 w-full max-w-4xl flex flex-col items-center"
      >
        <div className="flex justify-between items-center w-full mb-8">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center">
            <Trophy className="w-10 h-10 text-emerald-500" />
          </div>
          <TimerDisplay seconds={gameState.timer} active={gameState.timerActive} />
          <div className="w-20 h-20" /> {/* Spacer */}
        </div>
        <h1 className="text-5xl font-black tracking-tight">Classifica Real-Time</h1>
        <p className="text-zinc-500 mt-2 font-medium uppercase tracking-widest">2001 Domande</p>
      </motion.div>

      <div className="w-full max-w-4xl space-y-4">
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
                  "relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center justify-between shadow-xl",
                  isFirst && "border-amber-500/50 bg-amber-500/5",
                  isSecond && "border-zinc-400/50 bg-zinc-400/5",
                  isThird && "border-orange-700/50 bg-orange-700/5"
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
                    isSecond ? "bg-zinc-400 text-zinc-950" :
                    isThird ? "bg-orange-700 text-white" :
                    "bg-zinc-950 text-zinc-500 border border-zinc-800"
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
                      "text-2xl font-black tracking-tight",
                      isFirst ? "text-amber-500" : "text-white"
                    )}>
                      {team.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        team.status === 'eliminata' ? "bg-red-500" : "bg-emerald-500"
                      )} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        {team.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right relative z-10">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Punteggio</p>
                  <p className={cn(
                    "text-4xl font-black",
                    isFirst ? "text-amber-500" : "text-white"
                  )}>
                    {team.score}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sortedTeams.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl">
            <Users className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">Nessuna squadra collegata</p>
          </div>
        )}
      </div>
    </div>
  );
}
