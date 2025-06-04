export interface PasswordEntry {
  id: string;
  nome: string;
  login: string;
  senha?: string;
  customFields?: Array<{ label: string; value: string }>;
  // Os campos abaixo não são mais usados diretamente, serão migrados/acessados via customFields
  // ip?: string;
  // funcao?: string;
  // acesso?: string;
  // versao?: string;
}
