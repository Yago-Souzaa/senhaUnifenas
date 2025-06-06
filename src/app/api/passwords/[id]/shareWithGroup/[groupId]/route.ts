
// This entire route file is now DEPRECATED and will be removed.
// Sharing is handled by category sharing: /api/categories/share and /api/categories/unshare

import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: 'This endpoint is deprecated. Use category sharing instead.' }, { status: 410 }); // 410 Gone
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ message: 'This endpoint is deprecated. Use category sharing instead.' }, { status: 410 }); // 410 Gone
}
