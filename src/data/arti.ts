import { Question } from '../types';

export const artiQuestions: Question[] = [
  { id: 'art_1', text: "Chi ha dipinto 'La notte stellata'?", options: ["Monet", "Van Gogh", "Degas", "Cézanne"], correctAnswer: 1, difficulty: 'facile', source: 'Quiz_Arti' },
  { id: 'art_2', text: "Chi ha dipinto la Cappella Sistina?", options: ["Leonardo", "Michelangelo", "Raffaello", "Caravaggio"], correctAnswer: 1, difficulty: 'facile', source: 'Quiz_Arti' },
  { id: 'art_3', text: "Chi ha diretto 'Pulp Fiction'?", options: ["Tarantino", "Scorsese", "Kubrick", "Nolan"], correctAnswer: 0, difficulty: 'facile', source: 'Quiz_Arti' },
  { id: 'art_4', text: "Chi canta 'Like a Virgin'?", options: ["Madonna", "Cher", "Whitney Houston", "Lady Gaga"], correctAnswer: 0, difficulty: 'facile', source: 'Quiz_Arti' },
  { id: 'art_5', text: "Chi ha diretto il film 'Titanic'?", options: ["Steven Spielberg", "James Cameron", "Ridley Scott", "Peter Jackson"], correctAnswer: 1, difficulty: 'facile', source: 'Quiz_Arti' },
  { id: 'art_6', text: "Chi ha scolpito il David a Firenze?", options: ["Donatello", "Michelangelo", "Bernini", "Canova"], correctAnswer: 1, difficulty: 'facile', source: 'Quiz_Arti' },
  { id: 'art_7', text: "Chi ha composto 'Le quattro stagioni'?", options: ["Mozart", "Bach", "Vivaldi", "Verdi"], correctAnswer: 2, difficulty: 'facile', source: 'Quiz_Arti' },
  { id: 'art_8', text: "Quale band ha scritto 'Bohemian Rhapsody'?", options: ["Queen", "Beatles", "Pink Floyd", "U2"], correctAnswer: 0, difficulty: 'facile', source: 'Quiz_Arti' },
  { id: 'art_9', text: "Quale film ha vinto l'Oscar 2020?", options: ["1917", "Parasite", "Joker", "Ford v Ferrari"], correctAnswer: 1, difficulty: 'media', source: 'Quiz_Arti' },
  { id: 'art_10', text: "Chi ha vinto Sanremo 2021?", options: ["Mahmood", "Måneskin", "Blanco", "Diodato"], correctAnswer: 1, difficulty: 'facile', source: 'Quiz_Arti' }
];
