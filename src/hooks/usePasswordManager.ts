
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PasswordEntry } from '@/types';
// v4 as uuidv4 is no longer needed as MongoDB generates IDs

const API_BASE_URL = '/api/passwords';

export function usePasswordManager() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPasswords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE_URL);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch passwords: ${response.statusText}`);
      }
      const data: PasswordEntry[] = await response.json();
      setPasswords(data);
    } catch (err: any) {
      console.error("Failed to load passwords:", err);
      setError(err.message || 'An unknown error occurred while fetching passwords.');
      setPasswords([]); // Clear passwords on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasswords();
  }, [fetchPasswords]);

  const addPassword = useCallback(async (entryData: Omit<PasswordEntry, 'id'>) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add password: ${response.statusText}`);
      }
      const newPassword: PasswordEntry = await response.json();
      setPasswords(prev => [...prev, newPassword]); // Optimistic update possible here too
      await fetchPasswords(); // Re-fetch to ensure consistency
      return newPassword;
    } catch (err: any) {
      console.error("Failed to add password:", err);
      setError(err.message || 'An unknown error occurred while adding password.');
      throw err; // Re-throw to be caught by caller for toast messages
    } finally {
      setIsLoading(false);
    }
  }, [fetchPasswords]);

  const updatePassword = useCallback(async (updatedEntry: PasswordEntry) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${updatedEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEntry),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to update password: ${response.statusText}`);
      }
      const returnedEntry: PasswordEntry = await response.json();
      setPasswords(prev => prev.map(p => p.id === returnedEntry.id ? returnedEntry : p));
      // await fetchPasswords(); // Re-fetch or update locally
      return returnedEntry;
    } catch (err: any) {
      console.error("Failed to update password:", err);
      setError(err.message || 'An unknown error occurred while updating password.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deletePassword = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete password: ${response.statusText}`);
      }
      setPasswords(prev => prev.filter(p => p.id !== id));
      // await fetchPasswords(); // Re-fetch or update locally
    } catch (err: any) {
      console.error("Failed to delete password:", err);
      setError(err.message || 'An unknown error occurred while deleting password.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Import is now handled by an API endpoint. The hook provides a function to call that endpoint.
  const importPasswords = useCallback(async (file: File): Promise<{ importedCount: number, message?: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        body: formData, // No Content-Type header needed, browser sets it for FormData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Failed to import passwords: ${response.statusText}`);
      }
      
      await fetchPasswords(); // Refresh the list after import
      return { importedCount: result.importedCount, message: result.message };
    } catch (err: any) {
      console.error("Failed to import passwords:", err);
      setError(err.message || 'An unknown error occurred during import.');
      throw err; // Re-throw for UI handling
    } finally {
      setIsLoading(false);
    }
  }, [fetchPasswords]);
  
  // Export is now handled by an API endpoint. This function triggers the download.
  const exportPasswordsToCSV = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/export`);
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
      // No throw here, let the UI handle toast based on boolean
      return false; 
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/clear`, {
        method: 'POST', // Use POST for destructive operations
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to clear passwords: ${response.statusText}`);
      }
      setPasswords([]);
      // await fetchPasswords(); // Re-fetch or update locally
    } catch (err: any) {
      console.error("Failed to clear passwords:", err);
      setError(err.message || 'An unknown error occurred while clearing passwords.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);


  return {
    passwords,
    isLoading,
    error, // Expose error state to UI
    fetchPasswords, // Expose fetch for manual refresh if needed
    addPassword,
    updatePassword,
    deletePassword,
    importPasswords,
    generatePassword,
    clearAllPasswords,
    exportPasswordsToCSV,
  };
}
