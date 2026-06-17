import mysql from 'mysql2/promise';

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'root'
    });

    console.log('✓ MySQL connection successful!');

    // Create database
    await connection.execute('CREATE DATABASE IF NOT EXISTS tdh_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✓ Database tdh_erp created/verified');

    await connection.end();
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
