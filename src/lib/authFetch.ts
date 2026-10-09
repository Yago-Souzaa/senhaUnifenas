'use client';

import { auth } from '@/lib/firebase';

// fetch that sends the Firebase ID token; the API derives the user from it, never from client-supplied ids.
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  return fetch(input, { ...init, headers });
}
