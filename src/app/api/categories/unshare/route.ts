
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { Group } from '@/types'; // Group might be needed for permission checks
import { ObjectId } from 'mongodb';

// Using POST for unshare to easily pass body parameters
// POST /api/categories/unshare - Unshare a category from a group
export async function POST(request: NextRequest) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { categoryName, groupId } = (await request.json()) as { categoryName: string; groupId: string };

    if (!categoryName || categoryName.trim() === '') {
      return NextResponse.json({ message: 'Category name is required' }, { status: 400 });
    }
    if (!groupId || !ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Valid Group ID is required' }, { status: 400 });
    }

    const { categorySharesCollection, groupsCollection } = await connectToDatabase();

    // Permission check:
    // User must be the owner of the category share (currentUserId === share.ownerId)
    // OR an admin of the group from which the category is being unshared.
    const shareToUnshare = await categorySharesCollection.findOne({
        ownerId: currentUserId, // First, try if current user is the one who shared their own category
        categoryName: categoryName.trim(),
        groupId: groupId,
    });

    let canUnshare = false;
    if (shareToUnshare && shareToUnshare.ownerId === currentUserId) {
        canUnshare = true;
    } else {
        // If not owner of the share, check if current user is admin of the group
        const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) }) as Group | null;
        if (group && group.members.some(m => m.userId === currentUserId && m.role === 'admin')) {
            // If admin, they can unshare *any* category from *this* group
            // So the deletion target is different
             const adminUnshareTarget = await categorySharesCollection.findOne({
                // ownerId is NOT currentUserId here, it's the original sharer
                categoryName: categoryName.trim(),
                groupId: groupId,
            });
            if (adminUnshareTarget) { // Ensure the share actually exists for this group/category combo
                 canUnshare = true;
                 // If admin is unsharing, the delete query needs to target the actual share, not just currentUserId's shares
            } else {
                 return NextResponse.json({ message: `Category "${categoryName.trim()}" is not shared with group ID "${groupId}".` }, { status: 404 });
            }
        }
    }

    if (!canUnshare) {
        return NextResponse.json({ message: 'You do not have permission to unshare this category from this group.' }, { status: 403 });
    }
    
    // Determine the correct filter for deletion
    const deleteFilter: any = {
        categoryName: categoryName.trim(),
        groupId: groupId,
    };
    // If the current user is not the owner of the share, they must be an admin unsharing someone else's category from the group.
    // In this case, we don't restrict by ownerId: currentUserId for the deletion.
    // If they ARE the owner of the share, then we ensure they only delete THEIR share.
    if (shareToUnshare && shareToUnshare.ownerId === currentUserId) {
        deleteFilter.ownerId = currentUserId;
    } else if (! (await groupsCollection.findOne({ _id: new ObjectId(groupId), "members.userId": currentUserId, "members.role": "admin" }))){
        // Fallback, should have been caught by canUnshare logic, but as a safeguard.
        // This means user is not owner of share and not admin of group.
        return NextResponse.json({ message: 'Permission denied (consistency check failed).' }, { status: 403 });
    }


    const result = await categorySharesCollection.deleteOne(deleteFilter);

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Category share not found or already unshared.' }, { status: 404 });
    }

    // TODO: Add history entry to the group?

    return NextResponse.json({ message: 'Category unshared successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Failed to unshare category:', error);
    return NextResponse.json({ message: 'Failed to unshare category', error: error.message }, { status: 500 });
  }
}
