
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PasswordEntry, SharedUser } from '@/types';

const API_BASE_URL = '/api/passwords';

async function parseErrorResponse(response: Response, defaultMessage: string): Promise<string> {
  try {
    const errorData = await response.json();
    return errorData.message || defaultMessage;
  } catch (e) {
    try {
        const textError = await response.text();
        if (textError) return textError;
    } catch (e) {
        // Ignore error parsing text
    }
    return defaultMessage;
  }
}

export function usePasswordManager(currentUserId?: string | null) {
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
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to fetch passwords: ${response.statusText}`);
        throw new Error(errorMessage);
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

  const addPassword = useCallback(async (entryData: Omit<PasswordEntry, 'id' | 'ownerId' | 'userId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy'>) => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      // setError(err.message); // Specific operation error, handled by caller
      throw err;
    }
    setIsLoading(true);
    // setError(null); // Clear global error for this specific operation
    try {
      const payload = { ...entryData }; 
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to add password: ${response.statusText}`);
        throw new Error(errorMessage);
      }
      const newPassword: PasswordEntry = await response.json();
      setPasswords(prev => [...prev, newPassword]);
      return newPassword;
    } catch (err: any) {
      // setError(err.message || 'An unknown error occurred while adding password.'); // Specific operation error, handled by caller
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const updatePassword = useCallback(async (updatedEntry: Omit<PasswordEntry, 'ownerId' | 'userId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy'> & { id: string }) => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      // setError(err.message); // Specific operation error, handled by caller
      throw err;
    }
    setIsLoading(true);
    // setError(null); // Clear global error for this specific operation
    try {
      const payload = { ...updatedEntry }; 
      const response = await fetch(`${API_BASE_URL}/${updatedEntry.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to update password: ${response.statusText}`);
        throw new Error(errorMessage);
      }
      const returnedEntry: PasswordEntry = await response.json();
      setPasswords(prev => prev.map(p => p.id === returnedEntry.id ? returnedEntry : p));
      return returnedEntry;
    } catch (err: any) {
      // setError(err.message || 'An unknown error occurred while updating password.'); // Specific operation error, handled by caller
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const deletePassword = useCallback(async (id: string) => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      // setError(err.message); // Specific operation error, handled by caller
      throw err;
    }
    setIsLoading(true);
    // setError(null); // Clear global error for this specific operation
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to delete password: ${response.statusText}`);
        throw new Error(errorMessage);
      }
      setPasswords(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true } : p).filter(p => !p.isDeleted));

    } catch (err: any) {
      // setError(err.message || 'An unknown error occurred while deleting password.'); // Specific operation error, handled by caller
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const importPasswords = useCallback(async (file: File): Promise<{ importedCount: number, message?: string }> => {
    if (!currentUserId) {
      const err = new Error('User not authenticated');
      // setError(err.message); // Specific operation error, handled by caller
      throw err;
    }
    setIsLoading(true);
    // setError(null); // Clear global error for this specific operation
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUserId); 
      
      const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        body: formData,
        headers: {
           'X-User-ID': currentUserId, // Still good to pass for backend consistency if needed, though form has it
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `Failed to import passwords: ${response.statusText}`);
      }
      
      await fetchPasswords(); // Refresh list after import
      return { importedCount: result.importedCount, message: result.message };
    } catch (err: any) {
      // setError(err.message || 'An unknown error occurred during import.'); // Specific operation error, handled by caller
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPasswords, currentUserId]);
  
  const exportPasswordsToCSV = useCallback(async (): Promise<boolean> => {
    if (!currentUserId) {
      // setError('User not authenticated for export.'); // Can be handled by caller with a toast
      return false; // Indicate failure
    }
    setIsLoading(true);
    setError(null); // Clear global error for this operation, if any
    try {
      const response = await fetch(`${API_BASE_URL}/export`, {
        headers: {
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to export passwords: ${response.statusText}`);
        throw new Error(errorMessage); // Caller will handle this with a toast
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
      // setError(err.message || 'An unknown error occurred during export.'); // Handled by caller with toast
      throw err; // Re-throw for caller to handle
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
      // setError(err.message); // Handled by caller
      throw err;
    }
    setIsLoading(true);
    // setError(null); // Clear global error
    try {
      const response = await fetch(`${API_BASE_URL}/clear`, {
        method: 'POST',
        headers: {
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to clear passwords: ${response.statusText}`);
        throw new Error(errorMessage);
      }
      // Mark all as deleted locally, or refetch
      setPasswords(prev => prev.map(p => ({...p, isDeleted: true })).filter(p => !p.isDeleted)); 
    } catch (err: any) {
      // setError(err.message || 'An unknown error occurred while clearing passwords.'); // Handled by caller
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);


  const sharePassword = useCallback(async (passwordId: string, userIdToShareWith: string, permission: 'read' | 'full'): Promise<SharedUser[] | undefined> => {
    if (!currentUserId) {
      const err = new Error('User not authenticated to share password');
      // setError(err.message); // Error handled by SharePasswordDialog
      throw err;
    }
    setIsLoading(true);
    // setError(null); // Clear global error for this operation
    try {
      const response = await fetch(`${API_BASE_URL}/${passwordId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId,
        },
        body: JSON.stringify({ userIdToShareWith, permission }),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to share password');
        throw new Error(errorMessage);
      }
      const { sharedWith } = await response.json() as { sharedWith: SharedUser[] };
      setPasswords(prev => prev.map(p => p.id === passwordId ? { ...p, sharedWith: sharedWith } : p));
      return sharedWith;
    } catch (err: any) {
      // setError(err.message || 'An unknown error occurred while sharing password.'); // Error handled by SharePasswordDialog
      throw err; 
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const updateSharePermission = useCallback(async (passwordId: string, sharedUserId: string, permission: 'read' | 'full'): Promise<SharedUser[] | undefined> => {
    if (!currentUserId) {
      const err = new Error('User not authenticated to update share permission');
      // setError(err.message); // Error handled by SharePasswordDialog
      throw err;
    }
    setIsLoading(true);
    // setError(null); // Clear global error for this operation
    try {
      const response = await fetch(`${API_BASE_URL}/${passwordId}/share/${sharedUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUserId,
        },
        body: JSON.stringify({ permission }),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to update share permission');
        throw new Error(errorMessage);
      }
      const { sharedWith } = await response.json() as { sharedWith: SharedUser[] };
      setPasswords(prev => prev.map(p => p.id === passwordId ? { ...p, sharedWith: sharedWith } : p));
      return sharedWith;
    } catch (err: any) {
      // setError(err.message || 'An unknown error occurred while updating share permission.'); // Error handled by SharePasswordDialog
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const removeShare = useCallback(async (passwordId: string, sharedUserId: string): Promise<SharedUser[] | undefined> => {
    if (!currentUserId) {
      const err = new Error('User not authenticated to remove share');
      // setError(err.message); // Error handled by SharePasswordDialog
      throw err;
    }
    setIsLoading(true);
    // setError(null); // Clear global error for this operation
    try {
      const response = await fetch(`${API_BASE_URL}/${passwordId}/share/${sharedUserId}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': currentUserId,
        },
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to remove share');
        throw new Error(errorMessage);
      }
      const { sharedWith } = await response.json() as { sharedWith: SharedUser[] };
      setPasswords(prev => prev.map(p => p.id === passwordId ? { ...p, sharedWith: sharedWith } : p));
      return sharedWith;
    } catch (err: any) {
      // setError(err.message || 'An unknown error occurred while removing share.'); // Error handled by SharePasswordDialog
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);


  return {
    passwords,
    isLoading,
    error, // This error state will now primarily reflect issues like initial data load failure
    fetchPasswords,
    addPassword,
    updatePassword,
    deletePassword,
    importPasswords,
    generatePassword,
    clearAllPasswords,
    exportPasswordsToCSV,
    sharePassword,
    updateSharePermission,
    removeShare,
  };
}

    