
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { GroupMember } from '@/types';
import { ObjectId } from 'mongodb';

interface GroupMemberParams {
  groupId: string;
}

// POST /api/groups/[groupId]/members - Add a member to a group
export async function POST(request: NextRequest, { params }: { params: GroupMemberParams }) {
  const currentUserId = request.headers.get('X-User-ID'); // User performing the action
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { groupId } = params;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Invalid Group ID format' }, { status: 400 });
    }

    const { userIdToAdd, role } = (await request.json()) as { userIdToAdd: string; role: 'member' | 'admin' };
    if (!userIdToAdd || !role || !['member', 'admin'].includes(role)) {
      return NextResponse.json({ message: 'User ID to add and a valid role (member/admin) are required' }, { status: 400 });
    }

    const { groupsCollection } = await connectToDatabase();
    const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) });

    if (!group) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    // Only owner can add/manage members/admins for now
    if (group.ownerId !== currentUserId) {
      return NextResponse.json({ message: 'Only the group owner can add members' }, { status: 403 });
    }

    if (group.members.some(member => member.userId === userIdToAdd)) {
      return NextResponse.json({ message: 'User is already a member of this group. Use update if you want to change role.' }, { status: 409 });
    }

    const newMember: GroupMember = {
      userId: userIdToAdd,
      role,
      addedAt: new Date(),
      addedBy: currentUserId,
    };

    const result = await groupsCollection.updateOne(
      { _id: new ObjectId(groupId) },
      { $addToSet: { members: newMember }, $set: { updatedAt: new Date() } } // $addToSet to avoid duplicates if somehow check above fails
    );

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
         // Could happen if member was added by another process between find and update.
         // Or if $addToSet didn't add due to exact same object (less likely with new Date()).
         const updatedGroup = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
         if (updatedGroup?.members.some(m => m.userId === userIdToAdd)) {
            return NextResponse.json({ message: 'Member already exists or was just added', members: updatedGroup.members.map(m => fromMongo(m as any)) }, { status: 200 });
         }
         return NextResponse.json({ message: 'Failed to add member, group was matched but not modified.' }, { status: 500 });
    }
    if (result.matchedCount === 0) {
        return NextResponse.json({ message: 'Group not found during update' }, { status: 404 });
    }


    const updatedGroupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    return NextResponse.json({ message: 'Member added successfully', members: updatedGroupDoc?.members.map(m => fromMongo(m as any)) || [] }, { status: 200 });

  } catch (error) {
    console.error('Failed to add group member:', error);
    return NextResponse.json({ message: 'Failed to add group member', error: (error as Error).message }, { status: 500 });
  }
}
