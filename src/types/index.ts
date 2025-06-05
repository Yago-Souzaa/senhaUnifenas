
export interface PasswordEntry {
  id: string; // Will correspond to MongoDB's _id as a string
  nome: string;
  login: string;
  senha?: string;
  categoria?: string; 
  customFields?: Array<{ label: string; value: string }>;
  // _id?: any; // MongoDB's ObjectId, handled internally by API
}
