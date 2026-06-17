import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'tdh_erp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function seedTestData() {
  const conn = await pool.getConnection();

  try {
    console.log('Clearing existing test data...');
    await conn.execute('DELETE FROM dispatch_items');
    await conn.execute('DELETE FROM dispatch_records');
    await conn.execute('DELETE FROM quality_check_records');
    await conn.execute('DELETE FROM weighing_records');
    await conn.execute('DELETE FROM arrival_records');
    await conn.execute('DELETE FROM users');

    console.log('Seeding users...');
    await conn.execute(
      `INSERT INTO users (id, name, email, role, pin_hash, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      ['user-admin-1', 'Admin User', 'admin@tdh.local', 'ADMIN', '1234', 'hash_password']
    );
    await conn.execute(
      `INSERT INTO users (id, name, email, role, pin_hash, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      ['user-manager-1', 'Manager User', 'manager@tdh.local', 'MANAGER', '5678', 'hash_password']
    );
    await conn.execute(
      `INSERT INTO users (id, name, email, role, pin_hash, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      ['user-gate-1', 'Gate Operator', 'gate@tdh.local', 'GATE_ENTRY_OPERATOR', '9012', 'hash_password']
    );

    console.log('Seeding arrival records...');
    await conn.execute(
      `INSERT INTO arrival_records (
         firestore_doc_id, serial_number, gate_mode, vehicle_number, driver_name, phone_number,
         from_location, to_location, party, broker_name, broker_phone, quantity, bags, item,
         created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'arr-001',
        'SN-001',
        'in',
        'AP07BM5555',
        'Raj Kumar',
        '9876543210',
        'Hyderabad',
        'Storage A',
        'ABC Traders',
        'Broker X',
        '8765432109',
        100.50,
        50,
        'Dal',
        'user-gate-1',
        'Gate Operator',
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        JSON.stringify({
          vehicle_number: 'AP07BM5555',
          driver_name: 'Raj Kumar',
          phone_number: '9876543210',
          from_location: 'Hyderabad',
          to_location: 'Storage A',
          party: 'ABC Traders',
          broker_name: 'Broker X',
          quantity: 100.5,
          bags: 50,
          item: 'Dal'
        })
      ]
    );

    await conn.execute(
      `INSERT INTO arrival_records (
         firestore_doc_id, serial_number, gate_mode, vehicle_number, driver_name, phone_number,
         from_location, to_location, party, broker_name, broker_phone, quantity, bags, item,
         created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'arr-002',
        'SN-002',
        'out',
        'KA02CD6666',
        'Mohan Singh',
        '9123456789',
        'Storage A',
        'Delhi',
        'XYZ Exports',
        'Broker Y',
        '8123456789',
        75.25,
        30,
        'Dal',
        'user-gate-1',
        'Gate Operator',
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        JSON.stringify({
          vehicle_number: 'KA02CD6666',
          driver_name: 'Mohan Singh',
          from_location: 'Storage A',
          to_location: 'Delhi',
          quantity: 75.25,
          bags: 30
        })
      ]
    );

    console.log('Seeding weighing records...');
    await conn.execute(
      `INSERT INTO weighing_records (
         firestore_doc_id, vehicle_number, ticket_no, gross_weight, tare_weight, sample_collector,
         created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'weigh-001',
        'AP07BM5555',
        'TKT-20260617-001',
        500.0,
        400.0,
        'Lab Tech 1',
        'user-gate-1',
        'Gate Operator',
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        JSON.stringify({
          vehicle_number: 'AP07BM5555',
          ticket_no: 'TKT-20260617-001',
          gross_weight: 500.0,
          tare_weight: 400.0,
          sample_collector: 'Lab Tech 1'
        })
      ]
    );

    console.log('Seeding quality check records...');
    await conn.execute(
      `INSERT INTO quality_check_records (
         firestore_doc_id, vehicle_number, transaction_id, size_analysis_7, size_analysis_5,
         size_analysis_4, small_mud_percent, big_mud_stones_percent, damage_1,
         physical_damage_2, moisture_content_percent,
         created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'qc-001',
        'AP07BM5555',
        'TXN-QC-001',
        2.5,
        5.0,
        8.5,
        1.2,
        0.8,
        0.5,
        0.3,
        12.5,
        'user-gate-1',
        'Gate Operator',
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        JSON.stringify({
          vehicle_number: 'AP07BM5555',
          transaction_id: 'TXN-QC-001',
          size_analysis_7: 2.5,
          size_analysis_5: 5.0,
          size_analysis_4: 8.5,
          small_mud_percent: 1.2,
          big_mud_stones_percent: 0.8,
          damage_1: 0.5,
          physical_damage_2: 0.3,
          moisture_content_percent: 12.5
        })
      ]
    );

    console.log('Seeding dispatch records...');
    const [dispatchResult] = await conn.execute(
      `INSERT INTO dispatch_records (
         firestore_doc_id, vehicle_number, driver_name, destination, client_name, ticket_number,
         gross_weight, tare_weight,
         created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'disp-001',
        'AP07BM5555',
        'Raj Kumar',
        'Mumbai',
        'Reliance Pvt Ltd',
        'DISP-20260617-001',
        500.0,
        400.0,
        'user-gate-1',
        'Gate Operator',
        new Date().toISOString().slice(0, 19).replace('T', ' '),
        JSON.stringify({
          vehicle_number: 'AP07BM5555',
          driver_name: 'Raj Kumar',
          destination: 'Mumbai',
          client_name: 'Reliance Pvt Ltd',
          ticket_number: 'DISP-20260617-001'
        })
      ]
    );

    const dispatchId = dispatchResult.insertId;
    console.log('Seeding dispatch items...');
    await conn.execute(
      `INSERT INTO dispatch_items (dispatch_record_id, item_order, item_name, item_type, item_quantity, item_weight, item_total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dispatchId, 1, 'Premium Dal', 'Type A', 100.5, 500.0, 50250.00]
    );
    await conn.execute(
      `INSERT INTO dispatch_items (dispatch_record_id, item_order, item_name, item_type, item_quantity, item_weight, item_total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dispatchId, 2, 'Standard Dal', 'Type B', 50.0, 250.0, 12500.00]
    );

    console.log('✓ Test data seeded successfully!');
    console.log('\nSummary:');
    console.log('- Users: 3');
    console.log('- Arrival records: 2 (1 IN, 1 OUT)');
    console.log('- Weighing records: 1');
    console.log('- Quality check records: 1');
    console.log('- Dispatch records: 1 (with 2 items)');

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await conn.end();
    await pool.end();
  }
}

seedTestData();
