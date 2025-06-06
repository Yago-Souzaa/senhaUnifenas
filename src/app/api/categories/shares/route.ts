
'use server';

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { CategoryShare } from '@/types';
import { ObjectId } from 'mongodb';

// GET /api/categories/shares - List category shares
// Query params: ownerId, groupId, categoryName (all optional)
export async function GET(request: NextRequest) {
  const currentUserId = request.headers.get('X-User-ID');
  if (!currentUserId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get('ownerId');
  const groupId = searchParams.get('groupId');
  const categoryName = searchParams.get('categoryName');

  try {
    const { categorySharesCollection, groupsCollection } = await connectToDatabase();
    const query: any = {};

    if (ownerId) query.ownerId = ownerId;
    if (groupId) query.groupId = groupId;
    if (categoryName) query.categoryName = categoryName;

    // Security: If no specific filters are provided, only return shares relevant to the current user.
    // 1. Shares they own.
    // 2. Shares made to groups they are a member of.
    if (Object.keys(query).length === 0) {
      const userGroupIds = (await groupsCollection.find({ 'members.userId': currentUserId })
        .project({ _id: 1 }).toArray())
        .map(g => g._id.toHexString());
      
      query.$or = [
        { ownerId: currentUserId },
      ];
      if (userGroupIds.length > 0) {
        query.$or.push({ groupId: { $in: userGroupIds } });
      }
      // If user is not in any groups and is not owner of any shares, $or might be empty or just {ownerId...}
      // which is fine.
      if(query.$or.length === 1 && !userGroupIds.length && query.$or[0].ownerId === currentUserId) {
        // Only owned shares if not in any groups
      } else if (query.$or.length === 0) {
        // User has no shares they own and is in no groups, return empty
         return NextResponse.json([], { status: 200 });
      }
    } else {
      // If specific filters are applied, ensure the user has some relation.
      // For simplicity, if ownerId is specified, it must be currentUserId unless they are querying for a group they are in.
      if (ownerId && ownerId !== currentUserId) {
          // Check if current user is member of the group if groupId is also specified
          if (groupId) {
              const group = await groupsCollection.findOne({_id: new ObjectId(groupId), "members.userId": currentUserId});
              if (!group) {
                return NextResponse.json({ message: "Access denied to view shares for this owner/group combination."}, {status: 403});
              }
          } else {
             // User is asking for shares of another owner, without specifying a group they are in. Deny.
             return NextResponse.json({ message: "Access denied to view shares for this owner."}, {status: 403});
          }
      }
      // If groupId is specified, user must be a member of that group to see its shares (unless they are the owner of the share)
      if (groupId && (!ownerId || ownerId !== currentUserId)) { // if ownerId is specified and it's them, that's fine
          const group = await groupsCollection.findOne({_id: new ObjectId(groupId), "members.userId": currentUserId});
          if (!group) {
            return NextResponse.json({ message: "Access denied to view shares for this group."}, {status: 403});
          }
      }
    }


    const shares = await categorySharesCollection.find(query).toArray();
    return NextResponse.json(shares.map(share => fromMongo(share as any)), { status: 200 });

  } catch (error: any) {
    console.error('Failed to fetch category shares:', error);
    return NextResponse.json({ message: 'Failed to fetch category shares', error: error.message }, { status: 500 });
  }
}
