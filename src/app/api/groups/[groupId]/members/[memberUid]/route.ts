
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { GroupMember, Group } from '@/types';

interface GroupMemberManagementParams {
  groupId: string;
  memberUid: string;
}

// DELETE /api/groups/[groupId]/members/[memberUid] - Remove a member from a group
export async function DELETE(request: NextRequest, { params }: { params: GroupMemberManagementParams }) {
  const currentActionUserId = request.headers.get('X-User-ID');
  if (!currentActionUserId) {
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
    let group = await groupsCollection.findOne({ _id: new ObjectId(groupId) }) as Group | null;

    if (!group) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    const isOwner = group.ownerId === currentActionUserId;
    const isAdmin = group.members.some(member => member.userId === currentActionUserId && member.role === 'admin');

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: 'Only the group owner or an admin can remove members' }, { status: 403 });
    }

    if (memberUid === group.ownerId) {
        return NextResponse.json({ message: 'Group owner cannot be removed from the group. Delete the group instead or transfer ownership (not implemented).' }, { status: 400 });
    }

    if (!isOwner && isAdmin) {
        const memberToRemove = group.members.find(m => m.userId === memberUid);
        if (memberToRemove?.role === 'admin') {
            return NextResponse.json({ message: 'Admins cannot remove other admins. Only the group owner can.' }, { status: 403 });
        }
    }

    const memberExists = group.members.some(member => member.userId === memberUid);
    if (!memberExists) {
      return NextResponse.json({ message: 'Member not found in this group' }, { status: 404 });
    }

    const result = await groupsCollection.updateOne(
      { _id: new ObjectId(groupId) },
      { $pull: { members: { userId: memberUid } }, $set: { updatedAt: new Date() } }
    );

    const updatedGroupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    if (!updatedGroupDoc) {
         return NextResponse.json({ message: 'Failed to retrieve group after member removal.' }, { status: 500 });
    }

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
        // Check if member is actually gone
        if (!updatedGroupDoc.members.some(m => m.userId === memberUid)) {
            return NextResponse.json(fromMongo(updatedGroupDoc as any), { status: 200 });
        }
        return NextResponse.json({ message: 'Failed to remove member, group was matched but not modified and member still present.' }, { status: 500 });
    }
    if (result.matchedCount === 0) {
        return NextResponse.json({ message: 'Group not found during update' }, { status: 404 });
    }

    return NextResponse.json(fromMongo(updatedGroupDoc as any), { status: 200 });

  } catch (error) {
    console.error('Failed to remove group member:', error);
    return NextResponse.json({ message: 'Failed to remove group member', error: (error as Error).message }, { status: 500 });
  }
}

// PUT /api/groups/[groupId]/members/[memberUid] - Update a member's role
export async function PUT(request: NextRequest, { params }: { params: GroupMemberManagementParams }) {
  const currentActionUserId = request.headers.get('X-User-ID');
  if (!currentActionUserId) {
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
    let group = await groupsCollection.findOne({ _id: new ObjectId(groupId) }) as Group | null;

    if (!group) {
      return NextResponse.json({ message: 'Group not found' }, { status: 404 });
    }

    const isOwner = group.ownerId === currentActionUserId;
    const isAdmin = group.members.some(member => member.userId === currentActionUserId && member.role === 'admin');

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ message: 'Only the group owner or an admin can change member roles' }, { status: 403 });
    }

    if (memberUid === group.ownerId && role !== 'admin') {
      return NextResponse.json({ message: 'Group owner must always have the admin role.' }, { status: 400 });
    }

    if (!isOwner && isAdmin) {
        const memberToUpdate = group.members.find(m => m.userId === memberUid);
        if (memberToUpdate?.role === 'admin' && memberUid !== currentActionUserId) { 
            return NextResponse.json({ message: 'Admins cannot change other admins roles. Only the group owner can.' }, { status: 403 });
        }
    }

    const memberIndex = group.members.findIndex(m => m.userId === memberUid);
    if (memberIndex === -1) {
      return NextResponse.json({ message: 'Member not found in this group' }, { status: 404 });
    }

    if (group.members[memberIndex].role === role) {
        const currentGroupState = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
        if (!currentGroupState) return NextResponse.json({ message: 'Group not found after checking role.' }, { status: 404 });
        return NextResponse.json(fromMongo(currentGroupState as any), { status: 200 });
    }

    const result = await groupsCollection.updateOne(
      { _id: new ObjectId(groupId), "members.userId": memberUid },
      { $set: { "members.$.role": role, updatedAt: new Date() } }
    );
    
    const updatedGroupDoc = await groupsCollection.findOne({ _id: new ObjectId(groupId) });
    if (!updatedGroupDoc) {
         return NextResponse.json({ message: 'Failed to retrieve group after role update.' }, { status: 500 });
    }

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
        const currentMember = updatedGroupDoc.members.find(m => m.userId === memberUid);
        if (currentMember?.role === role) { // Role is already what we wanted
            return NextResponse.json(fromMongo(updatedGroupDoc as any), { status: 200 });
        }
        return NextResponse.json({ message: 'Failed to update member role, matched but not modified and role not changed.' }, { status: 500 });
    }
    if (result.matchedCount === 0) {
        return NextResponse.json({ message: 'Group or member not found during update' }, { status: 404 });
    }

    return NextResponse.json(fromMongo(updatedGroupDoc as any), { status: 200 });

  } catch (error) {
    console.error('Failed to update group member role:', error);
    return NextResponse.json({ message: 'Failed to update group member role', error: (error as Error).message }, { status: 500 });
  }
}
