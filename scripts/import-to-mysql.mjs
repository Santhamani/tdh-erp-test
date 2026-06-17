import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

const EXPORT_DIR = process.env.FIRESTORE_EXPORT_DIR || path.resolve(process.cwd(), 'migration', 'firestore-export');

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'tdh_erp'
};

async function readCollectionFile(fileName) {
  const content = await fs.readFile(path.join(EXPORT_DIR, fileName), 'utf8');
  return JSON.parse(content);
}

function toSqlDateTime(value) {
  if (!value) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function parseNum(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}



async function importUsers(conn, payload) {
  for (const row of payload.docs) {
    const d = row.data || {};
    await conn.execute(
      `INSERT INTO users (id, name, email, role, pin_hash, password_hash, phone, address, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), email = VALUES(email), role = VALUES(role), phone = VALUES(phone),
         address = VALUES(address), status = VALUES(status), updated_at = VALUES(updated_at)`,
      [
        row.id,
        d.name || 'Unknown',
        d.email || `${row.id}@placeholder.local`,
        d.role || 'MANAGER',
        d.pin || d.pin_hash || 'MIGRATED_PIN_HASH_REQUIRED',
        d.password_hash || 'MIGRATED_PASSWORD_HASH_REQUIRED',
        d.phone || null,
        d.address || null,
        d.status || 'ACTIVE',
        toSqlDateTime(d.createdAt || d.created_at || new Date().toISOString()),
        toSqlDateTime(new Date().toISOString())
      ]
    );
  }
}

async function importArrival(conn, payload) {
  for (const row of payload.docs) {
    const data = row.data || {};
    const details = data.details || data;

    await conn.execute(
      `INSERT INTO arrival_records (
         firestore_doc_id, serial_number, gate_mode, vehicle_number, driver_name, phone_number,
         from_location, to_location, party, broker_name, broker_phone, quantity, bags, item,
         loading_unloading, note, deleted, created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         vehicle_number = VALUES(vehicle_number), deleted = VALUES(deleted), details_json = VALUES(details_json)`,
      [
        row.id,
        details.serial_number || null,
        String(details.gate_mode || 'in').toLowerCase() === 'out' ? 'out' : 'in',
        details.vehicle_number || 'UNKNOWN',
        details.driver_name || null,
        details.phone_number || null,
        details.from_location || null,
        details.to_location || null,
        details.party || null,
        details.broker_name || null,
        details.broker_phone || null,
        parseNum(details.quantity),
        parseNum(details.bags),
        details.item || null,
        details.loading_unloading || null,
        details.note || null,
        data.deleted === true ? 1 : 0,
        data.userId || null,
        data.userName || null,
        toSqlDateTime(data.timestamp || details.timestamp || new Date().toISOString()),
        JSON.stringify(details)
      ]
    );
  }
}

async function importWeighing(conn, payload) {
  for (const row of payload.docs) {
    const data = row.data || {};
    const details = data.details || data;

    await conn.execute(
      `INSERT INTO weighing_records (
         firestore_doc_id, vehicle_number, ticket_no, gross_weight, tare_weight, sample_collector,
         note, deleted, created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         vehicle_number = VALUES(vehicle_number), deleted = VALUES(deleted), details_json = VALUES(details_json)`,
      [
        row.id,
        details.vehicle_number || 'UNKNOWN',
        details.ticket_no || null,
        parseNum(details.gross_weight || details.in_weight),
        parseNum(details.tare_weight || details.out_weight),
        details.sample_collector || null,
        details.note || null,
        data.deleted === true ? 1 : 0,
        data.userId || null,
        data.userName || null,
        toSqlDateTime(data.timestamp || new Date().toISOString()),
        JSON.stringify(details)
      ]
    );
  }
}

async function importQuality(conn, payload) {
  for (const row of payload.docs) {
    const data = row.data || {};
    const details = data.details || data;

    await conn.execute(
      `INSERT INTO quality_check_records (
         firestore_doc_id, vehicle_number, transaction_id, size_analysis_7, size_analysis_5,
         size_analysis_4, small_mud_percent, big_mud_stones_percent, damage_1,
         physical_damage_2, moisture_content_percent, upload_report, note, deleted,
         created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         vehicle_number = VALUES(vehicle_number), deleted = VALUES(deleted), details_json = VALUES(details_json)`,
      [
        row.id,
        details.vehicle_number || 'UNKNOWN',
        details.transaction_id || null,
        parseNum(details.size_analysis_7),
        parseNum(details.size_analysis_5),
        parseNum(details.size_analysis_4),
        parseNum(details.small_mud_percent),
        parseNum(details.big_mud_stones_percent),
        parseNum(details.damage_1),
        parseNum(details.physical_damage_2),
        parseNum(details.moisture_content_percent),
        details.upload_report || null,
        details.note || null,
        data.deleted === true ? 1 : 0,
        data.userId || null,
        data.userName || null,
        toSqlDateTime(data.timestamp || new Date().toISOString()),
        JSON.stringify(details)
      ]
    );
  }
}

async function importDispatch(conn, payload) {
  for (const row of payload.docs) {
    const data = row.data || {};
    const details = data.details || data;

    const [result] = await conn.execute(
      `INSERT INTO dispatch_records (
         firestore_doc_id, vehicle_number, driver_name, destination, client_name, ticket_number,
         gross_weight, tare_weight, note, deleted, created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id), vehicle_number = VALUES(vehicle_number),
         deleted = VALUES(deleted), details_json = VALUES(details_json)`,
      [
        row.id,
        details.vehicle_number || 'UNKNOWN',
        details.driver_name || null,
        details.destination || null,
        details.client_name || null,
        details.ticket_number || null,
        parseNum(details.gross_weight),
        parseNum(details.tare_weight),
        details.note || null,
        data.deleted === true ? 1 : 0,
        data.userId || null,
        data.userName || null,
        toSqlDateTime(data.timestamp || new Date().toISOString()),
        JSON.stringify(details)
      ]
    );

    const dispatchRecordId = result.insertId;
    await conn.execute('DELETE FROM dispatch_items WHERE dispatch_record_id = ?', [dispatchRecordId]);

    for (let i = 1; i <= 10; i += 1) {
      const itemName = details[`item_${i}_name`];
      const itemQty = parseNum(details[`item_${i}_quantity`]);
      const itemWeight = parseNum(details[`item_${i}_weight`]);
      const itemType = details[`item_${i}_type`] || null;
      const itemTotal = parseNum(details[`item_${i}_total`]);

      if (!itemName && itemQty === null && itemWeight === null && itemTotal === null) continue;

      await conn.execute(
        `INSERT INTO dispatch_items (
           dispatch_record_id, item_order, item_name, item_type, item_quantity, item_weight, item_total
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dispatchRecordId, i, itemName || null, itemType, itemQty, itemWeight, itemTotal]
      );
    }
  }
}

async function main() {
  const conn = await mysql.createConnection(MYSQL_CONFIG);

  try {
    const users = await readCollectionFile('users.json').catch(() => null);
    const arrival = await readCollectionFile('arrival_records.json').catch(() => null);
    const weighing = await readCollectionFile('weighing_records.json').catch(() => null);
    const quality = await readCollectionFile('quality-check_records.json').catch(() => null);
    const dispatch = await readCollectionFile('dispatch_records.json').catch(() => null);

    if (users) {
      await importUsers(conn, users);
      console.log(`Imported users: ${users.count}`);
    }

    if (arrival) {
      await importArrival(conn, arrival);
      console.log(`Imported arrival_records: ${arrival.count}`);
    }

    if (weighing) {
      await importWeighing(conn, weighing);
      console.log(`Imported weighing_records: ${weighing.count}`);
    }

    if (quality) {
      await importQuality(conn, quality);
      console.log(`Imported quality-check_records: ${quality.count}`);
    }

    if (dispatch) {
      await importDispatch(conn, dispatch);
      console.log(`Imported dispatch_records: ${dispatch.count}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
