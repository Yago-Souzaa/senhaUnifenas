
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
    const trimmedCategoryName = categoryName?.trim();

    if (!trimmedCategoryName || trimmedCategoryName === '') {
      return NextResponse.json({ message: 'Category name is required' }, { status: 400 });
    }
    if (!groupId || !ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Valid Group ID is required' }, { status: 400 });
    }

    const { categorySharesCollection, groupsCollection } = await connectToDatabase();
    
    const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) }) as Group | null;
    if (!group) {
        return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    const existingShare = await categorySharesCollection.findOne({
      ownerId: currentUserId, 
      categoryName: trimmedCategoryName,
      groupId: groupId,
    });

    if (existingShare) {
      return NextResponse.json({ message: 'This category is already shared with this group by you.' }, { status: 409 });
    }

    const newCategoryShare: Omit<CategoryShare, 'id'> = {
      ownerId: currentUserId,
      categoryName: trimmedCategoryName,
      groupId: groupId,
      sharedAt: new Date(),
      sharedBy: currentUserId,
    };

    const result = await categorySharesCollection.insertOne(newCategoryShare as any);
    if (!result.insertedId) {
      throw new Error('Failed to create category share, no ID returned');
    }

    const createdShare = { ...newCategoryShare, id: result.insertedId.toHexString() };
    return NextResponse.json(fromMongo(createdShare as any), { status: 201 });

  } catch (error: any) {
    console.error('Failed to share category:', error);
    if (error.code === 11000) {
        return NextResponse.json({ message: 'This category is already shared with this group by you (concurrent request).' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Failed to share category', error: error.message }, { status: 500 });
  }
}
