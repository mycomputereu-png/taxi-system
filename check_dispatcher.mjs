import { getDb } from './server/db.ts';

async function main() {
  const db = await getDb();
  if (db) {
    const { dispatchers } = await import('./drizzle/schema.ts');
    const result = await db.select().from(dispatchers);
    console.log('Existing dispatchers:', result);
  }
}

main().catch(console.error);
