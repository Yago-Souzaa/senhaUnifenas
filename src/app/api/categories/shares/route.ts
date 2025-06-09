
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
  const categoryNameParam = searchParams.get('categoryName');

  try {
    const { categorySharesCollection, groupsCollection } = await connectToDatabase();
    const query: any = {};

    if (ownerId) query.ownerId = ownerId;
    if (groupId) query.groupId = groupId;
    if (categoryNameParam) query.categoryName = categoryNameParam.trim(); // Trim category name from query

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
      if(query.$or.length === 1 && !userGroupIds.length && query.$or[0].ownerId === currentUserId) {
        // Only owned shares if not in any groups
      } else if (query.$or.length === 0) {
         return NextResponse.json([], { status: 200 });
      }
    } else {
      // If specific filters are applied, ensure the user has some relation.
      if (ownerId && ownerId !== currentUserId) {
          if (groupId) {
              const group = await groupsCollection.findOne({_id: new ObjectId(groupId), "members.userId": currentUserId});
              if (!group) {
                return NextResponse.json({ message: "Access denied to view shares for this owner/group combination."}, {status: 403});
              }
          } else {
             return NextResponse.json({ message: "Access denied to view shares for this owner."}, {status: 403});
          }
      }
      if (groupId && (!ownerId || ownerId !== currentUserId)) { 
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
