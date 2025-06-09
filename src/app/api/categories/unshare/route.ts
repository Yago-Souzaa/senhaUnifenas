
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import type { Group } from '@/types'; 
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { categoryName, groupId } = (await request.json()) as { categoryName: string; groupId: string };
    const trimmedCategoryName = categoryName?.trim();

    if (!trimmedCategoryName || trimmedCategoryName === '') {
      return NextResponse.json({ message: 'Category name is required' }, { status: 400 });
    }
    if (!groupId || !ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Valid Group ID is required' }, { status: 400 });
    }

    const { categorySharesCollection, groupsCollection } = await connectToDatabase();

    const shareToUnshare = await categorySharesCollection.findOne({
        ownerId: currentUserId, 
        categoryName: trimmedCategoryName,
        groupId: groupId,
    });

    let canUnshare = false;
    if (shareToUnshare && shareToUnshare.ownerId === currentUserId) {
        canUnshare = true;
    } else {
        const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) }) as Group | null;
        if (group && group.members.some(m => m.userId === currentUserId && m.role === 'admin')) {
             const adminUnshareTarget = await categorySharesCollection.findOne({
                categoryName: trimmedCategoryName,
                groupId: groupId,
            });
            if (adminUnshareTarget) { 
                 canUnshare = true;
            } else {
                 return NextResponse.json({ message: `Category "${trimmedCategoryName}" is not shared with group ID "${groupId}".` }, { status: 404 });
            }
        }
    }

    if (!canUnshare) {
        return NextResponse.json({ message: 'You do not have permission to unshare this category from this group.' }, { status: 403 });
    }
    
    const deleteFilter: any = {
        categoryName: trimmedCategoryName,
        groupId: groupId,
    };
    if (shareToUnshare && shareToUnshare.ownerId === currentUserId) {
        deleteFilter.ownerId = currentUserId;
    } else if (! (await groupsCollection.findOne({ _id: new ObjectId(groupId), "members.userId": currentUserId, "members.role": "admin" }))){
        return NextResponse.json({ message: 'Permission denied (consistency check failed).' }, { status: 403 });
    }

    const result = await categorySharesCollection.deleteOne(deleteFilter);

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Category share not found or already unshared.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Category unshared successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Failed to unshare category:', error);
    return NextResponse.json({ message: 'Failed to unshare category', error: error.message }, { status: 500 });
  }
}
