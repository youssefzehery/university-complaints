const express = require('express');
const { getDB, getNextComplaintNumber } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* ══════════════════════════════════════════
   PUBLIC — no auth required
══════════════════════════════════════════ */

/* ─── POST /api/complaints  (student submits) ─── */
router.post('/', (req, res) => {
  const {
    student_name,
    student_code,
    student_mobile,
    student_national_id,
    complaint_type,
    subject,
    content,
  } = req.body;

  // Validate required fields
  if (!student_name || !student_code || !student_mobile || !subject || !content) {
    return res.status(400).json({ error: 'يرجى ملء جميع الحقول المطلوبة' });
  }
  if (content.trim().length < 10) {
    return res.status(400).json({ error: 'يرجى كتابة تفاصيل الشكوى (10 أحرف على الأقل)' });
  }
  if (!/^01[0-9]{9}$/.test(student_mobile.trim())) {
    return res.status(400).json({ error: 'رقم الموبايل غير صحيح' });
  }
  if (student_national_id && (student_national_id.length !== 14 || !/^\d+$/.test(student_national_id))) {
    return res.status(400).json({ error: 'الرقم القومي يجب أن يكون 14 رقماً' });
  }

  const db = getDB();
  const complaint_number = getNextComplaintNumber();

  const result = db
    .prepare(
      `INSERT INTO complaints
         (complaint_number, student_name, student_code, student_mobile,
          student_national_id, complaint_type, subject, content, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`
    )
    .run(
      complaint_number,
      student_name.trim(),
      student_code.trim(),
      student_mobile.trim(),
      student_national_id ? student_national_id.trim() : null,
      complaint_type || 'general',
      subject.trim(),
      content.trim()
    );

  // Record history
  db.prepare(
    `INSERT INTO complaint_history
       (complaint_id, action, new_status, performed_by, note)
     VALUES (?, 'submitted', 'new', ?, 'تم تقديم الشكوى بنجاح')`
  ).run(result.lastInsertRowid, student_name.trim());

  res.json({
    success: true,
    complaint_number,
    id: result.lastInsertRowid,
    message: 'تم تسجيل شكواك بنجاح',
  });
});

/* ─── GET /api/complaints/track/:number  (student tracks) ─── */
router.get('/track/:number', (req, res) => {
  const db = getDB();
  const num = String(req.params.number).padStart(6, '0');

  const complaint = db
    .prepare(
      `SELECT id, complaint_number, student_name, student_code, complaint_type,
              subject, content, status, admin_response, responded_by,
              submitted_at, updated_at
       FROM complaints WHERE complaint_number = ?`
    )
    .get(num);

  if (!complaint) {
    return res.status(404).json({ error: 'لم يتم العثور على شكوى بهذا الرقم. تأكد من الرقم وحاول مرة أخرى.' });
  }

  res.json(complaint);
});

/* ══════════════════════════════════════════
   PROTECTED — admin auth required
══════════════════════════════════════════ */
router.use(requireAuth);

/* ─── GET /api/complaints  (admin list with filters) ─── */
router.get('/', (req, res) => {
  const db = getDB();
  const { status, student_code, complaint_type, date_from, date_to, search } = req.query;

  let query = `SELECT * FROM complaints WHERE 1=1`;
  const params = [];

  if (status)         { query += ` AND status = ?`;                params.push(status); }
  if (student_code)   { query += ` AND student_code LIKE ?`;       params.push(`%${student_code}%`); }
  if (complaint_type) { query += ` AND complaint_type = ?`;        params.push(complaint_type); }
  if (date_from)      { query += ` AND DATE(submitted_at) >= ?`;   params.push(date_from); }
  if (date_to)        { query += ` AND DATE(submitted_at) <= ?`;   params.push(date_to); }
  if (search) {
    query += ` AND (student_name LIKE ? OR subject LIKE ? OR content LIKE ? OR complaint_number LIKE ? OR student_code LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  query += ` ORDER BY submitted_at DESC`;

  const complaints = db.prepare(query).all(...params);

  // Aggregate stats (always over full table, ignoring filters)
  const stats = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'new'          THEN 1 ELSE 0 END) AS new_count,
         SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) AS under_review_count,
         SUM(CASE WHEN status = 'resolved'     THEN 1 ELSE 0 END) AS resolved_count,
         SUM(CASE WHEN status = 'archived'     THEN 1 ELSE 0 END) AS archived_count
       FROM complaints`
    )
    .get();

  res.json({ complaints, stats });
});

/* ─── GET /api/complaints/:id  (admin detail + history) ─── */
router.get('/:id', (req, res) => {
  const db = getDB();
  const complaint = db.prepare(`SELECT * FROM complaints WHERE id = ?`).get(req.params.id);

  if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة' });

  const history = db
    .prepare(`SELECT * FROM complaint_history WHERE complaint_id = ? ORDER BY performed_at ASC`)
    .all(req.params.id);

  res.json({ ...complaint, history });
});

/* ─── PUT /api/complaints/:id  (admin update status / add response) ─── */
router.put('/:id', (req, res) => {
  const { status, admin_response, note } = req.body;
  const db = getDB();

  const complaint = db.prepare(`SELECT * FROM complaints WHERE id = ?`).get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة' });

  const validStatuses = ['new', 'under_review', 'resolved', 'archived'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }

  const now = new Date().toISOString();
  const setParts = [];
  const values = [];

  if (status) {
    setParts.push('status = ?');
    values.push(status);
  }
  if (admin_response !== undefined && admin_response !== null) {
    setParts.push('admin_response = ?', 'responded_by = ?');
    values.push(admin_response, req.session.user.name);
  }
  setParts.push('updated_at = ?');
  values.push(now);

  db.prepare(`UPDATE complaints SET ${setParts.join(', ')} WHERE id = ?`)
    .run(...values, req.params.id);

  // History: status change
  if (status && status !== complaint.status) {
    db.prepare(
      `INSERT INTO complaint_history
         (complaint_id, action, old_status, new_status, performed_by, note)
       VALUES (?, 'status_change', ?, ?, ?, ?)`
    ).run(req.params.id, complaint.status, status, req.session.user.name, note || null);
  }

  // History: response added
  if (admin_response) {
    db.prepare(
      `INSERT INTO complaint_history
         (complaint_id, action, performed_by, note)
       VALUES (?, 'response_added', ?, ?)`
    ).run(req.params.id, req.session.user.name, admin_response.substring(0, 300));
  }

  const updated = db.prepare(`SELECT * FROM complaints WHERE id = ?`).get(req.params.id);
  res.json({ success: true, complaint: updated });
});

/* ─── DELETE /api/complaints/:id  (admin explicit delete) ─── */
router.delete('/:id', (req, res) => {
  const db = getDB();
  const complaint = db.prepare(`SELECT id FROM complaints WHERE id = ?`).get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة' });

  db.prepare(`DELETE FROM complaints WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
