import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { exec, query } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const toApiRecord = (row) => ({
  id: String(row.firestore_doc_id || row.id),
  timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  userId: row.created_by_user_id,
  userName: row.created_by_user_name,
  action: row.action || 'RECORDED',
  deleted: !!row.deleted,
  details: typeof row.details_json === 'string' ? JSON.parse(row.details_json) : row.details_json || {}
});

app.get('/health', async (_req, res) => {
  await query('SELECT 1');
  res.json({ ok: true });
});

app.post('/auth/login', async (req, res) => {
  const { email, pin } = req.body || {};
  if (!email || !pin) return res.status(400).json({ message: 'email and pin are required' });

  const rows = await query('SELECT * FROM users WHERE email = ? AND status = ? LIMIT 1', [email, 'ACTIVE']);
  const user = rows[0];
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const isPinValid = (user.pin_hash || '').startsWith('$2')
    ? await bcrypt.compare(String(pin), user.pin_hash)
    : String(user.pin_hash) === String(pin);

  if (!isPinValid) return res.status(401).json({ message: 'Invalid credentials' });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      status: user.status,
      pin: String(pin)
    }
  });
});

app.get('/users', async (_req, res) => {
  const rows = await query('SELECT id, name, email, role, phone, address, status FROM users ORDER BY created_at DESC');
  res.json(rows);
});

app.post('/users', async (req, res) => {
  const { name, email, role } = req.body || {};
  if (!name || !email || !role) return res.status(400).json({ message: 'name, email, role are required' });

  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const pinHash = await bcrypt.hash(pin, 10);
  const passwordHash = await bcrypt.hash('password', 10);
  const id = crypto.randomUUID();

  await exec(
    `INSERT INTO users (id, name, email, role, pin_hash, password_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [id, name, email, role, pinHash, passwordHash]
  );

  res.status(201).json({ id, pin, password: 'password' });
});

app.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, phone, address, status } = req.body || {};

  await exec(
    `UPDATE users
       SET name = COALESCE(?, name),
           email = COALESCE(?, email),
           role = COALESCE(?, role),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           status = COALESCE(?, status)
     WHERE id = ?`,
    [name ?? null, email ?? null, role ?? null, phone ?? null, address ?? null, status ?? null, id]
  );

  res.json({ ok: true });
});

app.delete('/users/:id', async (req, res) => {
  await exec('UPDATE users SET status = ? WHERE id = ?', ['INACTIVE', req.params.id]);
  res.json({ ok: true });
});

async function listStage(table, req, res) {
  const includeDeleted = req.query.includeDeleted === '1';
  const rows = await query(
    `SELECT * FROM ${table} ${includeDeleted ? '' : 'WHERE deleted = 0'} ORDER BY created_at DESC LIMIT 2000`
  );
  res.json(rows.map(toApiRecord));
}

async function softDeleteStage(table, req, res) {
  await exec(`UPDATE ${table} SET deleted = 1 WHERE firestore_doc_id = ? OR id = ?`, [req.params.id, req.params.id]);
  res.json({ ok: true });
}

app.get('/arrival-records', (req, res) => listStage('arrival_records', req, res));
app.get('/weighing-records', (req, res) => listStage('weighing_records', req, res));
app.get('/quality-check-records', (req, res) => listStage('quality_check_records', req, res));
app.get('/dispatch-records', (req, res) => listStage('dispatch_records', req, res));
app.get('/sales-records', (req, res) => listStage('sales_records', req, res));

app.patch('/arrival-records/:id/soft-delete', (req, res) => softDeleteStage('arrival_records', req, res));
app.patch('/weighing-records/:id/soft-delete', (req, res) => softDeleteStage('weighing_records', req, res));
app.patch('/quality-check-records/:id/soft-delete', (req, res) => softDeleteStage('quality_check_records', req, res));
app.patch('/dispatch-records/:id/soft-delete', (req, res) => softDeleteStage('dispatch_records', req, res));
app.patch('/sales-records/:id/soft-delete', (req, res) => softDeleteStage('sales_records', req, res));

app.get('/in-mode-vehicles', async (_req, res) => {
  const rows = await query(
    `SELECT DISTINCT vehicle_number
       FROM arrival_records
      WHERE gate_mode = 'in' AND deleted = 0 AND vehicle_number IS NOT NULL
      ORDER BY vehicle_number ASC`
  );
  res.json(rows.map((r) => r.vehicle_number));
});

app.post('/stage-records', async (req, res) => {
  const { stageId, data, currentUser } = req.body || {};
  if (!stageId || !data) return res.status(400).json({ message: 'stageId and data are required' });

  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (stageId === 'arrival') {
    await exec(
      `INSERT INTO arrival_records (
         firestore_doc_id, serial_number, gate_mode, vehicle_number, driver_name, phone_number,
         from_location, to_location, party, broker_name, broker_phone, quantity, bags, item,
         loading_unloading, note, deleted, created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        data.serial_number || null,
        String(data.gate_mode || 'in').toLowerCase() === 'out' ? 'out' : 'in',
        data.vehicle_number || 'UNKNOWN',
        data.driver_name || null,
        data.phone_number || null,
        data.from_location || null,
        data.to_location || null,
        data.party || null,
        data.broker_name || null,
        data.broker_phone || null,
        data.quantity || null,
        data.bags || null,
        data.item || null,
        data.loading_unloading || null,
        data.note || null,
        currentUser?.id || null,
        currentUser?.name || null,
        createdAt,
        JSON.stringify(data)
      ]
    );
  } else if (stageId === 'weighing') {
    await exec(
      `INSERT INTO weighing_records (
         firestore_doc_id, vehicle_number, ticket_no, gross_weight, tare_weight, sample_collector,
         note, deleted, created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        data.vehicle_number || 'UNKNOWN',
        data.ticket_no || null,
        data.gross_weight || data.in_weight || null,
        data.tare_weight || data.out_weight || null,
        data.sample_collector || null,
        data.note || null,
        currentUser?.id || null,
        currentUser?.name || null,
        createdAt,
        JSON.stringify(data)
      ]
    );
  } else if (stageId === 'quality-check') {
    await exec(
      `INSERT INTO quality_check_records (
         firestore_doc_id, vehicle_number, transaction_id, size_analysis_7, size_analysis_5,
         size_analysis_4, small_mud_percent, big_mud_stones_percent, damage_1,
         physical_damage_2, moisture_content_percent, upload_report, note, deleted,
         created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        data.vehicle_number || 'UNKNOWN',
        data.transaction_id || null,
        data.size_analysis_7 || null,
        data.size_analysis_5 || null,
        data.size_analysis_4 || null,
        data.small_mud_percent || null,
        data.big_mud_stones_percent || null,
        data.damage_1 || null,
        data.physical_damage_2 || null,
        data.moisture_content_percent || null,
        data.upload_report || null,
        data.note || null,
        currentUser?.id || null,
        currentUser?.name || null,
        createdAt,
        JSON.stringify(data)
      ]
    );
  } else if (stageId === 'dispatch') {
    const dispatchId = crypto.randomUUID();
    await exec(
      `INSERT INTO dispatch_records (
         firestore_doc_id, vehicle_number, driver_name, destination, client_name, ticket_number,
         gross_weight, tare_weight, note, deleted, created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        dispatchId,
        data.vehicle_number || 'UNKNOWN',
        data.driver_name || null,
        data.destination || null,
        data.client_name || null,
        data.ticket_number || null,
        data.gross_weight || null,
        data.tare_weight || null,
        data.note || null,
        currentUser?.id || null,
        currentUser?.name || null,
        createdAt,
        JSON.stringify(data)
      ]
    );

    const records = await query('SELECT id FROM dispatch_records WHERE firestore_doc_id = ? LIMIT 1', [dispatchId]);
    const dispatchRecordId = records[0]?.id;
    if (dispatchRecordId) {
      for (let i = 1; i <= 10; i += 1) {
        const itemName = data[`item_${i}_name`];
        const itemQuantity = data[`item_${i}_quantity`];
        const itemWeight = data[`item_${i}_weight`];
        const itemType = data[`item_${i}_type`];
        const itemTotal = data[`item_${i}_total`];

        if (!itemName && !itemQuantity && !itemWeight && !itemTotal) continue;

        await exec(
          `INSERT INTO dispatch_items (
             dispatch_record_id, item_order, item_name, item_type, item_quantity, item_weight, item_total
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [dispatchRecordId, i, itemName || null, itemType || null, itemQuantity || null, itemWeight || null, itemTotal || null]
        );
      }
    }
  } else if (stageId === 'sales') {
    await exec(
      `INSERT INTO sales_records (
         firestore_doc_id, file_name, sales_timestamp, note, deleted, created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        data.file_name || data.fileName || 'Sales Upload',
        data.sales_timestamp || new Date().toISOString().slice(0, 19).replace('T', ' '),
        data.note || null,
        currentUser?.id || null,
        currentUser?.name || null,
        createdAt,
        JSON.stringify(data)
      ]
    );
  } else {
    await exec(
      `INSERT INTO stage_records (
         firestore_doc_id, stage_id, vehicle_number, deleted, created_by_user_id, created_by_user_name, created_at, details_json
       ) VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        stageId,
        data.vehicle_number || null,
        currentUser?.id || null,
        currentUser?.name || null,
        createdAt,
        JSON.stringify(data)
      ]
    );
  }

  res.status(201).json({ ok: true });
});

const port = Number(process.env.PORT || process.env.API_PORT || 4000);
const host = process.env.IP || process.env.API_HOST || '127.0.0.1';

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
