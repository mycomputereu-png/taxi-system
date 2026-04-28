import { createConnection } from 'mysql2/promise';
import fs from 'fs';

async function main() {
  try {
    const connection = await createConnection(process.env.DATABASE_URL);
    
    // Read SQL file
    const sql = fs.readFileSync('./create-all-tables.sql', 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      await connection.execute(statement);
      console.log('✓ Done');
    }
    
    console.log('\n✓ All tables created successfully');
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
