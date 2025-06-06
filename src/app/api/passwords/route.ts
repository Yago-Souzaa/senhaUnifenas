
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { PasswordEntry, Group, CategoryShare } from '@/types';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { passwordsCollection, groupsCollection, categorySharesCollection } = await connectToDatabase();
    
    const allAccessiblePasswords: PasswordEntry[] = [];
    const processedPasswordIds = new Set<string>();

    // 1. Fetch passwords directly owned by the user
    const ownedPasswordsRaw = await passwordsCollection.find({ ownerId: currentUserId, isDeleted: { $ne: true } }).toArray();
    ownedPasswordsRaw.forEach(doc => {
      const password = fromMongo(doc as any) as PasswordEntry;
      if (!processedPasswordIds.has(password.id)) {
        allAccessiblePasswords.push(password);
        processedPasswordIds.add(password.id);
      }
    });

    // 2. Fetch passwords from shared categories
    const userGroupDocs = await groupsCollection.find({ 'members.userId': currentUserId }).project({ _id: 1, name: 1 }).toArray();
    const userGroupIds = userGroupDocs.map(doc => doc._id.toHexString());

    if (userGroupIds.length > 0) {
      const categorySharesToUserGroups = await categorySharesCollection.find({ groupId: { $in: userGroupIds } }).toArray();
      
      for (const share of categorySharesToUserGroups) {
        if (share.ownerId === currentUserId && ownedPasswordsRaw.some(p => p.category === share.categoryName)) {
          // These are user's own passwords, already fetched.
          // We might want to augment them with sharedVia info if not already done.
           allAccessiblePasswords.forEach(existingPwd => {
             if (existingPwd.ownerId === share.ownerId && existingPwd.category === share.categoryName && !existingPwd.sharedVia) {
                const groupDoc = userGroupDocs.find(g => g._id.toHexString() === share.groupId);
                existingPwd.sharedVia = {
                    categoryOwnerId: share.ownerId,
                    categoryName: share.categoryName,
                    groupId: share.groupId,
                    groupName: groupDoc?.name || 'Unknown Group'
                };
             }
           });
          continue;
        }
        
        const passwordsFromSharedCategoryRaw = await passwordsCollection.find({
          ownerId: share.ownerId,
          category: share.categoryName,
          isDeleted: { $ne: true }
        }).toArray();

        passwordsFromSharedCategoryRaw.forEach(doc => {
          const password = fromMongo(doc as any) as PasswordEntry;
          if (!processedPasswordIds.has(password.id)) {
            const groupDoc = userGroupDocs.find(g => g._id.toHexString() === share.groupId);
            password.sharedVia = {
              categoryOwnerId: share.ownerId,
              categoryName: share.categoryName,
              groupId: share.groupId,
              groupName: groupDoc?.name || 'Unknown Group'
            };
            allAccessiblePasswords.push(password);
            processedPasswordIds.add(password.id);
          } else {
            // Password already added (likely owned), augment with sharedVia if this is a new share context
            const existingPwd = allAccessiblePasswords.find(p => p.id === password.id);
            if (existingPwd && !existingPwd.sharedVia) { // Only add sharedVia if not already set (first share context wins for now)
                const groupDoc = userGroupDocs.find(g => g._id.toHexString() === share.groupId);
                existingPwd.sharedVia = {
                    categoryOwnerId: share.ownerId,
                    categoryName: share.categoryName,
                    groupId: share.groupId,
                    groupName: groupDoc?.name || 'Unknown Group'
                };
            }
          }
        });
      }
    }
    
    return NextResponse.json(allAccessiblePasswords, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch passwords:', error);
    return NextResponse.json({ message: 'Failed to fetch passwords', error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    // sharedVia is a client-side field, remove it before saving
    const { sharedVia, ...entryData } = (await request.json()) as Omit<PasswordEntry, 'id' | 'ownerId' | 'userId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt'>;
    
    const entryDataWithOwner: Omit<PasswordEntry, 'id' | 'sharedVia'> = {
      ...entryData,
      ownerId: userId,
      userId: userId, 
      createdAt: new Date(),
      createdBy: { userId: userId, timestamp: new Date() },
      sharedWith: [], // Legacy, clear it.
      history: [{ action: 'created', userId: userId, timestamp: new Date() }],
      isDeleted: false,
    };
    
    const { passwordsCollection } = await connectToDatabase();
    const result = await passwordsCollection.insertOne(entryDataWithOwner as any);
    
    if (!result.insertedId) {
        throw new Error('Failed to insert password, no ID returned');
    }

    const newPassword = {
      ...entryDataWithOwner,
      id: result.insertedId.toHexString(),
    } as PasswordEntry;

    return NextResponse.json(fromMongo(newPassword as any), { status: 201 });
  } catch (error) {
    console.error('Failed to add password:', error);
    return NextResponse.json({ message: 'Failed to add password', error: (error as Error).message }, { status: 500 });
  }
}
