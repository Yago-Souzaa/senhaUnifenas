
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb'; // fromMongo might be needed for PUT response
import { ObjectId } from 'mongodb';
// import type { PasswordEntry } from '@/types'; // Not directly used in DELETE or PUT here

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

    let deleteMessage = 'Group deleted successfully.';

    // Perform operations sequentially without a transaction
    try {
      // Remove group reference from all passwords
      // This operation is on the passwordsCollection
      const updateResult = await passwordsCollection.updateMany(
        { sharedWithGroupIds: groupId }, // This field was removed, passwords are now shared via category.
                                          // However, category unsharing is handled by category API.
                                          // If a group is deleted, category shares pointing to it should ideally be cleaned up,
                                          // or handled when accessing shared categories.
                                          // For now, let's focus on deleting the group itself.
                                          // The original transaction also tried to update passwordsCollection.
                                          // The current model shares categories, not individual passwords with groups.
                                          // Deleting a group means CategoryShares pointing to this groupId become orphaned.
                                          // A more robust solution would also delete CategoryShare documents associated with this group.
        { $pull: { sharedWithGroupIds: groupId } } // This targets a field that's no longer in PasswordEntry for group sharing.
                                                  // This line might not do anything useful with the current model.
                                                  // We will keep it for now in case legacy data exists, or if there's a misunderstanding of current schema.
                                                  // A better cleanup would be to remove CategoryShare documents.
      );
      // if (updateResult.modifiedCount > 0) {
      //   deleteMessage += ` Also unshared from ${updateResult.modifiedCount} password(s).`;
      // }

      // Then, delete the group
      const deleteResult = await groupsCollection.deleteOne({ _id: new ObjectId(groupId), ownerId: currentUserId });
      if (deleteResult.deletedCount === 0) {
        throw new Error('Group not found or not owned by user during deletion attempt.');
      }
      
      // Additionally, we should clean up CategoryShares associated with this group
      const { categorySharesCollection } = await connectToDatabase();
      const categoryShareCleanupResult = await categorySharesCollection.deleteMany({ groupId: groupId });
      if (categoryShareCleanupResult.deletedCount > 0) {
          deleteMessage += ` Also removed ${categoryShareCleanupResult.deletedCount} category share(s) associated with this group.`;
      }


    } catch (operationError: any) {
      console.error('Error during group deletion operations:', operationError);
      // If any operation fails, we throw an error.
      // The client will see a generic "Failed to delete group" or the specific error from here.
      return NextResponse.json({ message: 'Failed to complete all deletion operations for group.', error: operationError.message }, { status: 500 });
    }
    
    return NextResponse.json({ message: deleteMessage }, { status: 200 });

  } catch (error) {
    console.error('Failed to delete group (outer try-catch):', error);
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

    // Check if currentUserId is owner or an admin of the group
    const isOwner = group.ownerId === currentUserId;
    const isAdmin = group.members.some(member => member.userId === currentUserId && member.role === 'admin');

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: 'Only the group owner or an admin can rename the group' }, { status: 403 });
    }

    const result = await groupsCollection.updateOne(
      { _id: new ObjectId(groupId) },
      { $set: { name: name.trim(), updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      // This implies group was deleted between the findOne and updateOne, or permission changed.
      return NextResponse.json({ message: 'Group not found or permission issue during update' }, { status: 404 });
    }

    const updatedGroup = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    return NextResponse.json(fromMongo(updatedGroup as any), { status: 200 });

  } catch (error) {
    console.error('Failed to update group:', error);
    return NextResponse.json({ message: 'Failed to update group', error: (error as Error).message }, { status: 500 });
  }
}
    