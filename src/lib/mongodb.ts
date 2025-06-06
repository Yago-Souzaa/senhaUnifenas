
import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import type { PasswordEntry, Group } from '@/types'; // Added Group

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
  passwordsCollection: Collection<Omit<PasswordEntry, 'id'>>,
  groupsCollection: Collection<Omit<Group, 'id'>> // Added groupsCollection
}> {
  if (cachedClient && cachedDb) {
    return { 
      client: cachedClient, 
      db: cachedDb, 
      passwordsCollection: cachedDb.collection<Omit<PasswordEntry, 'id'>>('passwords'),
      groupsCollection: cachedDb.collection<Omit<Group, 'id'>>('groups') // Initialize groupsCollection
    };
  }

  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

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
    passwordsCollection: db.collection<Omit<PasswordEntry, 'id'>>('passwords'),
    groupsCollection: db.collection<Omit<Group, 'id'>>('groups') // Initialize groupsCollection
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
