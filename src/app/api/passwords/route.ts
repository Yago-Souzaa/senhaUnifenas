
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { PasswordEntry, Group } from '@/types'; // Added Group
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { passwordsCollection, groupsCollection } = await connectToDatabase();
    
    // Find groups where the user is a member
    const userGroupDocs = await groupsCollection.find({ 'members.userId': userId }).project({ _id: 1 }).toArray();
    const userGroupIds = userGroupDocs.map(doc => doc._id.toHexString());

    // Construct the query
    const query: any = {
      isDeleted: { $ne: true }, // Exclude soft-deleted passwords
      $or: [
        { ownerId: userId }, // User owns the password
        { userId: userId }, // Legacy ownerId check
        { 'sharedWith.userId': userId }, // Password is directly shared with the user
      ]
    };

    if (userGroupIds.length > 0) {
      query.$or.push({ sharedWithGroupIds: { $in: userGroupIds } }); // Password shared with a group user is in
    }
    
    const passwordsFromDb = await passwordsCollection.find(query).toArray();
    const passwords = passwordsFromDb.map(doc => fromMongo(doc as any));
    
    return NextResponse.json(passwords, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch passwords:', error);
    return NextResponse.json({ message: 'Failed to fetch passwords', error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const entryData = (await request.json()) as Omit<PasswordEntry, 'id' | 'userId' | 'ownerId' | 'sharedWith' | 'sharedWithGroupIds' | 'history' | 'isDeleted' | 'createdBy' | 'lastModifiedBy'>;
    
    const entryDataWithOwner: Omit<PasswordEntry, 'id'> = {
      ...entryData,
      ownerId: userId, // Set ownerId to current user
      userId: userId, // Also set legacy userId for compatibility if needed, though ownerId is primary
      createdAt: new Date(),
      createdBy: { userId: userId, timestamp: new Date() },
      sharedWith: [],
      sharedWithGroupIds: [],
      history: [{ action: 'created', userId: userId, timestamp: new Date() }],
      isDeleted: false,
    };
    
    const { passwordsCollection } = await connectToDatabase();
    const result = await passwordsCollection.insertOne(entryDataWithOwner as any);
    
    if (!result.insertedId) {
        throw new Error('Failed to insert password, no ID returned');
    }

    const newPassword = {
      ...entryDataWithOwner,
      id: result.insertedId.toHexString(),
    } as PasswordEntry;

    return NextResponse.json(fromMongo(newPassword as any), { status: 201 });
  } catch (error) {
    console.error('Failed to add password:', error);
    return NextResponse.json({ message: 'Failed to add password', error: (error as Error).message }, { status: 500 });
  }
}
