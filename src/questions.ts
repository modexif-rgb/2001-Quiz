import { Question } from './types';
import { qual1Questions } from './data/qual1';
import { qual2Questions } from './data/qual2';
import { qual3Questions } from './data/qual3';
import { buzzQuestions } from './data/buzz';

export const QUESTIONS: Record<string, Question[]> = {
  QUAL_1: qual1Questions,
  QUAL_2: qual2Questions,
  QUAL_3: qual3Questions,
  QUAL_TIEBREAKER: buzzQuestions.slice(0, 10),
  SEMIS: buzzQuestions.slice(10, 30),
  FINAL: buzzQuestions.slice(30, 50)
};
