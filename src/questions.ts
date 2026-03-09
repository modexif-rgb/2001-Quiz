import { Question } from './types';

export const QUESTIONS: Record<string, Question[]> = {
  QUAL_1: [
    { id: 'q1', text: "In quale anno cadde l'Impero Romano d'Occidente?", options: ["395", "410", "476", "1453"], correctAnswer: 2, difficulty: 'difficile' },
    { id: 'q2', text: "Chi formulò il principio di indeterminazione?", options: ["Werner Heisenberg", "Max Planck", "Albert Einstein", "Niels Bohr"], correctAnswer: 0, difficulty: 'difficile' },
    { id: 'q3', text: "Qual è il numero atomico del tungsteno?", options: ["72", "74", "78", "76"], correctAnswer: 1, difficulty: 'difficile' },
    { id: 'q4', text: "Quale trattato pose fine alla Guerra dei Trent'anni?", options: ["Trattato di Tordesillas", "Pace di Westfalia", "Trattato di Utrecht", "Trattato di Versailles"], correctAnswer: 1, difficulty: 'difficile' },
    { id: 'q5', text: "Chi dipinse 'Las Meninas'?", options: ["Francisco Goya", "El Greco", "Bartolomé Murillo", "Diego Velázquez"], correctAnswer: 3, difficulty: 'difficile' },
    { id: 'q6', text: "Quale matematico dimostrò l'ultimo teorema di Fermat nel 1994?", options: ["Kurt Gödel", "Andrew Wiles", "Terence Tao", "John Nash"], correctAnswer: 1, difficulty: 'difficile' },
    { id: 'q7', text: "Qual è la capitale del Kazakistan?", options: ["Bishkek", "Tashkent", "Astana", "Almaty"], correctAnswer: 2, difficulty: 'difficile' },
    { id: 'q8', text: "Quale filosofo scrisse 'Essere e tempo'?", options: ["Martin Heidegger", "Jean-Paul Sartre", "Edmund Husserl", "Karl Jaspers"], correctAnswer: 0, difficulty: 'difficile' },
    { id: 'q9', text: "Quale pianeta ha il giorno più lungo rispetto all'anno?", options: ["Marte", "Saturno", "Mercurio", "Venere"], correctAnswer: 3, difficulty: 'difficile' },
    { id: 'q10', text: "Chi compose l'opera 'Wozzeck'?", options: ["Alban Berg", "Richard Strauss", "Gustav Mahler", "Arnold Schoenberg"], correctAnswer: 0, difficulty: 'difficile' }
  ],
  QUAL_2: [
    { id: 'q11', text: "Quale scienziato scoprì il neutrone?", options: ["James Chadwick", "Fermi", "Rutherford", "Bohr"], correctAnswer: 0, difficulty: 'difficile' },
    { id: 'q12', text: "Chi scrisse 'Critica della ragion pura'?", options: ["Immanuel Kant", "Hegel", "Leibniz", "Spinoza"], correctAnswer: 0, difficulty: 'difficile' },
    { id: 'q13', text: "Chi dipinse il soffitto della Cappella Sistina?", options: ["Michelangelo", "Raffaello", "Donatello", "Caravaggio"], correctAnswer: 0, difficulty: 'difficile' },
    { id: 'q15', text: "Chi scrisse 'Il mondo come volontà e rappresentazione'?", options: ["Hume", "Arthur Schopenhauer", "Nietzsche", "Kierkegaard"], correctAnswer: 1, difficulty: 'difficile' },
    { id: 'q18', text: "Quale città fu capitale dell'Impero bizantino?", options: ["Atene", "Costantinopoli", "Smirne", "Antiochia"], correctAnswer: 1, difficulty: 'difficile' },
    { id: 'q20', text: "Quale metallo è liquido a temperatura ambiente?", options: ["Mercurio", "Cesio", "Gallio", "Bromo"], correctAnswer: 0, difficulty: 'difficile' },
    { id: 'q21', text: "Quale oceano è il più profondo?", options: ["Indiano", "Atlantico", "Artico", "Oceano Pacifico"], correctAnswer: 3, difficulty: 'difficile' },
    { id: 'q25', text: "Quale imperatore romano emanò l'Editto di Milano?", options: ["Teodosio", "Giuliano", "Costantino", "Diocleziano"], correctAnswer: 2, difficulty: 'difficile' },
    { id: 'q31', text: "Qual è la lingua ufficiale dell'Etiopia?", options: ["Swahili", "Somalo", "Tigrino", "Amarico"], correctAnswer: 3, difficulty: 'difficile' },
    { id: 'q37', text: "Quale elemento ha simbolo chimico 'W'?", options: ["Titanio", "Wolframioide", "Tungsteno", "Tantalio"], correctAnswer: 2, difficulty: 'difficile' }
  ],
  QUAL_3: [
    { id: 'q47', text: "Quale oceano è il più profondo?", options: ["Atlantico", "Indiano", "Artico", "Oceano Pacifico"], correctAnswer: 3, difficulty: 'difficile' },
    { id: 'q48', text: "Chi scrisse 'Critica della ragion pura'?", options: ["Immanuel Kant", "Spinoza", "Leibniz", "Hegel"], correctAnswer: 0, difficulty: 'difficile' },
    { id: 'q51', text: "Quale scienziato scoprì il neutrone?", options: ["Rutherford", "Bohr", "James Chadwick", "Fermi"], correctAnswer: 2, difficulty: 'difficile' },
    { id: 'q53', text: "Quale elemento ha simbolo chimico 'W'?", options: ["Titanio", "Tantalio", "Tungsteno", "Wolframioide"], correctAnswer: 2, difficulty: 'difficile' },
    { id: 'q57', text: "Quale imperatore romano emanò l'Editto di Milano?", options: ["Giuliano", "Costantino", "Teodosio", "Diocleziano"], correctAnswer: 1, difficulty: 'difficile' },
    { id: 'q59', text: "Qual è la lingua ufficiale dell'Etiopia?", options: ["Swahili", "Somalo", "Amarico", "Tigrino"], correctAnswer: 2, difficulty: 'difficile' },
    { id: 'q60', text: "Quale elemento ha simbolo chimico 'W'?", options: ["Titanio", "Tantalio", "Wolframioide", "Tungsteno"], correctAnswer: 3, difficulty: 'difficile' },
    { id: 'q62', text: "Chi scrisse 'Il mondo come volontà e rappresentazione'?", options: ["Hume", "Kierkegaard", "Arthur Schopenhauer", "Nietzsche"], correctAnswer: 2, difficulty: 'difficile' },
    { id: 'q63', text: "Qual è la lingua ufficiale dell'Etiopia?", options: ["Tigrino", "Amarico", "Somalo", "Swahili"], correctAnswer: 1, difficulty: 'difficile' },
    { id: 'q70', text: "Quale scienziato scoprì il neutrone?", options: ["Rutherford", "Bohr", "Fermi", "James Chadwick"], correctAnswer: 3, difficulty: 'difficile' }
  ],
  SEMIS: [
    { id: 's1', text: "Chi dipinse il soffitto della Cappella Sistina?", difficulty: 'difficile' },
    { id: 's2', text: "Chi scrisse 'Critica della ragion pura'?", difficulty: 'difficile' },
    { id: 's3', text: "Quale città fu capitale dell'Impero bizantino?", difficulty: 'difficile' },
    { id: 's4', text: "Quale elemento ha simbolo chimico 'W'?", difficulty: 'difficile' },
    { id: 's5', text: "Quale scienziato scoprì il neutrone?", difficulty: 'difficile' }
  ],
  FINAL: [
    { id: 'f1', text: "Chi scrisse 'Il mondo come volontà e rappresentazione'?", difficulty: 'difficile' },
    { id: 'f2', text: "Quale oceano è il più profondo?", difficulty: 'difficile' },
    { id: 'f3', text: "Quale imperatore romano emanò l'Editto di Milano?", difficulty: 'difficile' },
    { id: 'f4', text: "Qual è la lingua ufficiale dell'Etiopia?", difficulty: 'difficile' },
    { id: 'f5', text: "Quale metallo è liquido a temperatura ambiente?", difficulty: 'difficile' }
  ]
};
