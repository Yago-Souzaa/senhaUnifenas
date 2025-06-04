export interface PasswordEntry {
  id: string;
  nome: string;
  ip?: string;
  login: string;
  senha?: string; // Main password field
  funcao?: string;
  acesso?: string;
  versao?: string;
  // Optional: Add a 'notes' field if 'Senha' column from spreadsheet should be stored separately
  // notes?: string; 
}
