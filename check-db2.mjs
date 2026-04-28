import { createConnection } from 'mysql2/promise';

async function main() {
  try {
    const connection = await createConnection(process.env.DATABASE_URL);
    
    // Check if dispatchers table exists
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dispatchers'"
    );
    
    console.log('Dispatchers table exists:', tables.length > 0);
    
    if (tables.length > 0) {
      // Check existing dispatchers
      const [dispatchers] = await connection.execute('SELECT * FROM dispatchers');
      console.log('Existing dispatchers:', dispatchers);
    } else {
      console.log('Table does not exist');
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
