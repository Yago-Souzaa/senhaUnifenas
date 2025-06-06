
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PasswordEntry, SharedUser, Group, GroupMember } from '@/types';

const API_BASE_URL = '/api/passwords';
const GROUPS_API_BASE_URL = '/api/groups';


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
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // For global errors like initial load

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

  const fetchGroups = useCallback(async () => {
    if (!currentUserId) {
      setGroups([]);
      // Not setting isLoading here as it might be called independently
      return;
    }
    // setIsLoading(true); // Could be a separate loading state for groups
    setError(null);
    try {
      const response = await fetch(GROUPS_API_BASE_URL, {
        headers: {
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to fetch groups: ${response.statusText}`);
        throw new Error(errorMessage);
      }
      const data: Group[] = await response.json();
      setGroups(data);
    } catch (err: any) {
      console.error("Failed to load groups:", err);
      // setError(err.message || 'An unknown error occurred while fetching groups.'); // Avoid overwriting password load error
      setGroups([]);
      throw err; // Re-throw for UI to handle if needed
    } finally {
      // setIsLoading(false);
    }
  }, [currentUserId]);


  useEffect(() => {
    fetchPasswords();
    fetchGroups(); // Fetch groups along with passwords
  }, [fetchPasswords, fetchGroups]);

  const addPassword = useCallback(async (entryData: Omit<PasswordEntry, 'id' | 'ownerId' | 'userId' | 'sharedWith' | 'sharedWithGroupIds' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt'>) => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
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
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const updatePassword = useCallback(async (updatedEntry: Omit<PasswordEntry, 'ownerId' | 'userId' | 'sharedWith' | 'sharedWithGroupIds' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt'> & {id: string}) => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
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
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const deletePassword = useCallback(async (id: string) => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
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
      // API handles soft delete, client refetches or filters based on isDeleted
      setPasswords(prev => prev.filter(p => p.id !== id)); // Optimistic update, or refetch
      // await fetchPasswords(); // Or refetch
    } catch (err: any) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const importPasswords = useCallback(async (file: File): Promise<{ importedCount: number, message?: string }> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUserId); 
      
      const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        body: formData,
        headers: {
           'X-User-ID': currentUserId,
        }
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to import passwords: ${response.statusText}`);
      }
      await fetchPasswords();
      return { importedCount: result.importedCount, message: result.message };
    } catch (err: any) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPasswords, currentUserId]);
  
  const exportPasswordsToCSV = useCallback(async (): Promise<boolean> => {
    if (!currentUserId) throw new Error('User not authenticated for export.');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/export`, {
        headers: {
          'X-User-ID': currentUserId,
        }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to export passwords: ${response.statusText}`);
        throw new Error(errorMessage);
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
      throw err;
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
    if (charset === "") charset = lower; 
    let newPassword = "";
    for (let i = 0; i < length; i++) {
        newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return newPassword;
  }, []);

  const clearAllPasswords = useCallback(async () => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
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
      setPasswords([]); 
    } catch (err: any) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const sharePassword = useCallback(async (passwordId: string, userIdToShareWith: string, permission: 'read' | 'full'): Promise<SharedUser[] | undefined> => {
    if (!currentUserId) throw new Error('User not authenticated to share password');
    setIsLoading(true);
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
      throw err; 
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const updateSharePermission = useCallback(async (passwordId: string, sharedUserId: string, permission: 'read' | 'full'): Promise<SharedUser[] | undefined> => {
    if (!currentUserId) throw new Error('User not authenticated to update share permission');
    setIsLoading(true);
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
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  const removeShare = useCallback(async (passwordId: string, sharedUserId: string): Promise<SharedUser[] | undefined> => {
    if (!currentUserId) throw new Error('User not authenticated to remove share');
    setIsLoading(true);
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
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // Group Management Functions
  const createGroup = useCallback(async (name: string): Promise<Group> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const response = await fetch(GROUPS_API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': currentUserId },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to create group');
        throw new Error(errorMessage);
      }
      const newGroup: Group = await response.json();
      setGroups(prev => [...prev, newGroup]);
      return newGroup;
    } catch (err) { throw err; } 
    finally { setIsLoading(false); }
  }, [currentUserId]);

  const addGroupMember = useCallback(async (groupId: string, userIdToAdd: string, role: 'member' | 'admin'): Promise<GroupMember[]> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const response = await fetch(`${GROUPS_API_BASE_URL}/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': currentUserId },
        body: JSON.stringify({ userIdToAdd, role }),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to add group member');
        throw new Error(errorMessage);
      }
      const { members } = await response.json() as { members: GroupMember[] };
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, members } : g));
      return members;
    } catch (err) { throw err; }
    finally { setIsLoading(false); }
  }, [currentUserId]);

  const removeGroupMember = useCallback(async (groupId: string, memberUidToRemove: string): Promise<GroupMember[]> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const response = await fetch(`${GROUPS_API_BASE_URL}/${groupId}/members/${memberUidToRemove}`, {
        method: 'DELETE',
        headers: { 'X-User-ID': currentUserId },
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to remove group member');
        throw new Error(errorMessage);
      }
      const { members } = await response.json() as { members: GroupMember[] };
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, members } : g));
      return members;
    } catch (err) { throw err; }
    finally { setIsLoading(false); }
  }, [currentUserId]);
  
  const updateGroupMemberRole = useCallback(async (groupId: string, memberUid: string, role: 'member' | 'admin'): Promise<GroupMember[]> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const response = await fetch(`${GROUPS_API_BASE_URL}/${groupId}/members/${memberUid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': currentUserId },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to update member role');
        throw new Error(errorMessage);
      }
      const { members } = await response.json() as { members: GroupMember[] };
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, members } : g));
      return members;
    } catch (err) { throw err; }
    finally { setIsLoading(false); }
  }, [currentUserId]);


  const deleteGroup = useCallback(async (groupId: string): Promise<void> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const response = await fetch(`${GROUPS_API_BASE_URL}/${groupId}`, {
        method: 'DELETE',
        headers: { 'X-User-ID': currentUserId },
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to delete group');
        throw new Error(errorMessage);
      }
      setGroups(prev => prev.filter(g => g.id !== groupId));
      await fetchPasswords(); // Passwords might have been unshared from this group
    } catch (err) { throw err; }
    finally { setIsLoading(false); }
  }, [currentUserId, fetchPasswords]);
  
  const updateGroup = useCallback(async (groupId: string, name: string): Promise<Group> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const response = await fetch(`${GROUPS_API_BASE_URL}/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': currentUserId },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to update group');
        throw new Error(errorMessage);
      }
      const updatedGroup: Group = await response.json();
      setGroups(prev => prev.map(g => g.id === groupId ? updatedGroup : g));
      return updatedGroup;
    } catch (err) { throw err; }
    finally { setIsLoading(false); }
  }, [currentUserId]);


  // Password-Group Sharing Functions
  const sharePasswordWithGroup = useCallback(async (passwordId: string, groupId: string): Promise<string[] | undefined> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/${passwordId}/shareWithGroup/${groupId}`, {
        method: 'POST',
        headers: { 'X-User-ID': currentUserId },
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to share password with group');
        throw new Error(errorMessage);
      }
      const { sharedWithGroupIds } = await response.json() as { sharedWithGroupIds: string[] };
      setPasswords(prev => prev.map(p => p.id === passwordId ? { ...p, sharedWithGroupIds } : p));
      return sharedWithGroupIds;
    } catch (err) { throw err; }
    finally { setIsLoading(false); }
  }, [currentUserId]);

  const unsharePasswordFromGroup = useCallback(async (passwordId: string, groupId: string): Promise<string[] | undefined> => {
    if (!currentUserId) throw new Error('User not authenticated');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/${passwordId}/shareWithGroup/${groupId}`, {
        method: 'DELETE',
        headers: { 'X-User-ID': currentUserId },
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to unshare password from group');
        throw new Error(errorMessage);
      }
      const { sharedWithGroupIds } = await response.json() as { sharedWithGroupIds: string[] };
      setPasswords(prev => prev.map(p => p.id === passwordId ? { ...p, sharedWithGroupIds } : p));
      return sharedWithGroupIds;
    } catch (err) { throw err; }
    finally { setIsLoading(false); }
  }, [currentUserId]);


  return {
    passwords,
    groups,
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
    sharePassword,
    updateSharePermission,
    removeShare,
    // Group functions
    fetchGroups,
    createGroup,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    updateGroupMemberRole,
    deleteGroup,
    sharePasswordWithGroup,
    unsharePasswordFromGroup,
  };
}
