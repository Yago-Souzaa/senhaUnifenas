
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { PasswordEntry } from '@/types';

interface GroupParams {
  groupId: string;
}

// DELETE /api/groups/[groupId] - Delete a group
export async function DELETE(request: NextRequest, { params }: { params: GroupParams }) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { groupId } = params;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Invalid Group ID format' }, { status: 400 });
    }

    const { groupsCollection, passwordsCollection } = await connectToDatabase();
    const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) });

    if (!group) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    if (group.ownerId !== currentUserId) {
      return NextResponse.json({ message: 'Only the group owner can delete the group' }, { status: 403 });
    }

    // Atomically delete the group and unshare passwords from this group
    const session = groupsCollection.client.startSession();
    let deleteMessage = 'Group deleted successfully.';

    try {
      await session.withTransaction(async () => {
        // Remove group reference from all passwords
        const updateResult = await passwordsCollection.updateMany(
          { sharedWithGroupIds: groupId },
          { $pull: { sharedWithGroupIds: groupId } },
          { session }
        );
        if (updateResult.modifiedCount > 0) {
          deleteMessage += ` Also unshared from ${updateResult.modifiedCount} password(s).`;
        }

        // Delete the group
        const deleteResult = await groupsCollection.deleteOne({ _id: new ObjectId(groupId), ownerId: currentUserId }, { session });
        if (deleteResult.deletedCount === 0) {
          // This should ideally not happen if the initial findOne and owner check passed
          throw new Error('Group not found or not owned by user during transaction.');
        }
      });
    } finally {
      await session.endSession();
    }
    
    return NextResponse.json({ message: deleteMessage }, { status: 200 });

  } catch (error) {
    console.error('Failed to delete group:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete group';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

// PUT /api/groups/[groupId] - Update group name (example, can be extended)
export async function PUT(request: NextRequest, { params }: { params: GroupParams }) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { groupId } = params;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Invalid Group ID format' }, { status: 400 });
    }

    const { name } = (await request.json()) as { name?: string };
    if (!name || name.trim() === '') {
      return NextResponse.json({ message: 'New group name is required' }, { status: 400 });
    }

    const { groupsCollection } = await connectToDatabase();
    const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) });

    if (!group) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    if (group.ownerId !== currentUserId) {
      // For now, only owner can rename. Could be extended to admins.
      return NextResponse.json({ message: 'Only the group owner can rename the group' }, { status: 403 });
    }

    const result = await groupsCollection.updateOne(
      { _id: new ObjectId(groupId) },
      { $set: { name: name.trim(), updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Group not found or not owned by user' }, { status: 404 });
    }

    const updatedGroup = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    return NextResponse.json(fromMongo(updatedGroup as any), { status: 200 });

  } catch (error) {
    console.error('Failed to update group:', error);
    return NextResponse.json({ message: 'Failed to update group', error: (error as Error).message }, { status: 500 });
  }
}

