
import type { User as FirebaseUserType } from 'firebase/auth';

// SharedUser is now effectively deprecated for new shares but kept for legacy data.
// New shares will only be via groups.
export interface SharedUser {
  userId: string; 
  permission: 'read' | 'full'; 
  sharedAt?: Date;
  sharedBy?: string; 
  userEmail?: string; 
}

export interface GroupMember {
  userId: string; 
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
    | 'password_shared_with_group'
    | 'password_unshared_from_group';
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

  sharedWith?: SharedUser[]; // Deprecated for new shares, use sharedWithGroupIds
  sharedWithGroupIds?: string[]; 

  history?: HistoryEntry[];
  
  isDeleted?: boolean; 
  deletedAt?: Date;
  deletedBy?: string; 
}

export type FirebaseUser = FirebaseUserType;
