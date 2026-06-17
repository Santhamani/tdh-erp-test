import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';

async function setupDatabase() {
  let connection;
  
  try {
    // Step 1: Connect to MySQL (without database)
    console.log('Connecting to MySQL...');
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'root'
    });
    console.log('✓ Connected to MySQL');

    // Step 2: Create database
    console.log('Creating database tdh_erp...');
    await connection.execute('CREATE DATABASE IF NOT EXISTS tdh_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✓ Database created');

    // Step 3: Select database
    await connection.execute('USE tdh_erp');
    console.log('✓ Database selected');

    // Step 4: Read and execute SQL schema
    const sqlPath = path.resolve(process.cwd(), 'database', 'setup.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      try {
        await connection.execute(statements[i]);
        console.log(`✓ Statement ${i + 1}/${statements.length}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  (skipped - already exists)`);
        } else {
          throw err;
        }
      }
    }

    // Step 5: Verify tables
    console.log('\nVerifying tables...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`✓ Created ${tables.length} tables:`);
    tables.forEach((row, idx) => {
      const tableName = Object.values(row)[0];
      console.log(`  ${idx + 1}. ${tableName}`);
    });

    console.log('\n✓✓✓ Database setup complete! ✓✓✓\n');

  } catch (error) {
    console.error('✗ Setup failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();
