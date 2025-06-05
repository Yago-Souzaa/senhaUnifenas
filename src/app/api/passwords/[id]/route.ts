
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo, toMongo } from '@/lib/mongodb';
import type { PasswordEntry } from '@/types';
import { ObjectId } from 'mongodb';

interface Params {
  id: string;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    const { passwordsCollection } = await connectToDatabase();
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(id) });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }
    return NextResponse.json(fromMongo(passwordDoc as any), { status: 200 });
  } catch (error) {
    console.error('Failed to fetch password:', error);
    return NextResponse.json({ message: 'Failed to fetch password' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    const updatedEntryData = (await request.json()) as PasswordEntry;
    
    // Remove id field for MongoDB update, as _id is immutable or handled by the query
    const { id: entryId, ...dataToUpdate } = updatedEntryData;

    const { passwordsCollection } = await connectToDatabase();
    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: dataToUpdate }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }
    // Return the updated entry data as sent by the client, plus the original ID
    return NextResponse.json({ ...dataToUpdate, id }, { status: 200 });
  } catch (error) {
    console.error('Failed to update password:', error);
    return NextResponse.json({ message: 'Failed to update password' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    const { passwordsCollection } = await connectToDatabase();
    const result = await passwordsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Password not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Password deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete password:', error);
    return NextResponse.json({ message: 'Failed to delete password' }, { status: 500 });
  }
}
