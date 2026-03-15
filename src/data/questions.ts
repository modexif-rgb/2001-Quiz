import { QuestionFolder } from '../types';
import { culturaGeneraleQuestions } from './culturaGenerale';
import { artiQuestions } from './arti';
import { storiaGeopoliticaQuestions } from './storiaGeopolitica';
import { pdf4Questions } from './pdf4';

export const PRELOADED_QUESTIONS: QuestionFolder[] = [
  {
    name: "Quiz_CulturaGenerale",
    questions: culturaGeneraleQuestions
  },
  {
    name: "Quiz_Arti",
    questions: artiQuestions
  },
  {
    name: "Quiz_Storia_Geopolitica",
    questions: storiaGeopoliticaQuestions
  },
  {
    name: "PDF 4",
    questions: pdf4Questions
  }
];

