
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PasswordEntry } from '@/types';

const API_BASE_URL = '/api/passwords';

export function usePasswordManager(currentUserId?: string | null) { // currentUserId é o UID do Firebase
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPasswords = useCallback(async () => {
    if (!currentUserId) {
      setPasswords([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE_URL, {
        headers: {
          'X-User-ID': currentUserId, // Usaremos o UID do Firebase aqui
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch passwords: ${response.statusText}`);
      }
      const data: PasswordEntry[] = await response.json();
      setPasswords(data);
    } catch (err: any) {
      console.error("Failed to load passwords:", err);
      setError(err.message || 'An unknown error occurred while fetching passwords.');
      setPasswords([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchPasswords();
  }, [fetchPasswords]);

  const addPassword = useCallback(async (entryData: Omit<PasswordEntry, 'id' | 'userId'>) => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      setError(err.message);
      throw err;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = { ...entryData, userId: currentUserId };
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add password: ${response.statusText}`);
      }
      const newPassword: PasswordEntry = await response.json();
      setPasswords(prev => [...prev, newPassword]);
      // await fetchPasswords(); // Re-fetch or update locally
      return newPassword;
    } catch (err: any) {
      console.error("Failed to add password:", err);
      setError(err.message || 'An unknown error occurred while adding password.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const updatePassword = useCallback(async (updatedEntry: PasswordEntry) => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      setError(err.message);
      throw err;
    }
    if (updatedEntry.userId && updatedEntry.userId !== currentUserId) {
        const err = new Error('User not authorized to update this entry');
        setError(err.message);
        throw err;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = { ...updatedEntry, userId: currentUserId };
      const response = await fetch(`${API_BASE_URL}/${updatedEntry.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update password: ${response.statusText}`);
      }
      const returnedEntry: PasswordEntry = await response.json();
      setPasswords(prev => prev.map(p => p.id === returnedEntry.id ? returnedEntry : p));
      return returnedEntry;
    } catch (err: any) {
      console.error("Failed to update password:", err);
      setError(err.message || 'An unknown error occurred while updating password.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const deletePassword = useCallback(async (id: string) => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      setError(err.message);
      throw err;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete password: ${response.statusText}`);
      }
      setPasswords(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      console.error("Failed to delete password:", err);
      setError(err.message || 'An unknown error occurred while deleting password.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const importPasswords = useCallback(async (file: File): Promise<{ importedCount: number, message?: string }> => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      setError(err.message);
      throw err;
    }
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUserId); // Add userId to form data
      
      const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        body: formData,
        headers: { // API Key or other auth might be needed if your API is protected beyond X-User-ID
           'X-User-ID': currentUserId, // Still useful for direct identification on backend
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Failed to import passwords: ${response.statusText}`);
      }
      
      await fetchPasswords();
      return { importedCount: result.importedCount, message: result.message };
    } catch (err: any) {
      console.error("Failed to import passwords:", err);
      setError(err.message || 'An unknown error occurred during import.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPasswords, currentUserId]);
  
  const exportPasswordsToCSV = useCallback(async (): Promise<boolean> => {
    if (!currentUserId) {
      setError('User not authenticated for export.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/export`, {
        headers: {
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to export passwords: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "senhas_backup.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return true;
    } catch (err: any) {
      console.error("Failed to export passwords:", err);
      setError(err.message || 'An unknown error occurred during export.');
      return false; 
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

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

  const clearAllPasswords = useCallback(async () => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      setError(err.message);
      throw err;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/clear`, {
        method: 'POST',
        headers: {
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to clear passwords: ${response.statusText}`);
      }
      setPasswords([]);
    } catch (err: any) {
      console.error("Failed to clear passwords:", err);
      setError(err.message || 'An unknown error occurred while clearing passwords.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);


  return {
    passwords,
    isLoading,
    error,
    fetchPasswords,
    addPassword,
    updatePassword,
    deletePassword,
    importPasswords,
    generatePassword,
    clearAllPasswords,
    exportPasswordsToCSV,
  };
}
