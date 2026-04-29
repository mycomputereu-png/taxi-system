import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taxi_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function checkDriver() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT id, username, name, passwordHash FROM drivers WHERE username = ?',
      ['Ayan']
    );
    connection.release();
    
    if (rows.length > 0) {
      console.log('Driver found:', rows[0]);
      console.log('Password hash length:', rows[0].passwordHash?.length);
      console.log('Password hash:', rows[0].passwordHash);
    } else {
      console.log('No driver found with username: Ayan');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDriver();
