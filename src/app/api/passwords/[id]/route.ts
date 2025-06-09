
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { PasswordEntry, HistoryEntry, Group, CategoryShare } from '@/types';
import { ObjectId } from 'mongodb';

interface Params {
  id: string;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    const { passwordsCollection, groupsCollection, categorySharesCollection } = await connectToDatabase();
    const passwordDocDb = await passwordsCollection.findOne({ _id: new ObjectId(id), isDeleted: { $ne: true } });

    if (!passwordDocDb) {
      return NextResponse.json({ message: 'Password not found or has been deleted' }, { status: 404 });
    }
    const passwordDoc = fromMongo(passwordDocDb as any) as PasswordEntry;


    // Check direct ownership
    if (passwordDoc.ownerId === currentUserId) {
      return NextResponse.json(passwordDoc, { status: 200 });
    }

    // Check access via shared category
    if (passwordDoc.categoria && passwordDoc.ownerId) { 
      const userGroupIds = (await groupsCollection.find({ 'members.userId': currentUserId })
        .project({ _id: 1 }).toArray())
        .map(g => g._id.toHexString());

      if (userGroupIds.length > 0) {
        const relevantShare = await categorySharesCollection.findOne({
          ownerId: passwordDoc.ownerId,
          categoryName: passwordDoc.categoria.trim(),
          groupId: { $in: userGroupIds }
        });

        if (relevantShare) {
          const groupDoc = await groupsCollection.findOne({_id: new ObjectId(relevantShare.groupId)});
          passwordDoc.sharedVia = { 
            categoryOwnerId: relevantShare.ownerId,
            categoryName: relevantShare.categoryName,
            groupId: relevantShare.groupId,
            groupName: groupDoc?.name || "Unknown Group"
          };
          return NextResponse.json(passwordDoc, { status: 200 });
        }
      }
    }

    return NextResponse.json({ message: 'Password not found or access denied' }, { status: 404 });
  } catch (error) {
    console.error('Failed to fetch password:', error);
    return NextResponse.json({ message: 'Failed to fetch password', error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    
    const {sharedVia, ...updatedEntryDataInputNoVia } = (await request.json()) as Omit<PasswordEntry, 'id' | 'ownerId' | 'userId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt'>;
    
    let updatedEntryData = { ...updatedEntryDataInputNoVia };

    if (typeof updatedEntryData.categoria === 'string') {
        const trimmedCategory = updatedEntryData.categoria.trim();
        if (!trimmedCategory) {
             return NextResponse.json({ message: 'Category name cannot be empty after trimming.' }, { status: 400 });
        }
        updatedEntryData.categoria = trimmedCategory;
    } else if (updatedEntryData.categoria !== undefined) { // only error if it's explicitly set to something non-string
        return NextResponse.json({ message: 'Category name must be a string.' }, { status: 400 });
    }
    
    const { passwordsCollection, groupsCollection, categorySharesCollection } = await connectToDatabase();
    const passwordDocDb = await passwordsCollection.findOne({ _id: new ObjectId(id), isDeleted: { $ne: true } });

    if (!passwordDocDb) {
      return NextResponse.json({ message: 'Password not found or has been deleted' }, { status: 404 });
    }
    const passwordDoc = fromMongo(passwordDocDb as any) as PasswordEntry;

    let canModify = false;
    if (passwordDoc.ownerId === currentUserId) {
      canModify = true;
    } else if (passwordDoc.categoria && passwordDoc.ownerId) { 
      const userAdminGroupIds = (await groupsCollection.find({ members: { $elemMatch: { userId: currentUserId, role: 'admin' } } })
        .project({ _id: 1 }).toArray())
        .map(g => g._id.toHexString());

      if (userAdminGroupIds.length > 0) {
        const relevantShareAsAdmin = await categorySharesCollection.findOne({
          ownerId: passwordDoc.ownerId,
          categoryName: passwordDoc.categoria.trim(),
          groupId: { $in: userAdminGroupIds }
        });
        if (relevantShareAsAdmin) {
          canModify = true;
        }
      }
    }

    if (!canModify) {
      return NextResponse.json({ message: 'Permission denied to update this password' }, { status: 403 });
    }

    // Fields that should not be directly set via $set from client input
    const { 
      id: _idToRemove, 
      ownerId, 
      userId, 
      sharedWith, 
      history, 
      isDeleted, 
      createdBy, 
      createdAt, 
      lastModifiedBy, 
      ...setOperationData 
    } = updatedEntryData as any;
    
    const updatedFields = { ...setOperationData };
    if (typeof updatedEntryData.categoria === 'string') {
        updatedFields.categoria = updatedEntryData.categoria; // Already trimmed
    }
    if (typeof updatedEntryData.isFavorite === 'boolean') {
        updatedFields.isFavorite = updatedEntryData.isFavorite;
    }


    const newHistoryEntry: HistoryEntry = {
      action: 'updated',
      userId: currentUserId,
      timestamp: new Date(),
      details: { updatedFields: Object.keys(updatedFields) }
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const updatePayload: any = { 
      ...updatedFields, 
      lastModifiedBy: { userId: currentUserId, timestamp: new Date() },
      history: updatedHistory
    };
    
    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatePayload }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Password not found during update (unexpected)' }, { status: 404 });
    }
    
    const updatedDocDb = await passwordsCollection.findOne({_id: new ObjectId(id)});
    return NextResponse.json(fromMongo(updatedDocDb as any), { status: 200 });
  } catch (error) {
    console.error('Failed to update password:', error);
    return NextResponse.json({ message: 'Failed to update password', error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    const { passwordsCollection, groupsCollection, categorySharesCollection } = await connectToDatabase();
    const passwordDocDb = await passwordsCollection.findOne({ _id: new ObjectId(id), isDeleted: { $ne: true } });

    if (!passwordDocDb) {
      return NextResponse.json({ message: 'Password not found or already deleted' }, { status: 404 });
    }
    const passwordDoc = fromMongo(passwordDocDb as any) as PasswordEntry;


    let canModify = false;
    if (passwordDoc.ownerId === currentUserId) {
      canModify = true;
    } else if (passwordDoc.categoria && passwordDoc.ownerId) { 
       const userAdminGroupIds = (await groupsCollection.find({ members: { $elemMatch: { userId: currentUserId, role: 'admin' } } })
        .project({ _id: 1 }).toArray())
        .map(g => g._id.toHexString());
      
      if (userAdminGroupIds.length > 0) {
        const relevantShareAsAdmin = await categorySharesCollection.findOne({
          ownerId: passwordDoc.ownerId,
          categoryName: passwordDoc.categoria.trim(),
          groupId: { $in: userAdminGroupIds }
        });
        if (relevantShareAsAdmin) {
          canModify = true;
        }
      }
    }

    if (!canModify) {
      return NextResponse.json({ message: 'Permission denied to delete this password' }, { status: 403 });
    }
    
    const newHistoryEntry: HistoryEntry = {
      action: 'deleted',
      userId: currentUserId,
      timestamp: new Date()
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: currentUserId,
          lastModifiedBy: { userId: currentUserId, timestamp: new Date() },
          history: updatedHistory
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Password not found during delete operation (unexpected)' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Password marked as deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete password:', error);
    return NextResponse.json({ message: 'Failed to delete password', error: (error as Error).message }, { status: 500 });
  }
}

