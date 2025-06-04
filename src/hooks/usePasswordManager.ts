
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
    categoria: entry.categoria || '', // Adiciona categoria, default para string vazia se não existir
    customFields: entry.customFields || [],
  };

  // Lógica de migração de campos legados para customFields (se aplicável em versões futuras)
  // const oldFieldsToMigrate: Array<{ oldKey: string; label: string }> = [
  //   { oldKey: 'ip', label: 'IP' },
  // ];
  // oldFieldsToMigrate.forEach(({ oldKey, label }) => {
  //   if (entry[oldKey] && !newEntry.customFields?.some(cf => cf.label === label)) {
  //     newEntry.customFields?.push({ label, value: entry[oldKey] });
  //   }
  // });

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
    const newEntriesWithId = entriesFromFile.map(entry => ({
        ...entry,
        id: uuidv4(),
        categoria: entry.categoria || '', // Garante que categoria exista
    }));
    
    const uniqueNewEntries = newEntriesWithId.filter(newEntry => 
      !passwords.some(existing => existing.nome === newEntry.nome && existing.login === newEntry.login)
    );
    
    if (uniqueNewEntries.length > 0) {
      const updatedPasswords = [...passwords, ...uniqueNewEntries];
      savePasswords(updatedPasswords);
    }
    return uniqueNewEntries; 
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

    const fixedHeaders = ["nome", "login", "senha", "categoria"]; // Adiciona categoria aqui
    
    const customFieldLabels = new Set<string>();
    passwords.forEach(p => {
      p.customFields?.forEach(cf => customFieldLabels.add(cf.label));
    });
    const sortedCustomFieldLabels = Array.from(customFieldLabels).sort();

    const allHeaders = [...fixedHeaders, ...sortedCustomFieldLabels];
    
    const csvRows = [
      allHeaders.map(escapeCSVField).join(','), 
      ...passwords.map(p => {
        const row = [
          escapeCSVField(p.nome),
          escapeCSVField(p.login),
          escapeCSVField(p.senha),
          escapeCSVField(p.categoria), // Adiciona valor da categoria
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
