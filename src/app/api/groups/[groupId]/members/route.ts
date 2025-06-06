
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { GroupMember, Group } from '@/types';
import { ObjectId } from 'mongodb';

interface GroupMemberParams {
  groupId: string;
}

// POST /api/groups/[groupId]/members - Add a member to a group
export async function POST(request: NextRequest, { params }: { params: GroupMemberParams }) {
  const currentActionUserId = request.headers.get('X-User-ID');
  if (!currentActionUserId) {
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
    const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) }) as Group | null;

    if (!group) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    // Check if currentActionUserId is owner or an admin of the group
    const isOwner = group.ownerId === currentActionUserId;
    const isAdmin = group.members.some(member => member.userId === currentActionUserId && member.role === 'admin');

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: 'Only the group owner or an admin can add members' }, { status: 403 });
    }

    if (group.members.some(member => member.userId === userIdToAdd)) {
      return NextResponse.json({ message: 'User is already a member of this group. Use update if you want to change role.' }, { status: 409 });
    }

    if (userIdToAdd === group.ownerId && role !== 'admin') {
      return NextResponse.json({ message: 'Group owner must always have the admin role if being re-added (should not happen).' }, { status: 400 });
    }


    const newMember: GroupMember = {
      userId: userIdToAdd,
      role,
      addedAt: new Date(),
      addedBy: currentActionUserId,
    };

    const result = await groupsCollection.updateOne(
      { _id: new ObjectId(groupId) },
      { $addToSet: { members: newMember }, $set: { updatedAt: new Date() } }
    );
    
    const updatedGroupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });

    if (!updatedGroupDoc) {
      // This should ideally not happen if the group existed before and matchedCount was > 0
      return NextResponse.json({ message: 'Failed to retrieve group after update.' }, { status: 500 });
    }

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
         // Check if member exists now, even if modifiedCount is 0 (e.g. $addToSet found existing, or concurrent add)
         if (updatedGroupDoc.members.some(m => m.userId === userIdToAdd)) {
            // Return the full group object
            return NextResponse.json(fromMongo(updatedGroupDoc as any), { status: 200 });
         }
         return NextResponse.json({ message: 'Failed to add member, group was matched but not modified and member not found.' }, { status: 500 });
    }
    if (result.matchedCount === 0) {
        // Group was not found for the update operation
        return NextResponse.json({ message: 'Group not found during update operation' }, { status: 404 });
    }

    // Member added successfully, modifiedCount > 0
    return NextResponse.json(fromMongo(updatedGroupDoc as any), { status: 200 }); // Return the full group object

  } catch (error) {
    console.error('Failed to add group member:', error);
    return NextResponse.json({ message: 'Failed to add group member', error: (error as Error).message }, { status: 500 });
  }
}
