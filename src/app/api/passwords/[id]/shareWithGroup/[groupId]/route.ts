
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { PasswordEntry, HistoryEntry } from '@/types';
import { ObjectId } from 'mongodb';

interface ShareWithGroupParams {
  id: string; // Password ID
  groupId: string; // Group ID
}

// POST /api/passwords/[id]/shareWithGroup/[groupId] - Share a password with a group
export async function POST(request: NextRequest, { params }: { params: ShareWithGroupParams }) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id: passwordId, groupId } = params;
    if (!ObjectId.isValid(passwordId) || !ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Invalid Password ID or Group ID format' }, { status: 400 });
    }

    const { passwordsCollection, groupsCollection } = await connectToDatabase();

    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });
    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }
    
    const groupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    if(!groupDoc) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    const effectiveOwnerId = passwordDoc.ownerId || passwordDoc.userId;
    if (effectiveOwnerId !== currentUserId) {
      return NextResponse.json({ message: 'Only the password owner can share it with a group' }, { status: 403 });
    }
    
    if (passwordDoc.isDeleted) {
        return NextResponse.json({ message: 'Cannot share a deleted password' }, { status: 400 });
    }

    if (passwordDoc.sharedWithGroupIds?.includes(groupId)) {
      return NextResponse.json({ message: 'Password already shared with this group' }, { status: 409 });
    }
    
    const newHistoryEntry: HistoryEntry = {
      action: 'password_shared_with_group',
      userId: currentUserId,
      timestamp: new Date(),
      details: { groupId: groupId, groupName: groupDoc.name }
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);


    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(passwordId) },
      { 
        $addToSet: { sharedWithGroupIds: groupId },
        $set: { 
            lastModifiedBy: { userId: currentUserId, timestamp: new Date() },
            history: updatedHistory,
        }
      }
    );

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
      // Possible race condition or already shared.
       const currentPasswordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });
       if (currentPasswordDoc?.sharedWithGroupIds?.includes(groupId)) {
           return NextResponse.json({ message: 'Password was already shared or just got shared with this group.', sharedWithGroupIds: currentPasswordDoc.sharedWithGroupIds }, { status: 200 });
       }
       return NextResponse.json({ message: 'Password matched but not modified. Could not share with group.' }, { status: 500 });
    }
     if (result.matchedCount === 0) {
        return NextResponse.json({ message: 'Password not found for update (unexpected)' }, { status: 404 });
    }

    const updatedPasswordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });
    return NextResponse.json({ message: 'Password shared with group successfully', sharedWithGroupIds: updatedPasswordDoc?.sharedWithGroupIds || [] }, { status: 200 });

  } catch (error) {
    console.error('Failed to share password with group:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to share password with group';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

// DELETE /api/passwords/[id]/shareWithGroup/[groupId] - Unshare a password from a group
export async function DELETE(request: NextRequest, { params }: { params: ShareWithGroupParams }) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id: passwordId, groupId } = params;
    if (!ObjectId.isValid(passwordId) || !ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Invalid Password ID or Group ID format' }, { status: 400 });
    }

    const { passwordsCollection, groupsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }
    
    const groupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    // We don't strictly need groupDoc for unshare, but it's good for history details
    
    const effectiveOwnerId = passwordDoc.ownerId || passwordDoc.userId;
    if (effectiveOwnerId !== currentUserId) {
      // Or if user is admin of the group, but for simplicity, only owner of password can unshare from group
      return NextResponse.json({ message: 'Only the password owner can unshare it from a group' }, { status: 403 });
    }
    
    if (passwordDoc.isDeleted) {
        return NextResponse.json({ message: 'Cannot modify shares for a deleted password' }, { status: 400 });
    }

    if (!passwordDoc.sharedWithGroupIds?.includes(groupId)) {
      const currentPasswordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });
      return NextResponse.json({ message: 'Password not currently shared with this group', sharedWithGroupIds: currentPasswordDoc?.sharedWithGroupIds || [] }, { status: 404 });
    }
    
    const newHistoryEntry: HistoryEntry = {
      action: 'password_unshared_from_group',
      userId: currentUserId,
      timestamp: new Date(),
      details: { groupId: groupId, groupName: groupDoc?.name || 'Unknown Group' }
    };
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(passwordId) },
      { 
        $pull: { sharedWithGroupIds: groupId },
        $set: { 
            lastModifiedBy: { userId: currentUserId, timestamp: new Date() },
            history: updatedHistory,
        }
      }
    );
    
    if (result.modifiedCount === 0 && result.matchedCount > 0) {
       const currentPasswordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });
       if (!currentPasswordDoc?.sharedWithGroupIds?.includes(groupId)) {
           return NextResponse.json({ message: 'Password was already unshared or just got unshared from this group.', sharedWithGroupIds: currentPasswordDoc.sharedWithGroupIds }, { status: 200 });
       }
       return NextResponse.json({ message: 'Password matched but not modified. Could not unshare from group.' }, { status: 500 });
    }
     if (result.matchedCount === 0) { // Should not happen
        return NextResponse.json({ message: 'Password not found for unshare (unexpected)' }, { status: 404 });
    }

    const updatedPasswordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });
    return NextResponse.json({ message: 'Password unshared from group successfully', sharedWithGroupIds: updatedPasswordDoc?.sharedWithGroupIds || [] }, { status: 200 });

  } catch (error) {
    console.error('Failed to unshare password from group:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to unshare password from group';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
