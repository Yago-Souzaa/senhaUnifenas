
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
    if (passwordDoc.category && passwordDoc.ownerId) {
      const userGroupIds = (await groupsCollection.find({ 'members.userId': currentUserId })
        .project({ _id: 1 }).toArray())
        .map(g => g._id.toHexString());

      if (userGroupIds.length > 0) {
        const relevantShare = await categorySharesCollection.findOne({
          ownerId: passwordDoc.ownerId,
          categoryName: passwordDoc.category,
          groupId: { $in: userGroupIds }
        });

        if (relevantShare) {
          const groupDoc = await groupsCollection.findOne({_id: new ObjectId(relevantShare.groupId)});
          passwordDoc.sharedVia = { // Augment for client
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
    // sharedVia is client-side only, remove it
    const {sharedVia, ...updatedEntryDataInput } = (await request.json()) as Omit<PasswordEntry, 'id' | 'ownerId' | 'userId' | 'sharedWith' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy' | 'createdAt'>;
    
    const { passwordsCollection, groupsCollection, categorySharesCollection } = await connectToDatabase();
    const passwordDocDb = await passwordsCollection.findOne({ _id: new ObjectId(id), isDeleted: { $ne: true } });

    if (!passwordDocDb) {
      return NextResponse.json({ message: 'Password not found or has been deleted' }, { status: 404 });
    }
    const passwordDoc = fromMongo(passwordDocDb as any) as PasswordEntry;

    let canModify = false;
    if (passwordDoc.ownerId === currentUserId) {
      canModify = true;
    } else if (passwordDoc.category && passwordDoc.ownerId) {
      // Check if user is admin of a group this password's category is shared with
      const userAdminGroupIds = (await groupsCollection.find({ members: { $elemMatch: { userId: currentUserId, role: 'admin' } } })
        .project({ _id: 1 }).toArray())
        .map(g => g._id.toHexString());

      if (userAdminGroupIds.length > 0) {
        const relevantShareAsAdmin = await categorySharesCollection.findOne({
          ownerId: passwordDoc.ownerId,
          categoryName: passwordDoc.category,
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

    const { id: entryIdToRemove, ownerId, userId, sharedWith, history, isDeleted, createdBy, createdAt, lastModifiedBy, ...setOperationData } = updatedEntryDataInput as any;
    
    const newHistoryEntry: HistoryEntry = {
      action: 'updated',
      userId: currentUserId,
      timestamp: new Date(),
      details: { updatedFields: Object.keys(setOperationData) }
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const updatePayload = { 
      ...setOperationData, 
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
    } else if (passwordDoc.category && passwordDoc.ownerId) {
       const userAdminGroupIds = (await groupsCollection.find({ members: { $elemMatch: { userId: currentUserId, role: 'admin' } } })
        .project({ _id: 1 }).toArray())
        .map(g => g._id.toHexString());
      
      if (userAdminGroupIds.length > 0) {
        const relevantShareAsAdmin = await categorySharesCollection.findOne({
          ownerId: passwordDoc.ownerId,
          categoryName: passwordDoc.category,
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
