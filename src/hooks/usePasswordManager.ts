
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PasswordEntry } from '@/types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

const STORAGE_KEY = 'senhaFacilPasswords';

// Helper to migrate old data if necessary
const migrateOldEntry = (entry: any): PasswordEntry => {
  const newEntry: PasswordEntry = {
    id: entry.id,
    nome: entry.nome,
    login: entry.login,
    senha: entry.senha,
    customFields: entry.customFields || [],
  };

  const oldFieldsToMigrate: Array<{ oldKey: string; label: string }> = [
    // @ts-ignore
    { oldKey: 'ip', label: 'IP' },
    // @ts-ignore
    { oldKey: 'funcao', label: 'Função' },
    // @ts-ignore
    { oldKey: 'acesso', label: 'Acesso' },
    // @ts-ignore
    { oldKey: 'versao', label: 'Versão' },
  ];

  oldFieldsToMigrate.forEach(({ oldKey, label }) => {
    // @ts-ignore
    if (entry[oldKey] && !newEntry.customFields?.some(cf => cf.label === label)) {
      // @ts-ignore
      newEntry.customFields?.push({ label, value: entry[oldKey] });
    }
  });
  // Remove old keys from the direct entry object after migration
  // delete newEntry.ip; 
  // delete newEntry.funcao;
  // delete newEntry.acesso;
  // delete newEntry.versao;

  return newEntry;
};


export function usePasswordManager() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedPasswordsJson = localStorage.getItem(STORAGE_KEY);
      if (storedPasswordsJson) {
        const storedPasswordsRaw = JSON.parse(storedPasswordsJson);
        const migratedPasswords = storedPasswordsRaw.map(migrateOldEntry);
        setPasswords(migratedPasswords);
        // Optionally, re-save migrated data if structure changed significantly during migration step
        // For this specific migration, the savePasswords in consuming components will handle it if an update occurs.
        // However, if migration itself *must* persist, an explicit save here would be needed.
        // localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedPasswords)); 
      }
    } catch (error) {
      console.error("Failed to load passwords from local storage:", error);
    }
    setIsLoading(false);
  }, []);

  const savePasswords = useCallback((updatedPasswords: PasswordEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPasswords));
      setPasswords(updatedPasswords);
    } catch (error) {
      console.error("Failed to save passwords to local storage:", error);
    }
  }, []);

  const addPassword = useCallback((entryData: Omit<PasswordEntry, 'id'>) => {
    const newPassword: PasswordEntry = { ...entryData, id: uuidv4() };
    const updatedPasswords = [...passwords, newPassword];
    savePasswords(updatedPasswords);
    return newPassword;
  }, [passwords, savePasswords]);

  const updatePassword = useCallback((updatedEntry: PasswordEntry) => {
    const updatedPasswords = passwords.map(p => p.id === updatedEntry.id ? updatedEntry : p);
    savePasswords(updatedPasswords);
    return updatedEntry;
  }, [passwords, savePasswords]);

  const deletePassword = useCallback((id: string) => {
    const updatedPasswords = passwords.filter(p => p.id !== id);
    savePasswords(updatedPasswords);
  }, [passwords, savePasswords]);

  const importPasswords = useCallback((entriesFromFile: Array<Omit<PasswordEntry, 'id'>>) => {
    // The entriesFromFile already contain customFields correctly mapped by parseCSV
    const newEntriesWithId = entriesFromFile.map(entry => ({ ...entry, id: uuidv4() }));
    
    const uniqueNewEntries = newEntriesWithId.filter(newEntry => 
      !passwords.some(existing => existing.nome === newEntry.nome && existing.login === newEntry.login)
    );
    
    if (uniqueNewEntries.length > 0) {
      const updatedPasswords = [...passwords, ...uniqueNewEntries];
      savePasswords(updatedPasswords);
    }
    return uniqueNewEntries; // Return only the ones that were actually added
  }, [passwords, savePasswords]);
  
  const generatePassword = useCallback((length: number, useUppercase: boolean, useLowercase: boolean, useNumbers: boolean, useSymbols: boolean): string => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const nums = "0123456789";
    const syms = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
    
    let charset = "";
    if (useUppercase) charset += upper;
    if (useLowercase) charset += lower;
    if (useNumbers) charset += nums;
    if (useSymbols) charset += syms;

    if (charset === "") {
        charset = lower; 
    }

    let newPassword = "";
    for (let i = 0; i < length; i++) {
        newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return newPassword;
  }, []);

  const clearAllPasswords = useCallback(() => {
    savePasswords([]);
  }, [savePasswords]);

  const escapeCSVField = (field?: string): string => {
    if (field === null || typeof field === 'undefined') {
      return '""'; 
    }
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return `"${stringField}"`; 
  };
  
  const exportPasswordsToCSV = useCallback(() => {
    if (passwords.length === 0) {
      return false;
    }

    const fixedHeaders = ["nome", "login", "senha"];
    
    // Collect all unique custom field labels
    const customFieldLabels = new Set<string>();
    passwords.forEach(p => {
      p.customFields?.forEach(cf => customFieldLabels.add(cf.label));
    });
    const sortedCustomFieldLabels = Array.from(customFieldLabels).sort();

    const allHeaders = [...fixedHeaders, ...sortedCustomFieldLabels];
    
    const csvRows = [
      allHeaders.map(escapeCSVField).join(','), // Header row
      ...passwords.map(p => {
        const row = [
          escapeCSVField(p.nome),
          escapeCSVField(p.login),
          escapeCSVField(p.senha),
        ];
        sortedCustomFieldLabels.forEach(label => {
          const customField = p.customFields?.find(cf => cf.label === label);
          row.push(escapeCSVField(customField?.value));
        });
        return row.join(',');
      })
    ];
    const csvString = csvRows.join('\r\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "senhas_backup.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
    }
    return false;
  }, [passwords]);

  return {
    passwords,
    isLoading,
    addPassword,
    updatePassword,
    deletePassword,
    importPasswords,
    generatePassword,
    clearAllPasswords,
    exportPasswordsToCSV,
  };
}
