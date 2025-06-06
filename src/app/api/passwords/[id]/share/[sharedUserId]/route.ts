
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { PasswordEntry, SharedUser, HistoryEntry } from '@/types';
import { ObjectId } from 'mongodb';

interface ShareManagementParams {
  id: string; // Password ID
  sharedUserId: string; // User ID of the person the password is shared with
}

// PUT /api/passwords/[id]/share/[sharedUserId]
export async function PUT(request: NextRequest, { params }: { params: ShareManagementParams }) {
  const currentActionUserId = request.headers.get('X-User-ID'); // User performing the action
  if (!currentActionUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id: passwordId, sharedUserId: targetSharedUserId } = params;
    if (!ObjectId.isValid(passwordId)) {
      return NextResponse.json({ message: 'Invalid Password ID format' }, { status: 400 });
    }

    const { permission } = (await request.json()) as { permission: 'read' | 'full' };

    if (!permission || !['read', 'full'].includes(permission)) {
      return NextResponse.json({ message: 'Valid permission (read/full) is required' }, { status: 400 });
    }

    const { passwordsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }

    const effectiveOwnerId = passwordDoc.ownerId || passwordDoc.userId;
    if (effectiveOwnerId !== currentActionUserId) {
      return NextResponse.json({ message: 'Only the password owner can modify shares' }, { status: 403 });
    }

    if (passwordDoc.isDeleted) {
        return NextResponse.json({ message: 'Cannot modify shares for a deleted password' }, { status: 400 });
    }

    const shareIndex = passwordDoc.sharedWith?.findIndex(s => s.userId === targetSharedUserId);
    
    if (!passwordDoc.sharedWith || shareIndex === undefined || shareIndex === -1) {
      return NextResponse.json({ message: 'Share not found for this user' }, { status: 404 });
    }

    const oldPermission = passwordDoc.sharedWith[shareIndex].permission;
    if (oldPermission === permission) {
        // Fetch the current document to ensure the returned sharedWith is up-to-date, even if no change.
        const currentDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });
        return NextResponse.json({ message: 'Permission is already set to this value', sharedWith: currentDoc?.sharedWith || [] }, { status: 200 });
    }

    // Create a new array for sharedWith to ensure MongoDB detects the change properly
    const updatedSharedWithArray = passwordDoc.sharedWith.map((share, index) => {
        if (index === shareIndex) {
            return { ...share, permission: permission };
        }
        return share;
    });
    
    const newHistoryEntry: HistoryEntry = {
      action: 'share_updated',
      userId: currentActionUserId,
      timestamp: new Date(),
      details: { sharedUserId: targetSharedUserId, oldPermission, newPermission: permission }
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(passwordId) }, // Query by _id only, ownership already validated
      { 
        $set: { 
            sharedWith: updatedSharedWithArray, 
            lastModifiedBy: { userId: currentActionUserId, timestamp: new Date() },
            history: updatedHistory,
        }
      }
    );
    
    if (result.matchedCount === 0) { // Should not happen if doc was found earlier
        return NextResponse.json({ message: 'Password not found for update (unexpected)' }, { status: 404 });
    }
    if (result.modifiedCount === 0 && oldPermission !== permission) {
        // This might happen if the document was somehow changed between findOne and updateOne,
        // or if MongoDB didn't see the array update as a modification (less likely with new array).
        console.warn(`Share PUT: Password ${passwordId} matched but not modified for user ${targetSharedUserId}, despite different permissions. Old: ${oldPermission}, New: ${permission}`);
    }
    
    const updatedDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    return NextResponse.json({ message: 'Share permission updated successfully', sharedWith: updatedDoc?.sharedWith || [] }, { status: 200 });

  } catch (error) {
    console.error('Failed to update share permission:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update share permission';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

// DELETE /api/passwords/[id]/share/[sharedUserId]
export async function DELETE(request: NextRequest, { params }: { params: ShareManagementParams }) {
  const currentActionUserId = request.headers.get('X-User-ID'); // User performing the action
  if (!currentActionUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id: passwordId, sharedUserId: targetSharedUserId } = params;
    if (!ObjectId.isValid(passwordId)) {
      return NextResponse.json({ message: 'Invalid Password ID format' }, { status: 400 });
    }

    const { passwordsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }

    const effectiveOwnerId = passwordDoc.ownerId || passwordDoc.userId;
    if (effectiveOwnerId !== currentActionUserId) {
      return NextResponse.json({ message: 'Only the password owner can remove shares' }, { status: 403 });
    }
    
    if (passwordDoc.isDeleted) {
        return NextResponse.json({ message: 'Cannot modify shares for a deleted password' }, { status: 400 });
    }

    const shareExists = passwordDoc.sharedWith?.some(s => s.userId === targetSharedUserId);
    if (!shareExists) {
      // Fetch current doc to return consistent sharedWith array
      const currentDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });
      return NextResponse.json({ message: 'Share not found for this user to remove', sharedWith: currentDoc?.sharedWith || [] }, { status: 404 });
    }
    
    const newHistoryEntry: HistoryEntry = {
      action: 'share_removed',
      userId: currentActionUserId,
      timestamp: new Date(),
      details: { removedUserId: targetSharedUserId }
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(passwordId) }, // Query by _id, ownership validated
      { 
        $pull: { sharedWith: { userId: targetSharedUserId } },
        $set: { 
            lastModifiedBy: { userId: currentActionUserId, timestamp: new Date() },
            history: updatedHistory,
        }
      }
    );

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
      // This means the $pull didn't remove anything, which could happen if the share was already removed
      // or if targetSharedUserId wasn't in the array for some reason.
      console.warn(`Share DELETE: Password ${passwordId} matched but not modified for pulling user ${targetSharedUserId}. Share might have been already removed.`);
    }
     if (result.matchedCount === 0) { // Should not happen
        return NextResponse.json({ message: 'Password not found for share removal (unexpected)' }, { status: 404 });
    }
    
    const updatedDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    return NextResponse.json({ message: 'Share removed successfully', sharedWith: updatedDoc?.sharedWith || [] }, { status: 200 });

  } catch (error) {
    console.error('Failed to remove share:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove share';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
