
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

  // Migrate old optional fields to customFields if they exist and aren't already there
  const oldFieldsToMigrate: Array<{ oldKey: keyof PasswordEntry; label: string }> = [
    { oldKey: 'ip', label: 'IP' },
    { oldKey: 'funcao', label: 'Função' },
    { oldKey: 'acesso', label: 'Acesso' },
    { oldKey: 'versao', label: 'Versão' },
  ];

  oldFieldsToMigrate.forEach(({ oldKey, label }) => {
    if (entry[oldKey] && !newEntry.customFields?.some(cf => cf.label === label)) {
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
        // Migrate data on load
        const migratedPasswords = storedPasswordsRaw.map(migrateOldEntry);
        setPasswords(migratedPasswords);
        // Optionally, re-save migrated data
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedPasswords));
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

  const importPasswords = useCallback((entries: Array<Omit<PasswordEntry, 'id'>>) => {
    const newEntriesWithId = entries.map(entry => ({ ...entry, id: uuidv4() }));
    
    const uniqueNewEntries = newEntriesWithId.filter(newEntry => 
      !passwords.some(existing => existing.nome === newEntry.nome && existing.login === newEntry.login)
    );
    
    const updatedPasswords = [...passwords, ...uniqueNewEntries];
    savePasswords(updatedPasswords);
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
      return '""'; // Return empty quoted string for undefined/null
    }
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return `"${stringField}"`; // Always wrap in quotes for consistency
  };

  const getCustomFieldValue = (fields: Array<{label: string; value: string}> | undefined, label: string): string | undefined => {
    return fields?.find(f => f.label.toLowerCase() === label.toLowerCase())?.value;
  };
  
  const exportPasswordsToCSV = useCallback(() => {
    if (passwords.length === 0) {
      // toast({ title: "Nada para Exportar", description: "Não há senhas para exportar.", variant: "default" });
      // This should be handled by the caller UI
      return false;
    }

    // Fixed headers plus common custom fields
    const headers = ["nome", "login", "senha", "ip", "funcao", "acesso", "versao"];
    
    const csvRows = [
      headers.join(','),
      ...passwords.map(p => 
        [
          escapeCSVField(p.nome),
          escapeCSVField(p.login),
          escapeCSVField(p.senha),
          escapeCSVField(getCustomFieldValue(p.customFields, "IP")),
          escapeCSVField(getCustomFieldValue(p.customFields, "Função")),
          escapeCSVField(getCustomFieldValue(p.customFields, "Acesso")),
          escapeCSVField(getCustomFieldValue(p.customFields, "Versão")),
        ].join(',')
      )
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
