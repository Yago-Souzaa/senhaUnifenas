
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { CategoryShare, Group } from '@/types';
import { ObjectId } from 'mongodb';

// POST /api/categories/share - Share a category with a group
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

    // Verify the group exists and the current user is an owner or admin of the group
    // (Rule: User must own the category, and can share it with any group they are admin of, or any group if they own category)
    // For simplicity now: user must own category to share it. They can share it with any valid group.
    // Further permission check: can they share with THIS specific group? (e.g. are they member/admin of it?)
    // Let's assume for now: if you own the category, you can attempt to share it with any existing group.
    // The more restrictive permission is usually on *who* can add *to* a group's resources.
    // But here, it's "my category" being shared "to group X".
    
    const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) }) as Group | null;
    if (!group) {
        return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    // Optional: Check if currentUserId is at least a member of the group they are sharing to.
    // const isMemberOfTargetGroup = group.members.some(m => m.userId === currentUserId);
    // if (!isMemberOfTargetGroup) {
    //     return NextResponse.json({ message: 'You must be a member of the group to share a category with it.' }, { status: 403 });
    // }

    const existingShare = await categorySharesCollection.findOne({
      ownerId: currentUserId, // User can only share their own categories
      categoryName: categoryName.trim(),
      groupId: groupId,
    });

    if (existingShare) {
      return NextResponse.json({ message: 'This category is already shared with this group by you.' }, { status: 409 });
    }

    const newCategoryShare: Omit<CategoryShare, 'id'> = {
      ownerId: currentUserId,
      categoryName: categoryName.trim(),
      groupId: groupId,
      sharedAt: new Date(),
      sharedBy: currentUserId,
    };

    const result = await categorySharesCollection.insertOne(newCategoryShare as any);
    if (!result.insertedId) {
      throw new Error('Failed to create category share, no ID returned');
    }

    // TODO: Add history entry to the group? Or to the user?

    const createdShare = { ...newCategoryShare, id: result.insertedId.toHexString() };
    return NextResponse.json(fromMongo(createdShare as any), { status: 201 });

  } catch (error: any) {
    console.error('Failed to share category:', error);
    // Handle unique constraint violation (duplicate share attempt)
    if (error.code === 11000) {
        return NextResponse.json({ message: 'This category is already shared with this group by you (concurrent request).' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Failed to share category', error: error.message }, { status: 500 });
  }
}
