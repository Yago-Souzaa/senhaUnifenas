
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { PasswordEntry } from '@/types';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { passwordsCollection } = await connectToDatabase();
    // Filtrar senhas pelo userId
    const passwordsFromDb = await passwordsCollection.find({ userId: userId }).toArray();
    const passwords = passwordsFromDb.map(doc => fromMongo(doc as any));
    return NextResponse.json(passwords, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch passwords:', error);
    return NextResponse.json({ message: 'Failed to fetch passwords' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const entryData = (await request.json()) as Omit<PasswordEntry, 'id' | 'userId'>;
    // Adicionar userId aos dados da senha
    const entryDataWithUser = { ...entryData, userId: userId };
    
    const { passwordsCollection } = await connectToDatabase();
    const result = await passwordsCollection.insertOne(entryDataWithUser);
    
    if (!result.insertedId) {
        throw new Error('Failed to insert password, no ID returned');
    }

    const newPassword = {
      ...entryDataWithUser,
      id: result.insertedId.toHexString(), // Usar o novo ID do MongoDB
    } as PasswordEntry;

    return NextResponse.json(newPassword, { status: 201 });
  } catch (error) {
    console.error('Failed to add password:', error);
    return NextResponse.json({ message: 'Failed to add password', error: (error as Error).message }, { status: 500 });
  }
}
