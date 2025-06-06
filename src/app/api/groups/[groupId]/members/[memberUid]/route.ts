
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { GroupMember } from '@/types';

interface GroupMemberManagementParams {
  groupId: string;
  memberUid: string; // Firebase UID of the member to manage
}

// DELETE /api/groups/[groupId]/members/[memberUid] - Remove a member from a group
export async function DELETE(request: NextRequest, { params }: { params: GroupMemberManagementParams }) {
  const currentUserId = request.headers.get('X-User-ID'); // User performing the action
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { groupId, memberUid } = params;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Invalid Group ID format' }, { status: 400 });
    }
    if (!memberUid) {
      return NextResponse.json({ message: 'Member UID is required' }, { status: 400 });
    }

    const { groupsCollection } = await connectToDatabase();
    const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) });

    if (!group) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    // Only owner can remove members
    if (group.ownerId !== currentUserId) {
      return NextResponse.json({ message: 'Only the group owner can remove members' }, { status: 403 });
    }

    if (memberUid === group.ownerId) {
        return NextResponse.json({ message: 'Group owner cannot be removed from the group. Delete the group instead.' }, { status: 400 });
    }

    const memberExists = group.members.some(member => member.userId === memberUid);
    if (!memberExists) {
      return NextResponse.json({ message: 'Member not found in this group' }, { status: 404 });
    }

    const result = await groupsCollection.updateOne(
      { _id: new ObjectId(groupId) },
      { $pull: { members: { userId: memberUid } }, $set: { updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
        // Member might have been already removed
        const updatedGroup = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
        if (!updatedGroup?.members.some(m => m.userId === memberUid)) {
            return NextResponse.json({ message: 'Member already removed or not found after pull.', members: updatedGroup?.members.map(m => fromMongo(m as any)) || [] }, { status: 200 });
        }
        return NextResponse.json({ message: 'Failed to remove member, group was matched but not modified.' }, { status: 500 });
    }
    if (result.matchedCount === 0) {
        return NextResponse.json({ message: 'Group not found during update' }, { status: 404 });
    }

    const updatedGroupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    return NextResponse.json({ message: 'Member removed successfully', members: updatedGroupDoc?.members.map(m => fromMongo(m as any)) || [] }, { status: 200 });

  } catch (error) {
    console.error('Failed to remove group member:', error);
    return NextResponse.json({ message: 'Failed to remove group member', error: (error as Error).message }, { status: 500 });
  }
}

// PUT /api/groups/[groupId]/members/[memberUid] - Update a member's role
export async function PUT(request: NextRequest, { params }: { params: GroupMemberManagementParams }) {
  const currentUserId = request.headers.get('X-User-ID'); // User performing the action
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { groupId, memberUid } = params;
    if (!ObjectId.isValid(groupId)) {
      return NextResponse.json({ message: 'Invalid Group ID format' }, { status: 400 });
    }

    const { role } = (await request.json()) as { role: 'member' | 'admin' };
    if (!role || !['member', 'admin'].includes(role)) {
      return NextResponse.json({ message: 'A valid role (member/admin) is required' }, { status: 400 });
    }

    const { groupsCollection } = await connectToDatabase();
    const group = await groupsCollection.findOne({ _id: new ObjectId(groupId) });

    if (!group) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    if (group.ownerId !== currentUserId) {
      return NextResponse.json({ message: 'Only the group owner can change member roles' }, { status: 403 });
    }
    
    if (memberUid === group.ownerId && role !== 'admin') {
      return NextResponse.json({ message: 'Group owner must always have the admin role.' }, { status: 400 });
    }

    const memberIndex = group.members.findIndex(m => m.userId === memberUid);
    if (memberIndex === -1) {
      return NextResponse.json({ message: 'Member not found in this group' }, { status: 404 });
    }
    
    if (group.members[memberIndex].role === role) {
        const updatedGroupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
        return NextResponse.json({ message: 'Member role is already set to this value.', members: updatedGroupDoc?.members.map(m => fromMongo(m as any)) || [] }, { status: 200 });
    }

    const result = await groupsCollection.updateOne(
      { _id: new ObjectId(groupId), "members.userId": memberUid },
      { $set: { "members.$.role": role, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
        const updatedGroupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
        // Check if role was actually updated by some other means or if it's a stale request
        const currentMember = updatedGroupDoc?.members.find(m => m.userId === memberUid);
        if (currentMember?.role === role) {
            return NextResponse.json({ message: 'Member role appears to be updated.', members: updatedGroupDoc?.members.map(m => fromMongo(m as any)) || [] }, { status: 200 });
        }
        return NextResponse.json({ message: 'Failed to update member role, matched but not modified.' }, { status: 500 });
    }
    if (result.matchedCount === 0) {
        return NextResponse.json({ message: 'Group or member not found during update' }, { status: 404 });
    }

    const updatedGroupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    return NextResponse.json({ message: 'Member role updated successfully', members: updatedGroupDoc?.members.map(m => fromMongo(m as any)) || [] }, { status: 200 });

  } catch (error) {
    console.error('Failed to update group member role:', error);
    return NextResponse.json({ message: 'Failed to update group member role', error: (error as Error).message }, { status: 500 });
  }
}
