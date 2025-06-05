
import { NextResponse } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { PasswordEntry } from '@/types';

// Helper to escape CSV fields
const escapeCSVField = (field?: string | number | null): string => {
    if (field === null || typeof field === 'undefined') {
      return '""'; 
    }
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return `"${stringField}"`; // Always quote for safety, even if not strictly necessary
  };

export async function GET() {
  try {
    const { passwordsCollection } = await connectToDatabase();
    const passwordsFromDb = await passwordsCollection.find({}).toArray();
    const passwords = passwordsFromDb.map(doc => fromMongo(doc as any)) as PasswordEntry[];

    if (passwords.length === 0) {
      return NextResponse.json({ message: "No passwords to export" }, { status: 404 });
    }

    const fixedHeaders = ["nome", "login", "senha", "categoria"];
    const customFieldLabels = new Set<string>();
    passwords.forEach(p => {
      p.customFields?.forEach(cf => {
        if (cf.label && !fixedHeaders.includes(cf.label.toLowerCase())) { // Avoid duplicating fixed headers
             customFieldLabels.add(cf.label);
        }
      });
    });
    const sortedCustomFieldLabels = Array.from(customFieldLabels).sort();
    const allHeaders = [...fixedHeaders, ...sortedCustomFieldLabels];
    
    const csvRows = [
      allHeaders.map(escapeCSVField).join(','), 
      ...passwords.map(p => {
        const rowValues: { [key: string]: string | undefined } = {
          nome: p.nome,
          login: p.login,
          senha: p.senha,
          categoria: p.categoria,
        };
        
        p.customFields?.forEach(cf => {
          if (cf.label) { // Ensure label exists
            rowValues[cf.label] = cf.value;
          }
        });

        return allHeaders.map(header => escapeCSVField(rowValues[header])).join(',');
      })
    ];
    const csvString = csvRows.join('\r\n');

    return new NextResponse(csvString, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="senhas_backup.csv"',
      },
    });

  } catch (error) {
    console.error('Failed to export passwords:', error);
    return NextResponse.json({ message: 'Failed to export passwords' }, { status: 500 });
  }
}
