
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import type { PasswordEntry, Group, CategoryShare } from '@/types';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

if (!MONGODB_DB_NAME) {
  throw new Error(
    'Please define the MONGODB_DB_NAME environment variable inside .env.local'
  );
}

interface MongoDBCache {
  client: MongoClient | null;
  db: Db | null;
}

declare global {
  var mongodb: MongoDBCache | undefined;
}


let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

if (process.env.NODE_ENV === 'development') {
  if (!global.mongodb) {
    global.mongodb = { client: null, db: null };
  }
  cachedClient = global.mongodb.client;
  cachedDb = global.mongodb.db;
}

export async function connectToDatabase(): Promise<{
  client: MongoClient,
  db: Db,
  passwordsCollection: Collection<Omit<PasswordEntry, 'id' | 'sharedVia'>>, // sharedVia is client-only
  groupsCollection: Collection<Omit<Group, 'id'>>,
  categorySharesCollection: Collection<Omit<CategoryShare, 'id'>>
}> {
  if (cachedClient && cachedDb) {
    return {
      client: cachedClient,
      db: cachedDb,
      passwordsCollection: cachedDb.collection<Omit<PasswordEntry, 'id' | 'sharedVia'>>('passwords'),
      groupsCollection: cachedDb.collection<Omit<Group, 'id'>>('groups'),
      categorySharesCollection: cachedDb.collection<Omit<CategoryShare, 'id'>>('categoryShares')
    };
  }

  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

  // Create indexes if they don't exist
  // Index for categoryShares to ensure uniqueness of owner-category-group combination
  // and to optimize lookups.
  try {
    await db.collection('categoryShares').createIndex(
        { ownerId: 1, categoryName: 1, groupId: 1 },
        { unique: true }
    );
    // Index for fetching shares by group
    await db.collection('categoryShares').createIndex({ groupId: 1 });
    // Index for fetching shares by owner
    await db.collection('categoryShares').createIndex({ ownerId: 1, categoryName: 1 });

    // Index for passwords for faster lookups by owner and category (critical for shared categories)
    await db.collection('passwords').createIndex({ ownerId: 1, category: 1 });
    await db.collection('passwords').createIndex({ ownerId: 1 }); // For general user passwords

    // Indexes for groups
    await db.collection('groups').createIndex({ ownerId: 1 });
    await db.collection('groups').createIndex({ "members.userId": 1 });

  } catch (indexError) {
    console.warn("MongoDB index creation warning/error (might be okay if indexes already exist):", indexError);
  }


  if (process.env.NODE_ENV === 'development') {
    global.mongodb!.client = client;
    global.mongodb!.db = db;
  } else {
    cachedClient = client;
    cachedDb = db;
  }

  return {
    client,
    db,
    passwordsCollection: db.collection<Omit<PasswordEntry, 'id' | 'sharedVia'>>('passwords'),
    groupsCollection: db.collection<Omit<Group, 'id'>>('groups'),
    categorySharesCollection: db.collection<Omit<CategoryShare, 'id'>>('categoryShares')
  };
}

export const fromMongo = <T extends { _id: ObjectId }>(doc: T): Omit<T, '_id'> & { id: string } => {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toHexString() };
};

export const toMongo = <T extends { id: string }>(doc: T): Omit<T, 'id'> & { _id?: ObjectId } => {
  const { id, ...rest } = doc;
  return { ...rest, ...(ObjectId.isValid(id) && { _id: new ObjectId(id) }) };
};

export const toMongoWithoutId = <T extends { id?: string }>(doc: T): Omit<T, 'id'> => {
  const { id, ...rest } = doc;
  return rest;
};
