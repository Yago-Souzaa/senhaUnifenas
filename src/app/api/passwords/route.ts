
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo, toMongoWithoutId } from '@/lib/mongodb';
import type { PasswordEntry } from '@/types';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const { passwordsCollection } = await connectToDatabase();
    const passwordsFromDb = await passwordsCollection.find({}).toArray();
    const passwords = passwordsFromDb.map(doc => fromMongo(doc as any));
    return NextResponse.json(passwords, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch passwords:', error);
    return NextResponse.json({ message: 'Failed to fetch passwords' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const entryData = (await request.json()) as Omit<PasswordEntry, 'id'>;
    const { passwordsCollection } = await connectToDatabase();
    
    // MongoDB will generate the _id
    const result = await passwordsCollection.insertOne(entryData);
    
    if (!result.insertedId) {
        throw new Error('Failed to insert password, no ID returned');
    }

    const newPassword = {
      ...entryData,
      id: result.insertedId.toHexString(), // Use the new ID from MongoDB
    } as PasswordEntry;

    return NextResponse.json(newPassword, { status: 201 });
  } catch (error) {
    console.error('Failed to add password:', error);
    return NextResponse.json({ message: 'Failed to add password', error: (error as Error).message }, { status: 500 });
  }
}
