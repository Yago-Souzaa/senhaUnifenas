
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
    
    const allAccessiblePasswordsMap = new Map<string, PasswordEntry>();

    // 1. Fetch passwords directly owned by the current user
    const ownedPasswordsRaw = await passwordsCollection.find({ ownerId: currentUserId, isDeleted: { $ne: true } }).toArray();
    ownedPasswordsRaw.forEach(doc => {
      const password = fromMongo(doc as any) as PasswordEntry;
      allAccessiblePasswordsMap.set(password.id, password);
    });

    // 2. Fetch passwords from shared categories
    const userGroupDocs = await groupsCollection.find({ 'members.userId': currentUserId }).project({ _id: 1, name: 1 }).toArray();
    const userGroupIds = userGroupDocs.map(doc => doc._id.toHexString());

    if (userGroupIds.length > 0) {
      const categorySharesToUserGroups = await categorySharesCollection.find({ groupId: { $in: userGroupIds } }).toArray();
      
      for (const share of categorySharesToUserGroups) {
        const categoryNameFromShare = share.categoryName; 
        const categoryRegex = categoryNameFromShare ? new RegExp(`^${categoryNameFromShare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') : null;

        const findCriteria: any = {
          ownerId: share.ownerId, 
          isDeleted: { $ne: true }
        };

        if (categoryRegex) {
          findCriteria.category = categoryRegex;
        } else {
          findCriteria.category = { $in: [null, ""] };
        }
        
        const passwordsFromSharedCategoryRaw = await passwordsCollection.find(findCriteria).toArray();
        const groupDocForShare = userGroupDocs.find(g => g._id.toHexString() === share.groupId);

        passwordsFromSharedCategoryRaw.forEach(doc => {
          const sharedPasswordCandidate = fromMongo(doc as any) as PasswordEntry;
          
          const sharedViaInfo = {
            categoryOwnerId: share.ownerId,
            categoryName: categoryNameFromShare, 
            groupId: share.groupId,
            groupName: groupDocForShare?.name || 'Unknown Group'
          };

          if (allAccessiblePasswordsMap.has(sharedPasswordCandidate.id)) {
            const existingPassword = allAccessiblePasswordsMap.get(sharedPasswordCandidate.id)!;
            // Se a senha já existe (ex: é do próprio usuário),
            // só preenche 'sharedVia' se ainda não tiver, para indicar que também é acessível por este grupo.
            if (!existingPassword.sharedVia) { 
              existingPassword.sharedVia = sharedViaInfo;
              allAccessiblePasswordsMap.set(existingPassword.id, existingPassword);
            }
          } else {
            // Senha de outro usuário, compartilhada com o currentUserId via este grupo/categoria.
            sharedPasswordCandidate.sharedVia = sharedViaInfo;
            allAccessiblePasswordsMap.set(sharedPasswordCandidate.id, sharedPasswordCandidate);
          }
        });
      }
    }
    
    const allAccessiblePasswordsList = Array.from(allAccessiblePasswordsMap.values());
    return NextResponse.json(allAccessiblePasswordsList, { status: 200 });

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
