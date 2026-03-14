import { Question } from '../types';
import { pdf2Questions } from './pdf2';

export const pdf3Questions: Question[] = pdf2Questions.map(q => ({
  ...q,
  id: q.id.replace('p2_', 'p3_'),
  source: 'PDF 3'
}));
