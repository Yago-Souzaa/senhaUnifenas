
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { Group, GroupMember } from '@/types';
import { ObjectId } from 'mongodb';

// POST /api/groups - Create a new group
export async function POST(request: NextRequest) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { name } = (await request.json()) as { name: string };
    if (!name || name.trim() === '') {
      return NextResponse.json({ message: 'Group name is required' }, { status: 400 });
    }

    const { groupsCollection } = await connectToDatabase();

    const newGroup: Omit<Group, 'id'> = {
      name: name.trim(),
      ownerId: currentUserId,
      members: [{ userId: currentUserId, role: 'admin', addedAt: new Date(), addedBy: currentUserId }], // Owner is automatically an admin
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await groupsCollection.insertOne(newGroup as any);
    if (!result.insertedId) {
      throw new Error('Failed to create group, no ID returned');
    }

    const createdGroup = { ...newGroup, id: result.insertedId.toHexString() };
    return NextResponse.json(fromMongo(createdGroup as any), { status: 201 });

  } catch (error) {
    console.error('Failed to create group:', error);
    return NextResponse.json({ message: 'Failed to create group', error: (error as Error).message }, { status: 500 });
  }
}

// GET /api/groups - List groups the user owns or is a member of
export async function GET(request: NextRequest) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { groupsCollection } = await connectToDatabase();
    const userGroups = await groupsCollection.find({
      $or: [
        { ownerId: currentUserId },
        { 'members.userId': currentUserId }
      ]
    }).toArray();

    return NextResponse.json(userGroups.map(group => fromMongo(group as any)), { status: 200 });

  } catch (error) {
    console.error('Failed to fetch groups:', error);
    return NextResponse.json({ message: 'Failed to fetch groups', error: (error as Error).message }, { status: 500 });
  }
}
