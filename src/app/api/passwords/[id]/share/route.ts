
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { PasswordEntry, SharedUser, HistoryEntry } from '@/types';
import { ObjectId } from 'mongodb';

interface ShareParams {
  id: string; // Password ID
}

// POST /api/passwords/[id]/share
export async function POST(request: NextRequest, { params }: { params: ShareParams }) {
  const sharerUserId = request.headers.get('X-User-ID');
  if (!sharerUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id: passwordId } = params;
    if (!ObjectId.isValid(passwordId)) {
      return NextResponse.json({ message: 'Invalid Password ID format' }, { status: 400 });
    }

    const { userIdToShareWith, permission } = (await request.json()) as { userIdToShareWith: string; permission: 'read' | 'full' };

    if (!userIdToShareWith || !permission || !['read', 'full'].includes(permission)) {
      return NextResponse.json({ message: 'User ID to share with and permission (read/full) are required' }, { status: 400 });
    }

    if (userIdToShareWith === sharerUserId) {
        return NextResponse.json({ message: 'Cannot share a password with yourself' }, { status: 400 });
    }

    const { passwordsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(passwordId) });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }

    const effectiveOwnerId = passwordDoc.ownerId || passwordDoc.userId; // Check ownerId, fallback to userId
    if (effectiveOwnerId !== sharerUserId) {
      return NextResponse.json({ message: 'Only the password owner can share it' }, { status: 403 });
    }
    
    if (passwordDoc.isDeleted) {
        return NextResponse.json({ message: 'Cannot share a deleted password' }, { status: 400 });
    }

    const existingShareIndex = passwordDoc.sharedWith?.findIndex(s => s.userId === userIdToShareWith);
    if (existingShareIndex !== -1) {
      return NextResponse.json({ message: 'Password already shared with this user. Use update if you want to change permissions.' }, { status: 409 });
    }
    
    const newShare: SharedUser = {
      userId: userIdToShareWith,
      permission,
      sharedAt: new Date(),
      sharedBy: sharerUserId,
    };

    const newHistoryEntry: HistoryEntry = {
      action: 'shared',
      userId: sharerUserId,
      timestamp: new Date(),
      details: { sharedWithUserId: userIdToShareWith, permission }
    };

    const updatedSharedWith = [...(passwordDoc.sharedWith || []), newShare];
    const updatedHistory = [newHistoryEntry, ...(passwordDoc.history || [])].slice(0, 10);

    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(passwordId) }, // No longer need ownerId in query here, already validated above
      { 
        $set: { 
            sharedWith: updatedSharedWith,
            lastModifiedBy: { userId: sharerUserId, timestamp: new Date() },
            history: updatedHistory,
        }
      }
    );

    // matchedCount check is less critical here since we found the doc and validated ownership.
    // If result.modifiedCount is 0 and we expected a change, that might indicate an issue, but for $set on new shares, it should be 1.
    if (result.modifiedCount === 0) {
        // This could happen if something went wrong with the update itself, though unlikely for $set.
        console.warn(`Share POST: Password ${passwordId} matched but not modified. This might be unexpected.`);
    }


    return NextResponse.json({ message: 'Password shared successfully', sharedWith: updatedSharedWith }, { status: 200 });

  } catch (error) {
    console.error('Failed to share password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to share password';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
