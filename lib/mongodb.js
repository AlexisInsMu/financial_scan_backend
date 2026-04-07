import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI no está definida en las variables de entorno.');
}
if (!process.env.DB_NAME) {
  throw new Error('DB_NAME no está definida en las variables de entorno.');
}


const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

// Helper para obtener la DB directamente
export async function getDb() {
  const client = await clientPromise;
  return client.db(dbName);
}