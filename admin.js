/* ══════════════════════════════════════════
   ADMIN DASHBOARD — admin.js
   Full real API integration
══════════════════════════════════════════ */

'use strict';

let currentUser   = null;
let allComplaints = [];
let currentStats  = {};
let activePanel   = 'overview';

/* ─── Helpers ─── */
const $ = id => document.getElementById(id);

function showNotif(msg, type = '') {
  const el = $('notif');
  el.textContent = msg;
  el.className = 'notif show' + (type ? ' ' + type : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'notif'; }, 3500);
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function typeLabel(t) {
  return { general: 'عامة', academic: 'أكاديمية', administrative: 'إدارية',
           financial: 'مالية', technical: 'تقنية', other: 'أخرى' }[t] || t;
}

function statusLabel(s) {
  return {
    new:          { text: '🆕 جديدة',        cls: 's-new' },
    under_review: { text: '🔄 قيد المراجعة', cls: 's-under_review' },
    resolved:     { text: '✅ تم الحل',      cls: 's-resolved' },
    archived:     { text: '🗂️ مؤرشفة',      cls: 's-archived' },
  }[s] || { text: s, cls: 's-new' };
}

function statusOptions(current) {
  const opts = [
    { v: 'new',          l: '🆕 جديدة' },
    { v: 'under_review', l: '🔄 قيد المراجعة' },
    { v: 'resolved',     l: '✅ تم الحل' },
    { v: 'archived',     l: '🗂️ مؤرشفة' },
  ];
  return opts.map(o =>
    `<option value="${o.v}" ${o.v === current ? 'selected' : ''}>${o.l}</option>`
  ).join('');
}

/* ─── API ─── */
async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ─── Auth check on load ─── */
async function init() {
  try {
    const data = await api('/auth/me');
    currentUser = data.user;
    showDashboard();
  } catch {
    showLogin();
  }
}

function showLogin() {
  $('login-page').style.display    = 'flex';
  $('dashboard-page').style.display = 'none';
}

function showDashboard() {
  $('login-page').style.display     = 'none';
  $('dashboard-page').style.display = 'flex';
  $('sidebar-name').textContent = currentUser.name;
  $('sidebar-role').textContent =
    currentUser.role === 'developer' ? '👨‍💻 المطور — صلاحيات كاملة' : '🏛️ إدارة الكلية';
  if (currentUser.role === 'developer') $('dev-section').style.display = 'block';
  switchPanel('overview', document.querySelector('.nav-item[data-panel="overview"]'));
}

/* ─── Login ─── */
async function doLogin() {
  const username = $('login-user').value.trim();
  const password = $('login-pass').value;
  const errEl    = $('login-error');
  errEl.style.display = 'none';

  if (!username || !password) {
    errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور';
    errEl.style.display = 'block';
    return;
  }

  const btn  = $('login-btn');
  const text = $('login-text');
  const spin = $('login-spinner');
  btn.disabled   = true;
  text.style.display = 'none';
  spin.style.display = 'inline-block';

  try {
    const data  = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    currentUser = data.user;
    $('login-user').value = '';
    $('login-pass').value = '';
    showDashboard();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    text.style.display = 'inline';
    spin.style.display = 'none';
  }
}

async function doLogout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  currentUser = null;
  showLogin();
}

/* ─── Sidebar / Panel ─── */
function switchPanel(panel, el) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  el?.classList.add('active');
  activePanel = panel;
  closeSidebar();
  loadPanel(panel);
}

async function loadPanel(panel) {
  const main = $('dash-main');
  main.innerHTML = `<div class="loading-screen"><div class="spinner-lg"></div><p>جارٍ التحميل...</p></div>`;

  try {
    if (panel === 'overview') {
      await loadOverview(main);
    } else if (panel.startsWith('complaints-')) {
      const statusFilter = panel.replace('complaints-', '');
      await loadComplaints(main, statusFilter === 'all' ? '' : statusFilter);
    } else if (panel === 'users') {
      await loadUsers(main);
    }
  } catch (e) {
    main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div>
      <div class="empty-text">حدث خطأ أثناء التحميل</div>
      <div class="empty-sub">${e.message}</div>
      <button class="btn btn-outline" style="margin-top:16px;" onclick="loadPanel('${panel}')">إعادة المحاولة</button>
      </div>`;
  }
}

/* ─── Overview ─── */
async function loadOverview(main) {
  const data = await api('/complaints');
  const s    = data.stats;
  allComplaints = data.complaints;
  updateBadges(s);

  const pct = s.total > 0 ? Math.round((s.resolved_count / s.total) * 100) : 0;
  const recent = data.complaints.slice(0, 8);

  main.innerHTML = `
    <div class="panel-title">📊 الإحصائيات العامة</div>
    <div class="panel-sub">مرحباً ${currentUser.name} — نظرة شاملة على النظام</div>

    <div class="stats-grid">
      <div class="stat-card c-navy">
        <div class="stat-icon">📋</div>
        <div><div class="stat-value">${s.total}</div><div class="stat-label">إجمالي الشكاوي</div></div>
      </div>
      <div class="stat-card c-blue" style="cursor:pointer;" onclick="switchPanel('complaints-new', document.querySelector('[data-panel=complaints-new]'))">
        <div class="stat-icon">🆕</div>
        <div><div class="stat-value">${s.new_count}</div><div class="stat-label">جديدة</div></div>
      </div>
      <div class="stat-card c-orange" style="cursor:pointer;" onclick="switchPanel('complaints-under_review', document.querySelector('[data-panel=complaints-under_review]'))">
        <div class="stat-icon">🔄</div>
        <div><div class="stat-value">${s.under_review_count}</div><div class="stat-label">قيد المراجعة</div></div>
      </div>
      <div class="stat-card c-green" style="cursor:pointer;" onclick="switchPanel('complaints-resolved', document.querySelector('[data-panel=complaints-resolved]'))">
        <div class="stat-icon">✅</div>
        <div><div class="stat-value">${s.resolved_count}</div><div class="stat-label">تم الحل</div></div>
      </div>
      <div class="stat-card c-gray" style="cursor:pointer;" onclick="switchPanel('complaints-archived', document.querySelector('[data-panel=complaints-archived]'))">
        <div class="stat-icon">🗂️</div>
        <div><div class="stat-value">${s.archived_count}</div><div class="stat-label">مؤرشفة</div></div>
      </div>
      <div class="stat-card c-gold">
        <div class="stat-icon">📈</div>
        <div><div class="stat-value">${pct}%</div><div class="stat-label">نسبة الحل</div></div>
      </div>
    </div>

    ${recent.length ? `
    <div class="table-card">
      <div class="table-head">
        <span class="table-head-title">📋 آخر الشكاوي المقدمة</span>
        <span class="table-head-count">${s.total} إجمالي</span>
      </div>
      <div class="recent-list">
        ${recent.map(c => {
          const st = statusLabel(c.status);
          return `
          <div class="recent-item" onclick="openDetailModal(${c.id})">
            <div class="recent-num">#${c.complaint_number}</div>
            <div class="recent-info">
              <div class="recent-name">${c.student_name} <span style="color:var(--gray);font-size:12px;">— ${c.student_code}</span></div>
              <div class="recent-subj">${c.subject}</div>
            </div>
            <span class="status-pill ${st.cls}">${st.text}</span>
            <div class="recent-date">${formatDate(c.submitted_at)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">لا توجد شكاوي بعد</div></div>`}
  `;
}

/* ─── Complaints Table ─── */
async function loadComplaints(main, statusFilter = '') {
  const qp  = statusFilter ? `?status=${statusFilter}` : '';
  const data = await api('/complaints' + qp);
  allComplaints = data.complaints;
  updateBadges(data.stats);

  const titleMap = {
    '':            'جميع الشكاوي',
    new:           '🆕 الشكاوي الجديدة',
    under_review:  '🔄 الشكاوي قيد المراجعة',
    resolved:      '✅ الشكاوي المحلولة',
    archived:      '🗂️ الشكاوي المؤرشفة',
  };

  main.innerHTML = `
    <div class="panel-title">${titleMap[statusFilter] || 'الشكاوي'}</div>
    <div class="panel-sub">إجمالي النتائج: ${data.complaints.length} شكوى</div>

    <div class="table-card">
      <div class="table-head">
        <span class="table-head-title">${titleMap[statusFilter] || 'الشكاوي'}</span>
        <span class="table-head-count">${data.complaints.length}</span>
      </div>

      <!-- Filters -->
      <div class="filters-bar" id="filters-bar">
        <div class="form-group">
          <label class="form-label">بحث</label>
          <input type="text" class="form-input" id="f-search" placeholder="اسم / كود / موضوع / رقم" />
        </div>
        <div class="form-group">
          <label class="form-label">نوع الشكوى</label>
          <select class="form-input" id="f-type">
            <option value="">كل الأنواع</option>
            <option value="general">عامة</option>
            <option value="academic">أكاديمية</option>
            <option value="administrative">إدارية</option>
            <option value="financial">مالية</option>
            <option value="technical">تقنية</option>
            <option value="other">أخرى</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">من تاريخ</label>
          <input type="date" class="form-input" id="f-from" />
        </div>
        <div class="form-group">
          <label class="form-label">إلى تاريخ</label>
          <input type="date" class="form-input" id="f-to" />
        </div>
        <button class="btn btn-primary btn-sm" onclick="applyFilters('${statusFilter}')">🔍 تصفية</button>
        <button class="btn btn-outline btn-sm" onclick="clearFilters('${statusFilter}')">مسح</button>
      </div>

      <div class="table-wrap">
        ${renderComplaintsTable(data.complaints)}
      </div>
    </div>
  `;
}

function renderComplaintsTable(complaints) {
  if (!complaints.length) {
    return `<div class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-text">لا توجد شكاوي في هذا القسم</div>
    </div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>رقم الشكوى</th>
          <th>اسم الطالب</th>
          <th>كود الطالب</th>
          <th>نوع الشكوى</th>
          <th>الموضوع</th>
          <th>الحالة</th>
          <th>تاريخ التقديم</th>
          <th>آخر تحديث</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${complaints.map(c => {
          const st = statusLabel(c.status);
          return `
          <tr>
            <td><strong style="color:var(--gold);">#${c.complaint_number}</strong></td>
            <td><strong>${c.student_name}</strong></td>
            <td><span style="font-size:12px;color:var(--gray);">${c.student_code}</span></td>
            <td><span class="type-pill">${typeLabel(c.complaint_type)}</span></td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.subject}">${c.subject}</td>
            <td><span class="status-pill ${st.cls}">${st.text}</span></td>
            <td style="font-size:12px;color:var(--gray);">${formatDate(c.submitted_at)}</td>
            <td style="font-size:12px;color:var(--gray);">${formatDate(c.updated_at)}</td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-gold btn-sm" onclick="openDetailModal(${c.id})">عرض</button>
                ${c.status !== 'resolved' ? `<button class="btn btn-green btn-sm" onclick="quickResolve(${c.id})">حل ✓</button>` : ''}
                ${currentUser.role === 'developer' ? `<button class="btn btn-red btn-sm" onclick="deleteComplaint(${c.id}, this)">حذف</button>` : ''}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function applyFilters(statusFilter) {
  const search = $('f-search')?.value.trim() || '';
  const type   = $('f-type')?.value || '';
  const from   = $('f-from')?.value || '';
  const to     = $('f-to')?.value || '';

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (search) params.set('search', search);
  if (type)   params.set('complaint_type', type);
  if (from)   params.set('date_from', from);
  if (to)     params.set('date_to', to);

  try {
    const data = await api('/complaints?' + params.toString());
    const wrap = document.querySelector('.table-wrap');
    if (wrap) wrap.innerHTML = renderComplaintsTable(data.complaints);
    document.querySelector('.panel-sub').textContent = `إجمالي النتائج: ${data.complaints.length} شكوى`;
    document.querySelector('.table-head-count').textContent = data.complaints.length;
  } catch (e) {
    showNotif(e.message, 'error');
  }
}

function clearFilters(statusFilter) {
  ['f-search', 'f-from', 'f-to'].forEach(id => { if ($(id)) $(id).value = ''; });
  const sel = $('f-type');
  if (sel) sel.selectedIndex = 0;
  applyFilters(statusFilter);
}

/* ─── Quick Resolve ─── */
async function quickResolve(id) {
  try {
    await api(`/complaints/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'under_review' }),
    });
    showNotif('تم تغيير الحالة إلى قيد المراجعة', 'success');
    loadPanel(activePanel);
  } catch (e) {
    showNotif(e.message, 'error');
  }
}

/* ─── Delete Complaint ─── */
async function deleteComplaint(id, btn) {
  if (!confirm('هل أنت متأكد من حذف هذه الشكوى؟ لا يمكن التراجع عن هذا الإجراء.')) return;
  btn.disabled = true;
  try {
    await api(`/complaints/${id}`, { method: 'DELETE' });
    showNotif('تم حذف الشكوى بنجاح', 'success');
    loadPanel(activePanel);
  } catch (e) {
    showNotif(e.message, 'error');
    btn.disabled = false;
  }
}

/* ─── Detail Modal ─── */
async function openDetailModal(id) {
  $('detail-modal').classList.add('open');
  $('modal-body').innerHTML = `<div class="loading-screen" style="min-height:200px;"><div class="spinner-lg"></div><p>جارٍ التحميل...</p></div>`;
  $('modal-foot').innerHTML = '';

  try {
    const c = await api(`/complaints/${id}`);
    $('modal-title').textContent = `شكوى رقم #${c.complaint_number}`;
    renderDetailModal(c);
  } catch (e) {
    $('modal-body').innerHTML = `<div class="empty-state"><div class="empty-text">⚠️ ${e.message}</div></div>`;
  }
}

function renderDetailModal(c) {
  const st = statusLabel(c.status);

  $('modal-body').innerHTML = `
    <!-- Student info -->
    <div class="detail-section">
      <div class="detail-section-title">بيانات الطالب</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="di-label">الاسم الكامل</div><div class="di-value">${c.student_name}</div></div>
        <div class="detail-item"><div class="di-label">كود الطالب</div><div class="di-value">${c.student_code}</div></div>
        <div class="detail-item"><div class="di-label">رقم الموبايل</div><div class="di-value" dir="ltr">${c.student_mobile}</div></div>
        <div class="detail-item"><div class="di-label">الرقم القومي</div><div class="di-value" dir="ltr">${c.student_national_id || '—'}</div></div>
        <div class="detail-item"><div class="di-label">نوع الشكوى</div><div class="di-value">${typeLabel(c.complaint_type)}</div></div>
        <div class="detail-item"><div class="di-label">الحالة الحالية</div><div class="di-value"><span class="status-pill ${st.cls}">${st.text}</span></div></div>
        <div class="detail-item"><div class="di-label">تاريخ التقديم</div><div class="di-value">${formatDate(c.submitted_at)}</div></div>
        <div class="detail-item"><div class="di-label">آخر تحديث</div><div class="di-value">${formatDate(c.updated_at)}</div></div>
      </div>
    </div>

    <!-- Complaint content -->
    <div class="detail-section">
      <div class="detail-section-title">محتوى الشكوى</div>
      <div style="font-size:16px;font-weight:800;color:var(--navy);margin-bottom:10px;">${c.subject}</div>
      <div class="content-box">${c.content}</div>
    </div>

    <!-- Response -->
    ${c.admin_response ? `
    <div class="detail-section">
      <div class="detail-section-title">رد الإدارة</div>
      <div class="content-box response">${c.admin_response}</div>
      <div style="font-size:12px;color:var(--gray);margin-top:8px;">بواسطة: ${c.responded_by || '—'}</div>
    </div>` : ''}

    <!-- Update status & response -->
    <div class="detail-section">
      <div class="detail-section-title">تحديث الشكوى</div>
      <div class="status-select-row" style="margin-bottom:14px;">
        <div class="form-group">
          <label class="form-label">تغيير الحالة</label>
          <select class="form-input" id="modal-status">${statusOptions(c.status)}</select>
        </div>
        <button class="btn btn-orange btn-sm" style="align-self:flex-end;" onclick="updateStatus(${c.id})">تحديث الحالة</button>
      </div>
      <div class="form-group">
        <label class="form-label">إضافة / تعديل الرد</label>
        <textarea class="form-textarea" id="modal-response" rows="4" placeholder="اكتب الرد هنا...">${c.admin_response || ''}</textarea>
      </div>
    </div>

    <!-- History -->
    ${c.history && c.history.length ? `
    <div class="detail-section">
      <div class="detail-section-title">سجل التاريخ (${c.history.length})</div>
      <div class="history-list">
        ${c.history.map(h => {
          const icons = { submitted: '📩', status_change: '🔄', response_added: '💬' };
          return `
          <div class="history-item">
            <div class="history-dot">${icons[h.action] || '📌'}</div>
            <div class="history-text">
              <div class="history-action">${
                h.action === 'submitted'      ? 'تم تقديم الشكوى' :
                h.action === 'status_change'  ? `تغيير الحالة: ${statusLabel(h.old_status).text} ← ${statusLabel(h.new_status).text}` :
                h.action === 'response_added' ? 'تم إضافة رد' : h.action
              }</div>
              ${h.note ? `<div class="history-note">${h.note}</div>` : ''}
              <div class="history-meta">${h.performed_by || '—'} • ${formatDate(h.performed_at)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;

  $('modal-foot').innerHTML = `
    <button class="btn btn-outline" onclick="closeDetailModal()">إغلاق</button>
    <button class="btn btn-green" onclick="saveResponse(${c.id})">💾 حفظ الرد والحالة</button>
    ${currentUser.role === 'developer' ? `
    <button class="btn btn-red" onclick="deleteComplaintFromModal(${c.id})">🗑️ حذف الشكوى</button>` : ''}
  `;
}

async function updateStatus(id) {
  const status = $('modal-status').value;
  try {
    await api(`/complaints/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    showNotif('تم تحديث الحالة', 'success');
    openDetailModal(id);   // Refresh modal
    loadPanel(activePanel);
  } catch (e) {
    showNotif(e.message, 'error');
  }
}

async function saveResponse(id) {
  const status   = $('modal-status').value;
  const response = $('modal-response').value.trim();

  if (!response) {
    return showNotif('يرجى كتابة الرد قبل الحفظ', 'error');
  }

  try {
    await api(`/complaints/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_response: response }),
    });
    showNotif('✅ تم حفظ الرد وتحديث الحالة', 'success');
    closeDetailModal();
    loadPanel(activePanel);
  } catch (e) {
    showNotif(e.message, 'error');
  }
}

async function deleteComplaintFromModal(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الشكوى؟')) return;
  try {
    await api(`/complaints/${id}`, { method: 'DELETE' });
    showNotif('تم حذف الشكوى', 'success');
    closeDetailModal();
    loadPanel(activePanel);
  } catch (e) {
    showNotif(e.message, 'error');
  }
}

function closeDetailModal() {
  $('detail-modal').classList.remove('open');
}

function closeModal(e) {
  if (e && e.target !== $('detail-modal')) return;
  closeDetailModal();
}

/* ─── Users Panel ─── */
async function loadUsers(main) {
  const users = await api('/auth/users');

  main.innerHTML = `
    <div class="panel-title">👥 إدارة المستخدمين</div>
    <div class="panel-sub">حسابات إدارة الكلية — ${users.length} حساب</div>

    <div style="margin-bottom:20px;">
      <button class="btn btn-primary" onclick="openAddUserModal()">➕ إضافة مستخدم جديد</button>
    </div>

    <div class="table-card">
      <div class="table-head">
        <span class="table-head-title">قائمة المستخدمين</span>
        <span class="table-head-count">${users.length}</span>
      </div>
      ${users.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-text">لا يوجد حسابات بعد</div>
          <div class="empty-sub">أضف حساباً جديداً لإدارة الكلية</div>
        </div>` : `
      <div class="user-list">
        ${users.map(u => `
          <div class="user-item">
            <div class="user-avatar">👤</div>
            <div class="user-meta">
              <div class="user-name">${u.name}</div>
              <div class="user-uname">@${u.username} — آخر دخول: ${u.last_login ? formatDate(u.last_login) : 'لم يسجل دخول بعد'}</div>
            </div>
            <span class="status-pill s-resolved" style="font-size:11px;">إدارة الكلية ✓</span>
            <button class="btn btn-red btn-sm" onclick="deleteUser(${u.id}, this)">حذف</button>
          </div>`).join('')}
      </div>`}
    </div>
  `;
}

function openAddUserModal() {
  ['new-name', 'new-username', 'new-password'].forEach(id => $(id).value = '');
  $('add-user-modal').classList.add('open');
}

function closeAddUserModal(e) {
  if (e && e.target !== $('add-user-modal')) return;
  $('add-user-modal').classList.remove('open');
}

async function createUser() {
  const name     = $('new-name').value.trim();
  const username = $('new-username').value.trim();
  const password = $('new-password').value;

  if (!name || !username || !password) return showNotif('يرجى ملء جميع الحقول', 'error');
  if (password.length < 6) return showNotif('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');

  try {
    await api('/auth/users', {
      method: 'POST',
      body: JSON.stringify({ name, username, password }),
    });
    showNotif('✅ تم إنشاء الحساب بنجاح', 'success');
    $('add-user-modal').classList.remove('open');
    loadPanel('users');
  } catch (e) {
    showNotif(e.message, 'error');
  }
}

async function deleteUser(id, btn) {
  if (!confirm('هل تريد حذف هذا الحساب؟')) return;
  btn.disabled = true;
  try {
    await api(`/auth/users/${id}`, { method: 'DELETE' });
    showNotif('تم حذف الحساب', 'success');
    loadPanel('users');
  } catch (e) {
    showNotif(e.message, 'error');
    btn.disabled = false;
  }
}

/* ─── Badge counters ─── */
function updateBadges(stats) {
  if (!stats) return;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('badge-all',      stats.total);
  set('badge-new',      stats.new_count);
  set('badge-review',   stats.under_review_count);
  set('badge-resolved', stats.resolved_count);
  set('badge-archived', stats.archived_count);
}

/* ─── Mobile Sidebar ─── */
function toggleSidebar() {
  $('sidebar').classList.toggle('open');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
}

/* ─── Keyboard shortcuts ─── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetailModal();
    $('add-user-modal').classList.remove('open');
    closeSidebar();
  }
});

/* ─── Enter on login ─── */
document.getElementById('login-pass')?.addEventListener('keypress', e => {
  if (e.key === 'Enter') doLogin();
});

/* ─── Boot ─── */
init();
