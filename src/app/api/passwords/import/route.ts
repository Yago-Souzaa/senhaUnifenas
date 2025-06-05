
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { PasswordEntry } from '@/types';

// Helper function from usePasswordManager, adapted for server-side
const parseCSVToEntries = (csvText: string): Array<Omit<PasswordEntry, 'id' | 'userId'>> => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      return [];
    }
    
    const headerLine = lines[0];
    const headersFromFile = (headerLine.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      ?.map(h => h.startsWith('"') && h.endsWith('"') ? h.slice(1, -1).replace(/""/g, '"').trim() : h.trim())
      || headerLine.split(',').map(h => h.trim()));

    if (lines.length === 1 && headersFromFile.length > 0) {
        return [];
    }

    const lowercasedHeadersFromFile = headersFromFile.map(h => h.toLowerCase());
    const baseRequiredHeaders = ["nome", "login"];
    const missingRequiredHeaders = baseRequiredHeaders.filter(expected => !lowercasedHeadersFromFile.includes(expected));
    if (missingRequiredHeaders.length > 0) {
      throw new Error(`Cabeçalho do CSV inválido. Colunas obrigatórias ausentes: ${missingRequiredHeaders.join(', ')}. As colunas mínimas são: ${baseRequiredHeaders.join(', ')}.`);
    }

    const headerMap: { [key: string]: number } = {};
    headersFromFile.forEach((originalHeader, index) => {
        headerMap[originalHeader.toLowerCase()] = index;
    });
    
    const entries: Array<Omit<PasswordEntry, 'id' | 'userId'>> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
                             ?.map(v => v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v.trim())
                             || lines[i].split(',').map(v => v.trim());
      
      if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

      const entry: Partial<Omit<PasswordEntry, 'id' | 'userId'>> & { customFields: Array<{label: string, value: string}> } = {
        customFields: [],
      };

      entry.nome = values[headerMap['nome']];
      entry.login = values[headerMap['login']];

      if (typeof headerMap['senha'] !== 'undefined') {
        entry.senha = values[headerMap['senha']] || undefined;
      }
      if (typeof headerMap['categoria'] !== 'undefined') {
        entry.categoria = values[headerMap['categoria']] || undefined;
      }
      
      if (!entry.nome || !entry.login) {
        continue;
      }

      headersFromFile.forEach((originalHeader, index) => {
        const lowerHeader = originalHeader.toLowerCase();
        if (!['nome', 'login', 'senha', 'categoria'].includes(lowerHeader) && values[index] && values[index].trim() !== "") {
          entry.customFields.push({ label: originalHeader, value: values[index] });
        }
      });
      entries.push(entry as Omit<PasswordEntry, 'id' | 'userId'>);
    }
    return entries;
  };

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null; // Ler userId do formData

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ message: 'User ID not provided in form data' }, { status: 400 });
    }

    const fileText = await file.text();
    const parsedEntriesFromFile = parseCSVToEntries(fileText);

    if (parsedEntriesFromFile.length === 0) {
        return NextResponse.json({ importedCount: 0, message: "Nenhuma nova senha para importar do arquivo (pode estar vazio, conter apenas cabeçalho ou todas as senhas já existem)." }, { status: 200 });
    }

    const { passwordsCollection } = await connectToDatabase();
    // Filtrar senhas existentes pelo userId para verificar duplicatas para este usuário
    const existingPasswordsForUser = await passwordsCollection.find({ userId: userId }).project({ nome: 1, login: 1, _id: 0 }).toArray();
    
    const newEntriesToInsert: Array<Omit<PasswordEntry, 'id'>> = [];

    for (const entry of parsedEntriesFromFile) {
        const isDuplicateForUser = existingPasswordsForUser.some(existing => 
            existing.nome === entry.nome && existing.login === entry.login
        );
        if (!isDuplicateForUser) {
            newEntriesToInsert.push({
                ...entry, // nome, login, senha, categoria, customFields
                userId: userId, // Adicionar o userId do usuário logado
                categoria: entry.categoria || '',
                customFields: entry.customFields || []
            });
        }
    }

    if (newEntriesToInsert.length > 0) {
      await passwordsCollection.insertMany(newEntriesToInsert as any); // any para compatibilidade com Omit<PasswordEntry, 'id'>
    }
    
    return NextResponse.json({ importedCount: newEntriesToInsert.length }, { status: 200 });

  } catch (error: any) {
    console.error('Failed to import passwords:', error);
    return NextResponse.json({ message: 'Failed to import passwords', error: error.message || 'Unknown error' }, { status: 500 });
  }
}
