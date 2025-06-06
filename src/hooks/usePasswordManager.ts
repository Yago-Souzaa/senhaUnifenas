
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PasswordEntry, Group, GroupMember, CategoryShare } from '@/types'; // Added CategoryShare

const API_BASE_URL = '/api/passwords';
const GROUPS_API_BASE_URL = '/api/groups';
const CATEGORIES_API_BASE_URL = '/api/categories'; // New base URL for categories

async function parseErrorResponse(response: Response, defaultMessage: string): Promise<string> {
  try {
    const errorData = await response.json();
    return errorData.message || defaultMessage;
  } catch (e) {
    try {
        const textError = await response.text();
        if (textError) return textError;
    } catch (parseTextError) {
        // Ignore error parsing text
    }
    return defaultMessage;
  }
}

export function usePasswordManager(currentUserId?: string | null) {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Global loading for initial data
  const [error, setError] = useState<string | null>(null); // Global error for initial data load

  const fetchPasswords = useCallback(async () => {
    if (!currentUserId) {
      setPasswords([]);
      // Do not set isLoading to false here if part of a larger initial load
      return;
    }
    // setError(null); // Clear previous global errors before trying
    try {
      const response = await fetch(API_BASE_URL, {
        headers: { 'X-User-ID': currentUserId }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to fetch passwords`);
        throw new Error(errorMessage);
      }
      const data: PasswordEntry[] = await response.json();
      setPasswords(data);
    } catch (err: any) {
      console.error("Failed to load passwords:", err);
      setError(err.message || 'An unknown error occurred while fetching passwords.');
      setPasswords([]); // Clear passwords on error
    }
  }, [currentUserId]);

  const fetchGroups = useCallback(async () => {
    if (!currentUserId) {
      setGroups([]);
      return;
    }
    try {
      const response = await fetch(GROUPS_API_BASE_URL, {
        headers: { 'X-User-ID': currentUserId }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to fetch groups`);
        throw new Error(errorMessage);
      }
      const data: Group[] = await response.json();
      setGroups(data);
    } catch (err: any) {
      console.error("Failed to load groups in hook:", err);
      // Do not set global error here, let calling component handle if needed
      setGroups([]);
      throw err;
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      setIsLoading(true);
      setError(null); // Clear previous errors
      Promise.all([
        fetchPasswords(),
        fetchGroups().catch(err => {
          console.warn("Initial group fetch failed in usePasswordManager useEffect:", err.message);
          // This error is not critical for the main password list, so don't set global error
          // setError(err.message || "Failed to fetch groups initially.");
        })
      ]).catch(globalError => {
        // This catch is for errors from fetchPasswords or if fetchGroups re-throws critically
        setError(globalError.message || "An error occurred during initial data loading.");
      }).finally(() => {
        setIsLoading(false);
      });
    } else {
      setPasswords([]);
      setGroups([]);
      setIsLoading(false);
      setError(null);
    }
  }, [currentUserId, fetchPasswords, fetchGroups]);


  const addPassword = useCallback(async (entryData: Omit<PasswordEntry, 'id' | 'ownerId' | 'userId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt' | 'sharedVia'>) => {
    if (!currentUserId) throw new Error('User not authenticated');
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
        const errorMessage = await parseErrorResponse(response, `Failed to add password`);
        throw new Error(errorMessage);
      }
      const newPassword: PasswordEntry = await response.json();
      setPasswords(prev => [...prev, newPassword].sort((a,b) => a.nome.localeCompare(b.nome))); // Keep sorted for consistency
      return newPassword;
    } catch (err: any) {
      console.error("Error in addPassword:", err);
      throw err;
    }
  }, [currentUserId]);

  const updatePassword = useCallback(async (updatedEntry: Omit<PasswordEntry, 'ownerId' | 'userId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt' | 'sharedVia'> & {id: string}) => {
    if (!currentUserId) throw new Error('User not authenticated');
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
        const errorMessage = await parseErrorResponse(response, `Failed to update password`);
        throw new Error(errorMessage);
      }
      const returnedEntry: PasswordEntry = await response.json();
      setPasswords(prev => prev.map(p => p.id === returnedEntry.id ? returnedEntry : p).sort((a,b) => a.nome.localeCompare(b.nome)));
      return returnedEntry;
    } catch (err: any) {
      console.error("Error in updatePassword:", err);
      throw err;
    }
  }, [currentUserId]);

  const deletePassword = useCallback(async (id: string) => {
    if (!currentUserId) throw new Error('User not authenticated');
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'X-User-ID': currentUserId }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to delete password`);
        throw new Error(errorMessage);
      }
      // Optimistically remove, or re-fetch passwords for consistency with soft delete
      setPasswords(prev => prev.filter(p => p.id !== id));
      // For soft delete, better to refetch or update the specific item's isDeleted flag
      // await fetchPasswords();
    } catch (err: any) {
      console.error("Error in deletePassword:", err);
      throw err;
    }
  }, [currentUserId]);

  const importPasswords = useCallback(async (file: File): Promise<{ importedCount: number, message?: string }> => {
    if (!currentUserId) throw new Error('User not authenticated');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUserId);

      const response = await fetch(`${API_BASE_URL}/import`, {
        method: 'POST',
        body: formData,
        // No 'Content-Type' for FormData, browser sets it with boundary
        headers: { 'X-User-ID': currentUserId }
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to import passwords`);
      }
      await fetchPasswords(); // Refresh password list
      return { importedCount: result.importedCount, message: result.message };
    } catch (err: any) {
      console.error("Error in importPasswords:", err);
      throw err;
    }
  }, [fetchPasswords, currentUserId]);

  const exportPasswordsToCSV = useCallback(async (): Promise<boolean> => {
    if (!currentUserId) throw new Error('User not authenticated for export.');
    try {
      const response = await fetch(`${API_BASE_URL}/export`, {
        headers: { 'X-User-ID': currentUserId }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to export passwords`);
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
      console.error("Error in exportPasswordsToCSV:", err);
      throw err;
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
    if (charset === "") charset = lower + nums; // Default to something if nothing selected
    let newPassword = "";
    for (let i = 0; i < length; i++) {
        newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return newPassword;
  }, []);

  const clearAllPasswords = useCallback(async () => {
    if (!currentUserId) throw new Error('User not authenticated');
    try {
      const response = await fetch(`${API_BASE_URL}/clear`, {
        method: 'POST', // Ensure API matches this
        headers: { 'X-User-ID': currentUserId }
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, `Failed to clear passwords`);
        throw new Error(errorMessage);
      }
      setPasswords([]);
    } catch (err: any) {
      console.error("Error in clearAllPasswords:", err);
      throw err;
    }
  }, [currentUserId]);

  // Group Management Functions
  const createGroup = useCallback(async (name: string): Promise<Group> => {
    if (!currentUserId) throw new Error('User not authenticated');
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
      setGroups(prev => [...prev, newGroup].sort((a,b) => a.name.localeCompare(b.name)));
      return newGroup;
    } catch (err) {
      console.error("Error in createGroup:", err);
      throw err;
    }
  }, [currentUserId]);

  const addGroupMember = useCallback(async (groupId: string, userIdToAdd: string, role: 'member' | 'admin'): Promise<Group> => {
    if (!currentUserId) throw new Error('User not authenticated');
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
      // API returns { members: GroupMember[] }
      const { members } = await response.json() as { members: GroupMember[] };
      let updatedGroup: Group | undefined;
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          updatedGroup = { ...g, members: members.sort((a,b) => a.userId.localeCompare(b.userId)) };
          return updatedGroup;
        }
        return g;
      }));
      if (!updatedGroup) throw new Error("Group not found after adding member in hook."); // Should be unreachable
      return updatedGroup;
    } catch (err) {
      console.error("Error in addGroupMember:", err);
      throw err;
    }
  }, [currentUserId]);

  const removeGroupMember = useCallback(async (groupId: string, memberUidToRemove: string): Promise<Group> => {
    if (!currentUserId) throw new Error('User not authenticated');
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
      let updatedGroup: Group | undefined;
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          updatedGroup = { ...g, members: members.sort((a,b) => a.userId.localeCompare(b.userId)) };
          return updatedGroup;
        }
        return g;
      }));
      if (!updatedGroup) throw new Error("Group not found after removing member in hook.");
      return updatedGroup;
    } catch (err) {
      console.error("Error in removeGroupMember:", err);
      throw err;
    }
  }, [currentUserId]);

  const updateGroupMemberRole = useCallback(async (groupId: string, memberUid: string, role: 'member' | 'admin'): Promise<Group> => {
    if (!currentUserId) throw new Error('User not authenticated');
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
      let updatedGroup: Group | undefined;
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          updatedGroup = { ...g, members: members.sort((a,b) => a.userId.localeCompare(b.userId)) };
          return updatedGroup;
        }
        return g;
      }));
      if (!updatedGroup) throw new Error("Group not found after updating member role in hook.");
      return updatedGroup;
    } catch (err) {
      console.error("Error in updateGroupMemberRole:", err);
      throw err;
    }
  }, [currentUserId]);

  const deleteGroup = useCallback(async (groupId: string): Promise<void> => {
    if (!currentUserId) throw new Error('User not authenticated');
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
      await fetchPasswords(); // Passwords might have been unshared from this group implicitly
    } catch (err) {
      console.error("Error in deleteGroup:", err);
      throw err;
    }
  }, [currentUserId, fetchPasswords]);

  const updateGroup = useCallback(async (groupId: string, name: string): Promise<Group> => {
    if (!currentUserId) throw new Error('User not authenticated');
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
      const updatedGroupData: Group = await response.json();
      setGroups(prev => prev.map(g => g.id === groupId ? updatedGroupData : g).sort((a,b) => a.name.localeCompare(b.name)));
      return updatedGroupData;
    } catch (err) {
      console.error("Error in updateGroup:", err);
      throw err;
    }
  }, [currentUserId]);

  // Category Sharing Functions
  const shareCategoryWithGroup = useCallback(async (categoryName: string, groupId: string): Promise<CategoryShare | undefined> => {
    if (!currentUserId) throw new Error('User not authenticated for sharing category');
    try {
      const response = await fetch(`${CATEGORIES_API_BASE_URL}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': currentUserId },
        body: JSON.stringify({ categoryName, groupId }),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to share category');
        throw new Error(errorMessage);
      }
      const newShare: CategoryShare = await response.json();
      await fetchPasswords(); 
      return newShare;
    } catch (err) {
      console.error("Error in shareCategoryWithGroup:", err);
      throw err;
    }
  }, [currentUserId, fetchPasswords]);

  const unshareCategoryFromGroup = useCallback(async (categoryName: string, groupId: string): Promise<void> => {
    if (!currentUserId) throw new Error('User not authenticated for unsharing category');
    try {
      const response = await fetch(`${CATEGORIES_API_BASE_URL}/unshare`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'X-User-ID': currentUserId },
        body: JSON.stringify({ categoryName, groupId }),
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to unshare category');
        throw new Error(errorMessage);
      }
      await fetchPasswords(); 
    } catch (err) {
      console.error("Error in unshareCategoryFromGroup:", err);
      throw err;
    }
  }, [currentUserId, fetchPasswords]);

  const fetchCategorySharesForOwner = useCallback(async (categoryName: string, ownerId: string): Promise<CategoryShare[]> => {
    if (!currentUserId) throw new Error('User not authenticated for fetching category shares');
    try {
      const response = await fetch(`${CATEGORIES_API_BASE_URL}/shares?ownerId=${encodeURIComponent(ownerId)}&categoryName=${encodeURIComponent(categoryName)}`, {
        headers: { 'X-User-ID': currentUserId },
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response, 'Failed to fetch category shares');
        throw new Error(errorMessage);
      }
      const shares: CategoryShare[] = await response.json();
      return shares;
    } catch (err) {
      console.error("Error in fetchCategorySharesForOwner:", err);
      throw err;
    }
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
    fetchGroups,
    createGroup,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    updateGroupMemberRole,
    deleteGroup,
    shareCategoryWithGroup,
    unshareCategoryFromGroup,
    fetchCategorySharesForOwner,
  };
}
