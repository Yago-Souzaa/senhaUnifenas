
export interface PasswordEntry {
  id: string;
  nome: string;
  login: string;
  senha?: string;
  categoria?: string; // Novo campo para categoria
  customFields?: Array<{ label: string; value: string }>;
}

