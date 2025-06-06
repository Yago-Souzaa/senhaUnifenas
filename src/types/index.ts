
import type { User as FirebaseUserType } from 'firebase/auth';

export interface SharedUser {
  userId: string; // UID of the user it's shared with
  permission: 'read' | 'full'; // 'read' for view-only, 'full' for edit/delete
  sharedAt?: Date;
  sharedBy?: string; // UID of the user who initiated this specific share instance
  userEmail?: string; // Optional: For easier display in UI, not primary data.
}

export interface HistoryEntry {
  action: 'created' | 'updated' | 'deleted' | 'shared' | 'share_updated' | 'share_removed' | 'restored' | 'cleared';
  userId: string; // UID of the user who performed the action
  timestamp: Date;
  details?: any; // e.g., for 'updated', { previousData: Partial<PasswordEntry>, currentData: Partial<PasswordEntry> }
                 // for 'shared', { sharedWithUserId: string, permission: string }
                 // for 'share_updated', { sharedUserId: string, oldPermission: string, newPermission: string }
                 // for 'share_removed', { removedUserId: string }
}

export interface PasswordEntry {
  id: string; // MongoDB's _id as a string
  ownerId: string; // Firebase UID of the original owner
  userId?: string; // Firebase UID - Deprecating in favor of ownerId and sharedWith for clarity
                   // Kept for now for backend compatibility during transition, should be eventually removed
                   // or strictly used for ownerId linkage by backend.
                   // For new entries, ownerId will be the primary identifier for ownership.
                   // In queries, we check ownerId OR if current user is in sharedWith.

  nome: string;
  login: string;
  senha?: string;
  categoria?: string;
  customFields?: Array<{ label: string; value: string }>;

  createdAt?: Date;
  createdBy?: { userId: string; timestamp: Date };
  lastModifiedBy?: { userId: string; timestamp: Date };

  sharedWith?: SharedUser[];
  history?: HistoryEntry[];
  
  isDeleted?: boolean; // For soft delete
  deletedAt?: Date;
  deletedBy?: string; // UID of user who soft-deleted
}

export type FirebaseUser = FirebaseUserType;
