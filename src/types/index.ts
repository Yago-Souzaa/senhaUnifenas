
import type { User as FirebaseUserType } from 'firebase/auth';

// SharedUser is now effectively deprecated for new shares but kept for legacy data.
export interface SharedUser {
  userId: string;
  permission: 'read' | 'full';
  sharedAt?: Date;
  sharedBy?: string;
  userEmail?: string;
}

export interface GroupMember {
  userId: string;
  displayName?: string; // Added displayName
  role: 'member' | 'admin';
  addedAt?: Date;
  addedBy?: string;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  members: GroupMember[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CategoryShare {
  id: string;
  ownerId: string; // UID of the user who owns the category being shared
  categoryName: string;
  groupId: string;
  sharedAt: Date;
  sharedBy: string; // UID of the user who performed the share action
}

export interface HistoryEntry {
  action:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'shared' // Legacy individual share
    | 'share_updated' // Legacy individual share
    | 'share_removed' // Legacy individual share
    | 'restored'
    | 'cleared'
    | 'group_created'
    | 'group_deleted'
    | 'group_member_added'
    | 'group_member_removed'
    | 'group_member_role_updated'
    // | 'password_shared_with_group' // Replaced by category sharing
    // | 'password_unshared_from_group' // Replaced by category sharing
    | 'category_shared_with_group'
    | 'category_unshared_from_group';
  userId: string;
  timestamp: Date;
  details?: any;
}

export interface PasswordEntry {
  id: string;
  ownerId: string;
  userId?: string; // Legacy field, ownerId is preferred

  nome: string;
  login: string;
  senha?: string;
  categoria?: string;
  customFields?: Array<{ label: string; value: string }>;

  createdAt?: Date;
  createdBy?: { userId: string; timestamp: Date };
  lastModifiedBy?: { userId: string; timestamp: Date };

  sharedWith?: SharedUser[]; // Deprecated for new shares

  // sharedWithGroupIds?: string[]; // REMOVED - Replaced by CategoryShare logic

  // For client-side rendering, to know how this password was accessed if via a shared category
  sharedVia?: {
    categoryOwnerId: string;
    categoryName: string;
    groupId: string;
    groupName?: string; // For display convenience
  };

  history?: HistoryEntry[];

  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

// Extend FirebaseUserType to explicitly include photoURL if not already obvious
// Although FirebaseUserType from 'firebase/auth' already includes photoURL,
// this makes it more explicit in our local type definition.
export interface FirebaseUser extends FirebaseUserType {
  photoURL?: string | null;
}
