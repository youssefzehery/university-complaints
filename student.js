/* ══════════════════════════════════════
   STUDENT PAGE — student.js
   All data goes to the real backend API
══════════════════════════════════════ */

let studentData = {};

/* ─── Utility ─── */
function showNotif(msg, type = '') {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.className = 'notif show' + (type ? ' ' + type : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'notif'; }, 3500);
}

/* ─── Step Logic ─── */
function setStep(n) {
  // Dots
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (i < n) {
      dot.className = 'step-dot done';
      dot.textContent = '✓';
    } else if (i === n) {
      dot.className = 'step-dot active';
      dot.textContent = ['', '١', '٢', '٣'][i];
    } else {
      dot.className = 'step-dot';
      dot.textContent = ['', '١', '٢', '٣'][i];
    }
  }
  // Lines
  for (let i = 1; i <= 2; i++) {
    document.getElementById(`line-${i}`).className =
      'step-line' + (i < n ? ' done' : '');
  }
  // Sections
  document.querySelectorAll('.step-section').forEach((s, idx) => {
    s.classList.toggle('active', idx + 1 === n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToStep1() { setStep(1); }

function goToStep2() {
  const name     = document.getElementById('st-name').value.trim();
  const mobile   = document.getElementById('st-mobile').value.trim();
  const code     = document.getElementById('st-code').value.trim();
  const national = document.getElementById('st-national').value.trim();

  if (!name || !mobile || !code || !national) {
    return showNotif('يرجى ملء جميع الحقول المطلوبة', 'error');
  }
  if (!/^01[0-9]{9}$/.test(mobile)) {
    return showNotif('رقم الموبايل غير صحيح — يجب أن يبدأ بـ 01 ويكون 11 رقماً', 'error');
  }
  if (national.length !== 14 || !/^\d+$/.test(national)) {
    return showNotif('الرقم القومي يجب أن يكون 14 رقماً', 'error');
  }

  studentData = { student_name: name, student_mobile: mobile, student_code: code, student_national_id: national };
  setStep(2);
}

function goToTrack() {
  goToStep1();
  setTimeout(() => {
    const el = document.getElementById('track-num');
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
}

function resetForm() {
  ['st-name', 'st-mobile', 'st-code', 'st-national',
   'comp-subject', 'comp-text'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('comp-type').selectedIndex = 0;
  document.getElementById('char-count').textContent = '0 حرف';
  studentData = {};
  goToStep1();
}

/* ─── Char counter ─── */
document.getElementById('comp-text').addEventListener('input', function () {
  document.getElementById('char-count').textContent = this.value.length + ' حرف';
});

/* ─── Submit Complaint ─── */
async function submitComplaint() {
  const subject = document.getElementById('comp-subject').value.trim();
  const content = document.getElementById('comp-text').value.trim();
  const type    = document.getElementById('comp-type').value;

  if (!subject) return showNotif('يرجى كتابة موضوع الشكوى', 'error');
  if (content.length < 10) return showNotif('يرجى كتابة تفاصيل الشكوى (10 أحرف على الأقل)', 'error');

  const btn      = document.getElementById('submit-btn');
  const btnText  = document.getElementById('submit-text');
  const spinner  = document.getElementById('submit-spinner');

  btn.disabled          = true;
  btnText.style.display = 'none';
  spinner.style.display = 'inline-block';

  try {
    const res = await fetch('/api/complaints', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...studentData,
        complaint_type: type,
        subject,
        content,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showNotif(data.error || 'حدث خطأ أثناء الإرسال', 'error');
    } else {
      document.getElementById('success-num').textContent = data.complaint_number;
      setStep(3);
    }
  } catch {
    showNotif('تعذّر الاتصال بالخادم — تحقق من الاتصال بالإنترنت', 'error');
  } finally {
    btn.disabled          = false;
    btnText.style.display = 'inline';
    spinner.style.display = 'none';
  }
}

/* ─── Track Complaint ─── */
async function trackComplaint() {
  const raw = document.getElementById('track-num').value.trim();
  const div = document.getElementById('track-result');

  if (!raw) return showNotif('يرجى إدخال رقم الشكوى', 'error');

  div.innerHTML = '<div style="text-align:center;padding:16px;color:#6b7280;">جارٍ البحث...</div>';

  try {
    const res  = await fetch(`/api/complaints/track/${encodeURIComponent(raw)}`);
    const data = await res.json();

    if (!res.ok) {
      div.innerHTML = renderTrackNotFound(data.error || 'لم يتم العثور على الشكوى');
      return;
    }

    div.innerHTML = renderTrackResult(data);
  } catch {
    div.innerHTML = renderTrackNotFound('تعذّر الاتصال بالخادم');
  }
}

function statusLabel(status) {
  const map = {
    new:          { text: '🆕 جديدة',        cls: 'badge-new' },
    under_review: { text: '🔄 قيد المراجعة', cls: 'badge-under-review' },
    resolved:     { text: '✅ تم الحل',      cls: 'badge-resolved' },
    archived:     { text: '🗂️ مؤرشفة',      cls: 'badge-archived' },
  };
  return map[status] || { text: status, cls: 'badge-new' };
}

function typeLabel(type) {
  const map = {
    general:        'عامة',
    academic:       'أكاديمية',
    administrative: 'إدارية',
    financial:      'مالية',
    technical:      'تقنية',
    other:          'أخرى',
  };
  return map[type] || type;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function renderTrackNotFound(msg) {
  return `
    <div class="track-box not-found">
      <span class="track-status-badge badge-not-found">❌ غير موجود</span>
      <p style="font-size:14px;color:#dc2626;margin-top:6px;">${msg}</p>
    </div>`;
}

function renderTrackResult(c) {
  const status = statusLabel(c.status);
  const hasResponse = c.admin_response && c.status === 'resolved';

  return `
    <div class="track-box ${c.status === 'resolved' ? 'answered' : c.status === 'under_review' ? 'under_review' : ''}">
      <span class="track-status-badge ${status.cls}">${status.text}</span>

      <div style="font-size:16px;font-weight:700;color:var(--navy);margin-bottom:12px;">
        شكوى رقم: <span style="color:var(--gold);">${c.complaint_number}</span>
      </div>

      <div class="track-info-grid">
        <div class="track-info-item">
          <div class="ti-label">اسم الطالب</div>
          <div class="ti-value">${c.student_name}</div>
        </div>
        <div class="track-info-item">
          <div class="ti-label">كود الطالب</div>
          <div class="ti-value">${c.student_code}</div>
        </div>
        <div class="track-info-item">
          <div class="ti-label">نوع الشكوى</div>
          <div class="ti-value">${typeLabel(c.complaint_type)}</div>
        </div>
        <div class="track-info-item">
          <div class="ti-label">تاريخ التقديم</div>
          <div class="ti-value">${formatDate(c.submitted_at)}</div>
        </div>
      </div>

      <div style="font-weight:700;color:var(--navy);margin-top:4px;margin-bottom:6px;">${c.subject}</div>
      <div class="complaint-content-box">
        <div class="box-label">نص الشكوى</div>
        ${c.content}
      </div>

      ${hasResponse ? `
        <div class="complaint-content-box response-box" style="margin-top:12px;">
          <div class="box-label">📩 رد إدارة الكلية</div>
          ${c.admin_response}
          <div style="font-size:12px;color:var(--gray);margin-top:8px;">بواسطة: ${c.responded_by || 'الإدارة'}</div>
        </div>` : `
        <div style="margin-top:12px;font-size:13px;color:var(--gray);padding:10px;background:var(--light);border-radius:8px;border:1px solid var(--border);">
          ⏳ شكواك ${c.status === 'under_review' ? 'قيد المراجعة حالياً' : 'بانتظار المراجعة'} — سيتم الرد عليها قريباً
        </div>`}
    </div>`;
}

/* ─── Enter key on track input ─── */
document.getElementById('track-num').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') trackComplaint();
});
