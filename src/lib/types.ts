import type { ChatMessage, Level, TutorMode } from '../../shared/api';
import type { Appearance } from './appearance';

export type { Level, TutorMode, ChatMessage };

export type Priority = 'baixa' | 'media' | 'alta';

export interface PasswordLock {
  salt: string;
  hash: string;
  iterations: number;
}

export interface Profile {
  name: string;
  level: Level;
  dailyGoalMinutes: number;
  onboarded: boolean;
  lock?: PasswordLock;
}

export interface Subject {
  id: string;
  name: string;
  hue: number; // índice na paleta fixa de matérias
  createdAt: string;
}

export interface Task {
  id: string;
  subjectId: string;
  title: string;
  due?: string; // YYYY-MM-DD
  priority: Priority;
  estimateMin: number;
  done: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface Exam {
  id: string;
  subjectId: string;
  title: string;
  date: string; // YYYY-MM-DD
  topics: string;
}

export interface StudySession {
  id: string;
  subjectId: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  minutes: number;
  status: 'planejada' | 'concluida';
  source: 'timer' | 'manual' | 'recomendacao';
  notes?: string;
  completedAt?: string;
}

export interface AnsweredQuestion {
  question: string;
  options: string[];
  answer: number;
  chosen: number;
  explanation: string;
  topic: string;
}

export interface QuizAttempt {
  id: string;
  date: string; // ISO
  subject: string;
  topic?: string;
  source: 'ia' | 'local';
  level: Level;
  questions: AnsweredQuestion[];
  score: number;
  total: number;
  durationSec: number;
}

export interface Flashcard {
  id: string;
  subjectId: string;
  topic: string;
  front: string;
  back: string;
  ease: number;
  interval: number; // dias
  reps: number;
  lapses: number;
  correct: number;
  wrong: number;
  due: string; // ISO
  lastReviewed?: string;
  createdAt: string;
  source: 'manual' | 'ia' | 'quiz';
}

export interface ReviewLog {
  id: string;
  cardId: string;
  date: string; // ISO
  grade: 0 | 1 | 2 | 3;
}

export interface ChatThread {
  id: string;
  title: string;
  subjectId?: string;
  topic?: string;
  mode: TutorMode;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface AppData {
  version: 1;
  profile: Profile;
  subjects: Subject[];
  tasks: Task[];
  exams: Exam[];
  sessions: StudySession[];
  attempts: QuizAttempt[];
  cards: Flashcard[];
  reviews: ReviewLog[];
  chats: ChatThread[];
  insights?: { text: string; date: string; model: string };
  appearance: Appearance;
}
