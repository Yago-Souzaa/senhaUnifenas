
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST() { // Using POST for clear all to avoid accidental CSRF via GET
  try {
    const { passwordsCollection } = await connectToDatabase();
    await passwordsCollection.deleteMany({});
    return NextResponse.json({ message: 'All passwords cleared successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to clear passwords:', error);
    return NextResponse.json({ message: 'Failed to clear passwords' }, { status: 500 });
  }
}
