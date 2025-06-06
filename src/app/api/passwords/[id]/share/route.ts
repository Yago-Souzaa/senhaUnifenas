
// This file is intentionally left empty as individual sharing is being removed.
// The file is kept to prevent 404s if old client versions try to access it,
// but it will not perform any operations.
// Consider fully deleting this file and its corresponding [sharedUserId] route file if appropriate.

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: 'Individual password sharing is deprecated. Please use group sharing.' }, { status: 410 }); // 410 Gone
}
