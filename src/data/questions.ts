import { Question } from '../types';

export interface QuestionFolder {
  name: string;
  questions: Question[];
}

const baseQuestions = [
  { text: "Di che colore è il pomodoro?", options: ["blu", "verde", "nero", "rosso"], correctAnswer: 3 },
  { text: "Qual è la capitale della Francia?", options: ["Madrid", "Parigi", "Berlino", "Lisbona"], correctAnswer: 1 },
  { text: "Quanti continenti ci sono sulla Terra?", options: ["5", "6", "7", "8"], correctAnswer: 2 },
  { text: "Chi ha dipinto la Gioconda?", options: ["Van Gogh", "Picasso", "Leonardo da Vinci", "Michelangelo"], correctAnswer: 2 },
  { text: "Qual è il pianeta più grande del Sistema Solare?", options: ["Terra", "Giove", "Marte", "Venere"], correctAnswer: 1 },
  { text: "In quale anno è iniziata la Seconda Guerra Mondiale?", options: ["1914", "1939", "1945", "1929"], correctAnswer: 1 },
  { text: "Qual è l'elemento chimico con simbolo O?", options: ["Oro", "Osmio", "Ossigeno", "Ossido"], correctAnswer: 2 },
  { text: "Quale lingua ha più madrelingua al mondo?", options: ["Inglese", "Spagnolo", "Hindi", "Mandarino"], correctAnswer: 3 },
  { text: "Chi ha scritto 'I Promessi Sposi'?", options: ["Dante", "Manzoni", "Boccaccio", "Calvino"], correctAnswer: 1 },
  { text: "Qual è il fiume più lungo tradizionalmente?", options: ["Nilo", "Amazzonia", "Mississippi", "Danubio"], correctAnswer: 0 },
  { text: "Qual è la montagna più alta del mondo?", options: ["K2", "Everest", "Monte Bianco", "Kilimangiaro"], correctAnswer: 1 },
  { text: "Quale gas respirano gli esseri umani?", options: ["Azoto", "Ossigeno", "CO2", "Idrogeno"], correctAnswer: 1 },
  { text: "Quale paese ha inventato la pizza moderna?", options: ["Francia", "USA", "Italia", "Grecia"], correctAnswer: 2 },
  { text: "Chi ha formulato la teoria della relatività?", options: ["Newton", "Einstein", "Galileo", "Tesla"], correctAnswer: 1 },
  { text: "Qual è l'oceano più grande?", options: ["Atlantico", "Indiano", "Pacifico", "Artico"], correctAnswer: 2 },
  { text: "Chi costruì il Colosseo?", options: ["Greci", "Romani", "Ottomani", "Persiani"], correctAnswer: 1 },
  { text: "Qual è la valuta del Giappone?", options: ["Won", "Yuan", "Yen", "Ringgit"], correctAnswer: 2 },
  { text: "Chi ha scoperto la penicillina?", options: ["Fleming", "Pasteur", "Curie", "Darwin"], correctAnswer: 0 },
  { text: "Quale strumento misura i terremoti?", options: ["Termometro", "Barometro", "Sismografo", "Igrometro"], correctAnswer: 2 },
  { text: "Qual è il deserto caldo più grande?", options: ["Sahara", "Gobi", "Kalahari", "Atacama"], correctAnswer: 0 },
  { text: "Qual è il pianeta più vicino al Sole?", options: ["Mercurio", "Venere", "Terra", "Marte"], correctAnswer: 0 },
  { text: "Quale animale è il più grande del mondo?", options: ["Elefante", "Balenottera azzurra", "Squalo", "Giraffa"], correctAnswer: 1 },
  { text: "Chi scrisse la Divina Commedia?", options: ["Dante", "Petrarca", "Ariosto", "Tasso"], correctAnswer: 0 },
  { text: "Quale metallo ha simbolo Fe?", options: ["Ferro", "Fluoro", "Francio", "Flerovio"], correctAnswer: 0 },
  { text: "Quanti giorni ha un anno bisestile?", options: ["364", "365", "366", "367"], correctAnswer: 2 },
  { text: "Qual è la capitale della Spagna?", options: ["Barcellona", "Madrid", "Valencia", "Siviglia"], correctAnswer: 1 },
  { text: "Quale mare bagna Venezia?", options: ["Tirreno", "Adriatico", "Ionio", "Ligure"], correctAnswer: 1 },
  { text: "Qual è il continente più grande?", options: ["Africa", "Europa", "Asia", "America"], correctAnswer: 2 },
  { text: "Chi inventò la lampadina pratica?", options: ["Edison", "Tesla", "Volta", "Bell"], correctAnswer: 0 },
  { text: "Qual è il numero dei pianeti nel Sistema Solare?", options: ["7", "8", "9", "10"], correctAnswer: 1 },
];

const generateQuestions = (): Question[] => {
  const questions: Question[] = [];
  for (let i = 0; i < 100; i++) {
    const base = baseQuestions[i % baseQuestions.length];
    questions.push({
      id: `pdf_${i + 1}`,
      text: base.text,
      options: base.options,
      correctAnswer: base.correctAnswer,
      difficulty: i < 33 ? 'facile' : i < 66 ? 'media' : 'difficile',
      source: "PDF Allegato"
    });
  }
  return questions;
};

export const PRELOADED_QUESTIONS: QuestionFolder[] = [
  {
    name: "PDF Allegato",
    questions: generateQuestions()
  }
];
