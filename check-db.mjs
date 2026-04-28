import mysql from 'mysql2/promise';

async function main() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'taxi_system',
    });

    // Check if dispatchers table exists
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dispatchers'",
      [process.env.DB_NAME || 'taxi_system']
    );
    
    console.log('Dispatchers table exists:', tables.length > 0);
    
    if (tables.length > 0) {
      // Check existing dispatchers
      const [dispatchers] = await connection.execute('SELECT * FROM dispatchers');
      console.log('Existing dispatchers:', dispatchers);
    }
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
