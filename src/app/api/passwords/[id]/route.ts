
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase, fromMongo } from '@/lib/mongodb';
import type { PasswordEntry } from '@/types';
import { ObjectId } from 'mongodb';

interface Params {
  id: string;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    const { passwordsCollection } = await connectToDatabase();
    // Filtrar por _id e userId
    const passwordDoc = await passwordsCollection.findOne({ _id: new ObjectId(id), userId: userId });

    if (!passwordDoc) {
      return NextResponse.json({ message: 'Password not found or not owned by user' }, { status: 404 });
    }
    return NextResponse.json(fromMongo(passwordDoc as any), { status: 200 });
  } catch (error) {
    console.error('Failed to fetch password:', error);
    return NextResponse.json({ message: 'Failed to fetch password' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    const updatedEntryData = (await request.json()) as Omit<PasswordEntry, 'id' | 'userId'>; // userId será setado abaixo
    
    const dataToUpdate = { ...updatedEntryData, userId: userId }; // Garantir que o userId seja o do usuário logado
     // Remover id do objeto se estiver presente, pois _id não deve estar no $set
    const { id: entryId, ...setOperationData } = dataToUpdate;


    const { passwordsCollection } = await connectToDatabase();
    const result = await passwordsCollection.updateOne(
      { _id: new ObjectId(id), userId: userId }, // Garantir que o usuário só atualize suas próprias senhas
      { $set: setOperationData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Password not found or not owned by user' }, { status: 404 });
    }
    // Retorna o dado atualizado com o ID original
    return NextResponse.json({ ...setOperationData, id }, { status: 200 });
  } catch (error) {
    console.error('Failed to update password:', error);
    return NextResponse.json({ message: 'Failed to update password' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
    }
    const { passwordsCollection } = await connectToDatabase();
    // Garantir que o usuário só delete suas próprias senhas
    const result = await passwordsCollection.deleteOne({ _id: new ObjectId(id), userId: userId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: 'Password not found or not owned by user' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Password deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete password:', error);
    return NextResponse.json({ message: 'Failed to delete password' }, { status: 500 });
  }
}
