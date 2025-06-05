
import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return NextResponse.json({ message: 'User ID not provided in headers' }, { status: 401 });
  }

  try {
    const { passwordsCollection } = await connectToDatabase();
    // Deletar apenas as senhas do usuário especificado
    await passwordsCollection.deleteMany({ userId: userId });
    return NextResponse.json({ message: 'All passwords for this user cleared successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to clear passwords:', error);
    return NextResponse.json({ message: 'Failed to clear passwords' }, { status: 500 });
  }
}
