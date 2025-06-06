
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { PasswordEntry, HistoryEntry, Group } from '@/types';
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
    const { passwordsCollection, groupsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(id), isDeleted: { $ne: true } });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found or has been deleted' }, { status: 404 });
    }

    // Check ownership or direct share
    const effectiveOwnerId = passwordDoc.ownerId || passwordDoc.userId;
    if (effectiveOwnerId === currentUserId || passwordDoc.sharedWith?.some(s => s.userId === currentUserId)) {
      return NextResponse.json(fromMongo(passwordDoc as any), { status: 200 });
    }

    // Check group share
    if (passwordDoc.sharedWithGroupIds && passwordDoc.sharedWithGroupIds.length > 0) {
      const userGroupDocs = await groupsCollection.find({ 
        _id: { $in: passwordDoc.sharedWithGroupIds.map(gid => new ObjectId(gid)) },
        'members.userId': currentUserId 
      }).project({ _id: 1 }).toArray();
      
      if (userGroupDocs.length > 0) {
        return NextResponse.json(fromMongo(passwordDoc as any), { status: 200 });
      }
    }

    return NextResponse.json({ message: 'Password not found or access denied' }, { status: 404 });
  } catch (error) {
    console.error('Failed to fetch password:', error);
    return NextResponse.json({ message: 'Failed to fetch password' }, { status: 500 });
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
    const updatedEntryData = (await request.json()) as Omit<PasswordEntry, 'id' | 'userId' | 'ownerId' | 'sharedWith' | 'sharedWithGroupIds' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy'>;
    
    const { passwordsCollection, groupsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(id), isDeleted: { $ne: true } });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found or has been deleted' }, { status: 404 });
    }

    // Permission check
    let canEdit = false;
    const effectiveOwnerId = passwordDoc.ownerId || passwordDoc.userId;
    if (effectiveOwnerId === currentUserId) {
      canEdit = true;
    } else if (passwordDoc.sharedWith?.some(s => s.userId === currentUserId && s.permission === 'full')) {
      canEdit = true;
    } else if (passwordDoc.sharedWithGroupIds && passwordDoc.sharedWithGroupIds.length > 0) {
      const adminInGroups = await groupsCollection.countDocuments({
        _id: { $in: passwordDoc.sharedWithGroupIds.map(gid => new ObjectId(gid)) },
        members: { $elemMatch: { userId: currentUserId, role: 'admin' } }
      });
      if (adminInGroups > 0) {
        canEdit = true;
      }
    }

    if (!canEdit) {
      return NextResponse.json({ message: 'Permission denied to update this password' }, { status: 403 });
    }

    const { id: entryIdToRemove, ownerId, userId, sharedWith, sharedWithGroupIds, history, isDeleted, createdBy, createdAt, lastModifiedBy, ...setOperationData } = updatedEntryData as any;
    
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
      { _id: new ObjectId(id) }, // Query already confirmed doc exists and user has permission
      { $set: updatePayload }
    );

    if (result.matchedCount === 0) { // Should not happen if initial checks passed
      return NextResponse.json({ message: 'Password not found during update (unexpected)' }, { status: 404 });
    }
    
    const updatedDoc = await passwordsCollection.findOne({_id: new ObjectId(id)});
    return NextResponse.json(fromMongo(updatedDoc as any), { status: 200 });
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
    const { passwordsCollection, groupsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(id), isDeleted: { $ne: true } });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found or already deleted' }, { status: 404 });
    }

    // Permission check (similar to PUT)
    let canDelete = false;
    const effectiveOwnerId = passwordDoc.ownerId || passwordDoc.userId;
    if (effectiveOwnerId === currentUserId) {
      canDelete = true;
    } else if (passwordDoc.sharedWith?.some(s => s.userId === currentUserId && s.permission === 'full')) {
      canDelete = true;
    } else if (passwordDoc.sharedWithGroupIds && passwordDoc.sharedWithGroupIds.length > 0) {
      const adminInGroups = await groupsCollection.countDocuments({
        _id: { $in: passwordDoc.sharedWithGroupIds.map(gid => new ObjectId(gid)) },
        members: { $elemMatch: { userId: currentUserId, role: 'admin' } }
      });
      if (adminInGroups > 0) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return NextResponse.json({ message: 'Permission denied to delete this password' }, { status: 403 });
    }
    
    const newHistoryEntry: HistoryEntry = {
      action: 'deleted',
      userId: currentUserId,
      timestamp: new Date()
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    // Soft delete
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

    if (result.matchedCount === 0) { // Should not happen
      return NextResponse.json({ message: 'Password not found during delete operation (unexpected)' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Password marked as deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete password:', error);
    return NextResponse.json({ message: 'Failed to delete password', error: (error as Error).message }, { status: 500 });
  }
}
