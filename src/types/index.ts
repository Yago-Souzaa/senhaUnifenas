
import type { User as FirebaseUserType } from 'firebase/auth';

export interface PasswordEntry {
  id: string; // Will correspond to MongoDB's _id as a string
  userId?: string; // To associate with FirebaseUser.uid
  nome: string;
  login: string;
  senha?: string;
  categoria?: string; 
  customFields?: Array<{ label: string; value: string }>;
}

// Este é o tipo para o usuário simulado que usávamos antes.
// Pode ser útil manter se precisarmos de simulação em algum momento.
export interface SimulatedUser {
  id: string;
  email: string;
  type: 'primary' | 'sub'; // 'primary' para admin, 'sub' para sub-usuário
  primaryAccountId?: string; // ID do usuário primário, se este for um sub-usuário
}

// Tipo para o usuário retornado pelo Firebase Auth
export type FirebaseUser = FirebaseUserType;
