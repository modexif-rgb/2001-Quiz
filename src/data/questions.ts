import { QuestionFolder } from '../types';
import { qual1Questions } from './qual1';
import { qual2Questions } from './qual2';
import { qual3Questions } from './qual3';
import { buzzQuestions } from './buzz';

export const PRELOADED_QUESTIONS: QuestionFolder[] = [
  {
    name: "Qualificazioni Round 1",
    questions: qual1Questions
  },
  {
    name: "Qualificazioni Round 2",
    questions: qual2Questions
  },
  {
    name: "Qualificazioni Round 3",
    questions: qual3Questions
  },
  {
    name: "PDF Buzz",
    questions: buzzQuestions
  }
];

