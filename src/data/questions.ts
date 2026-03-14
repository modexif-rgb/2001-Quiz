import { QuestionFolder } from '../types';
import { pdf1Questions } from './pdf1';
import { pdf2Questions } from './pdf2';
import { pdf3Questions } from './pdf3';
import { pdf4Questions } from './pdf4';

export const PRELOADED_QUESTIONS: QuestionFolder[] = [
  {
    name: "PDF 1",
    questions: pdf1Questions
  },
  {
    name: "PDF 2",
    questions: pdf2Questions
  },
  {
    name: "PDF 3",
    questions: pdf3Questions
  },
  {
    name: "PDF 4",
    questions: pdf4Questions
  }
];

