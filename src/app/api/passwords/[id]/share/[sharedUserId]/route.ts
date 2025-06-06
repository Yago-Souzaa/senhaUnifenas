
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
  const ownerUserId = request.headers.get('X-User-ID');
  if (!ownerUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id: passwordId, sharedUserId } = params;
    if (!ObjectId.isValid(passwordId)) {
      return NextResponse.json({ message: 'Invalid Password ID format' }, { status: 400 });
    }
    // Assuming sharedUserId is a valid string format (e.g., Firebase UID)

    const { permission } = (await request.json()) as { permission: 'read' | 'full' };

    if (!permission || !['read', 'full'].includes(permission)) {
      return NextResponse.json({ message: 'Valid permission (read/full) is required' }, { status: 400 });
    }

    const { passwordsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }

    if (passwordDoc.ownerId !== ownerUserId) {
      return NextResponse.json({ message: 'Only the password owner can modify shares' }, { status: 403 });
    }

    if (passwordDoc.isDeleted) {
        return NextResponse.json({ message: 'Cannot modify shares for a deleted password' }, { status: 400 });
    }

    const shareIndex = passwordDoc.sharedWith?.findIndex(s => s.userId === sharedUserId);
    if (shareIndex === -1 || !passwordDoc.sharedWith) {
      return NextResponse.json({ message: 'Share not found for this user' }, { status: 404 });
    }

    const oldPermission = passwordDoc.sharedWith[shareIndex].permission;
    if (oldPermission === permission) {
        return NextResponse.json({ message: 'Permission is already set to this value', sharedWith: passwordDoc.sharedWith }, { status: 200 });
    }

    const updatedSharedWith = [...passwordDoc.sharedWith];
    updatedSharedWith[shareIndex] = { ...updatedSharedWith[shareIndex], permission };

    const newHistoryEntry: HistoryEntry = {
      action: 'share_updated',
      userId: ownerUserId,
      timestamp: new Date(),
      details: { sharedUserId, oldPermission, newPermission: permission }
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(passwordId), ownerId: ownerUserId, "sharedWith.userId": sharedUserId },
      { 
        $set: { 
            "sharedWith.$": updatedSharedWith[shareIndex], // Update specific element in array
            lastModifiedBy: { userId: ownerUserId, timestamp: new Date() },
            history: updatedHistory,
        }
      }
    );

    if (result.matchedCount === 0) {
        // This could happen if sharedUserId was not found by the query selector, even if owner matches
        return NextResponse.json({ message: 'Password or specific share not found for update' }, { status: 404 });
    }
    
    // Fetch the document again to return the latest sharedWith array, as $set on an array element doesn't return the full updated array directly
    const updatedDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    return NextResponse.json({ message: 'Share permission updated successfully', sharedWith: updatedDoc?.sharedWith }, { status: 200 });

  } catch (error) {
    console.error('Failed to update share permission:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update share permission';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

// DELETE /api/passwords/[id]/share/[sharedUserId]
export async function DELETE(request: NextRequest, { params }: { params: ShareManagementParams }) {
  const ownerUserId = request.headers.get('X-User-ID');
  if (!ownerUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id: passwordId, sharedUserId } = params;
    if (!ObjectId.isValid(passwordId)) {
      return NextResponse.json({ message: 'Invalid Password ID format' }, { status: 400 });
    }

    const { passwordsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }

    if (passwordDoc.ownerId !== ownerUserId) {
      return NextResponse.json({ message: 'Only the password owner can remove shares' }, { status: 403 });
    }
    
    if (passwordDoc.isDeleted) {
        // Technically could allow removing shares from a soft-deleted password, but for consistency:
        return NextResponse.json({ message: 'Cannot modify shares for a deleted password' }, { status: 400 });
    }

    const shareExists = passwordDoc.sharedWith?.some(s => s.userId === sharedUserId);
    if (!shareExists) {
      return NextResponse.json({ message: 'Share not found for this user to remove' }, { status: 404 });
    }
    
    const newHistoryEntry: HistoryEntry = {
      action: 'share_removed',
      userId: ownerUserId,
      timestamp: new Date(),
      details: { removedUserId: sharedUserId }
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(passwordId), ownerId: ownerUserId },
      { 
        $pull: { sharedWith: { userId: sharedUserId } },
        $set: { 
            lastModifiedBy: { userId: ownerUserId, timestamp: new Date() },
            history: updatedHistory,
        }
      }
    );

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
      // Matched but didn't modify, means the sharedUserId wasn't in the array to pull
      return NextResponse.json({ message: 'Share not found for this user to remove or already removed' }, { status: 404 });
    }
    if (result.matchedCount === 0) {
        return NextResponse.json({ message: 'Password not found or not owned by user' }, { status: 404 });
    }
    
    const updatedDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    return NextResponse.json({ message: 'Share removed successfully', sharedWith: updatedDoc?.sharedWith }, { status: 200 });

  } catch (error) {
    console.error('Failed to remove share:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove share';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
