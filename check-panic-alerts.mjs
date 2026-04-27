import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/')[3]?.split('?')[0] || 'taxi_system',
});

try {
  // Check if table exists
  const [tables] = await connection.execute(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'panic_alerts'"
  );
  
  if (tables.length === 0) {
    console.log('panic_alerts table does not exist, creating...');
    
    // Create the table
    await connection.execute(`
      CREATE TABLE panic_alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driverId INT NOT NULL,
        rideId INT,
        status ENUM('active', 'acknowledged', 'resolved', 'cancelled') DEFAULT 'active' NOT NULL,
        driverLat DECIMAL(10, 7) NOT NULL,
        driverLng DECIMAL(10, 7) NOT NULL,
        driverAddress TEXT,
        dispatcherNote TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        acknowledgedAt TIMESTAMP NULL,
        resolvedAt TIMESTAMP NULL,
        INDEX idx_status (status),
        INDEX idx_createdAt (createdAt)
      )
    `);
    
    console.log('✅ panic_alerts table created successfully');
  } else {
    console.log('✅ panic_alerts table already exists');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await connection.end();
}
