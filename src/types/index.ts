
import type { User as FirebaseUserType } from 'firebase/auth';

export interface SharedUser {
  userId: string; // UID of the user it's shared with
  permission: 'read' | 'full'; // 'read' for view-only, 'full' for edit/delete
  sharedAt?: Date;
  sharedBy?: string; // UID of the user who initiated this specific share instance
  userEmail?: string; // Optional: For easier display in UI, not primary data.
}

export interface GroupMember {
  userId: string; // Firebase UID of the member
  role: 'member' | 'admin'; // Role within the group (admin might manage members, owner manages group)
  addedAt?: Date;
  addedBy?: string; // UID of user who added this member
}

export interface Group {
  id: string; // MongoDB's _id as a string
  name: string;
  ownerId: string; // Firebase UID of the group owner
  members: GroupMember[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface HistoryEntry {
  action: 
    | 'created' 
    | 'updated' 
    | 'deleted' 
    | 'shared' 
    | 'share_updated' 
    | 'share_removed' 
    | 'restored' 
    | 'cleared'
    | 'group_created'
    | 'group_deleted'
    | 'group_member_added'
    | 'group_member_removed'
    | 'password_shared_with_group'
    | 'password_unshared_from_group';
  userId: string; // UID of the user who performed the action
  timestamp: Date;
  details?: any; 
}

export interface PasswordEntry {
  id: string; 
  ownerId: string; 
  userId?: string; 

  nome: string;
  login: string;
  senha?: string;
  categoria?: string;
  customFields?: Array<{ label: string; value: string }>;

  createdAt?: Date;
  createdBy?: { userId: string; timestamp: Date };
  lastModifiedBy?: { userId: string; timestamp: Date };

  sharedWith?: SharedUser[];
  sharedWithGroupIds?: string[]; // Array of Group IDs this password is shared with

  history?: HistoryEntry[];
  
  isDeleted?: boolean; 
  deletedAt?: Date;
  deletedBy?: string; 
}

export type FirebaseUser = FirebaseUserType;
