'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PasswordEntry } from '@/types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

const STORAGE_KEY = 'senhaFacilPasswords';

export function usePasswordManager() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedPasswords = localStorage.getItem(STORAGE_KEY);
      if (storedPasswords) {
        setPasswords(JSON.parse(storedPasswords));
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

  const addPassword = useCallback((entry: Omit<PasswordEntry, 'id'>) => {
    const newPassword: PasswordEntry = { ...entry, id: uuidv4() };
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

  const importPasswords = useCallback((entries: Omit<PasswordEntry, 'id'>[]) => {
    const newEntries = entries.map(entry => ({ ...entry, id: uuidv4() }));
    const uniqueNewEntries = newEntries.filter(newEntry => 
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
      return '""';
    }
    const stringField = String(field);
    // If the field contains a comma, newline, or double quote, wrap it in double quotes.
    // Also, double up any existing double quotes.
    if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return `"${stringField}"`; // Always wrap in quotes for consistency
  };
  
  const exportPasswordsToCSV = useCallback(() => {
    if (passwords.length === 0) {
      alert("Nenhuma senha para exportar."); // Or use toast
      return;
    }

    const headers = ["nome", "ip", "login", "senha", "funcao", "acesso", "versao"];
    const csvRows = [
      headers.join(','), // Header row
      ...passwords.map(p => 
        [
          escapeCSVField(p.nome),
          escapeCSVField(p.ip),
          escapeCSVField(p.login),
          escapeCSVField(p.senha),
          escapeCSVField(p.funcao),
          escapeCSVField(p.acesso),
          escapeCSVField(p.versao),
        ].join(',')
      )
    ];
    const csvString = csvRows.join('\r\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "senhas_backup.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
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
