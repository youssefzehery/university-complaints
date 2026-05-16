# 🏛️ منظومة الشكاوي الطلابية
## كلية التجارة — جامعة دمياط | طلاب من أجل مصر

نظام إلكتروني متكامل لتسجيل ومتابعة شكاوي الطلاب بـ Node.js + SQLite.

---

## ✨ المميزات

- **واجهة الطلاب**: تقديم شكاوي + تتبع الحالة برقم الشكوى
- **لوحة الإدارة**: محمية بكلمة مرور — لا يمكن الوصول إليها من واجهة الطلاب
- **قاعدة بيانات حقيقية**: SQLite تُنشأ تلقائياً عند أول تشغيل
- **حالات الشكوى**: جديدة ← قيد المراجعة ← تم الحل ← مؤرشفة
- **سجل التاريخ**: كل تعديل على الشكوى يُسجَّل تلقائياً
- **بحث وتصفية**: حسب الحالة / الكود / النوع / التاريخ
- **حذف يدوي فقط**: لا تختفي الشكاوي تلقائياً أبداً
- **Render Ready**: جاهز للنشر الفوري

---

## 📁 هيكل المشروع

```
university-complaints/
├── server.js           ← Express server
├── database.js         ← SQLite setup & auto-init
├── package.json
├── render.yaml         ← Render deployment config
├── .env.example
├── routes/
│   ├── auth.js         ← Login / logout / user management
│   └── complaints.js   ← CRUD API
├── middleware/
│   └── auth.js         ← Session auth guards
└── public/
    ├── index.html      ← Student page ONLY
    ├── admin/
    │   └── index.html  ← Admin login + dashboard
    ├── css/
    │   ├── student.css
    │   └── admin.css
    ├── js/
    │   ├── student.js
    │   └── admin.js
    └── images/
        ├── logo_1.png
        └── com_logo.png
```

---

## 🔐 بيانات الدخول الافتراضية

| النوع | اسم المستخدم | كلمة المرور |
|-------|------------|------------|
| المطور | dev | dev@2024 |

> ⚠️ غيّر كلمة المرور بعد أول دخول من خلال إدارة المستخدمين!

---

## 🗄️ قاعدة البيانات

جدول `complaints`:
- `id`, `complaint_number`, `student_name`, `student_code`, `student_mobile`
- `student_national_id`, `complaint_type`, `subject`, `content`
- `status` (new / under_review / resolved / archived)
- `admin_response`, `responded_by`
- `submitted_at`, `updated_at`

جدول `complaint_history`:
- كل تغيير في الحالة أو إضافة رد يُسجَّل تلقائياً

جدول `admin_users`:
- حسابات الإدارة مشفّرة بـ bcrypt

---

## 🚀 API Routes

| Method | Route | Auth | الوصف |
|--------|-------|------|-------|
| POST | /api/complaints | ❌ | تقديم شكوى جديدة |
| GET | /api/complaints/track/:num | ❌ | تتبع شكوى برقمها |
| GET | /api/complaints | ✅ | جلب كل الشكاوي (مع فلاتر) |
| GET | /api/complaints/:id | ✅ | تفاصيل شكوى + تاريخها |
| PUT | /api/complaints/:id | ✅ | تحديث الحالة / إضافة رد |
| DELETE | /api/complaints/:id | ✅ | حذف شكوى |
| POST | /api/auth/login | ❌ | تسجيل الدخول |
| POST | /api/auth/logout | ✅ | تسجيل الخروج |
| GET | /api/auth/me | ✅ | بيانات المستخدم الحالي |
| GET | /api/auth/users | 🔑 dev | قائمة المستخدمين |
| POST | /api/auth/users | 🔑 dev | إنشاء مستخدم |
| DELETE | /api/auth/users/:id | 🔑 dev | حذف مستخدم |

---

## 💻 تشغيل محلي

```bash
# 1. تثبيت المتطلبات
npm install

# 2. إعداد متغيرات البيئة
cp .env.example .env

# 3. تشغيل الخادم
npm start

# الروابط:
# واجهة الطلاب → http://localhost:3000/
# لوحة الإدارة → http://localhost:3000/admin
```

---

## 🌐 النشر على Render (مجاني)

### الخطوة 1 — رفع على GitHub

```bash
# إنشاء repository جديد على github.com
# ثم في مجلد المشروع:

git init
git add .
git commit -m "Initial commit — University Complaints System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/university-complaints.git
git push -u origin main
```

أو ارفع الملفات مباشرة:
1. افتح https://github.com → New repository
2. اسم: `university-complaints` → Public → Create
3. اضغط **uploading an existing file**
4. اسحب **كل مجلد المشروع** (ما عدا `node_modules`)
5. Commit changes

### الخطوة 2 — ربط بـ Render

1. افتح https://render.com وسجّل الدخول
2. اضغط **New** → **Web Service**
3. اختر **Connect a repository** → اختر الـ repo الذي رفعته
4. سيقرأ Render ملف `render.yaml` تلقائياً
5. تأكد الإعدادات:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
6. اضغط **Create Web Service**

### الخطوة 3 — إعداد المتغيرات

في Render → Service → **Environment**:
```
NODE_ENV     = production
SESSION_SECRET = (اضغط Generate — سيولّد تلقائياً)
DEV_PASSWORD   = dev@2024
```

### الخطوة 4 — إضافة Disk لحفظ قاعدة البيانات

في Render → Service → **Disks**:
- Name: `complaints-db`
- Mount Path: `/data`
- Size: `1 GB`
- اضغط **Save**

### الخطوة 5 — الانتظار والوصول

- انتظر 3-5 دقائق للـ Build
- الرابط سيكون: `https://university-complaints.onrender.com`
  - واجهة الطلاب: `https://university-complaints.onrender.com/`
  - لوحة الإدارة: `https://university-complaints.onrender.com/admin`

---

## ⚠️ ملاحظات مهمة

- **Free tier**: قد يستغرق أول طلب 30-60 ثانية (cold start)
- **الـ Disk** ضروري لبقاء بيانات SQLite بعد الإعادة التشغيل
- **كلمة مرور المطور** تُعيَّن من `DEV_PASSWORD` عند أول تشغيل فقط
- لتغيير كلمة المرور لاحقاً: أضف مستخدماً جديداً من لوحة التحكم

---

## 🛠️ التقنيات

- **Backend**: Node.js + Express 4
- **Database**: SQLite (better-sqlite3)
- **Auth**: express-session + bcryptjs
- **Security**: helmet + httpOnly cookies
- **Frontend**: Vanilla JS + Cairo font (RTL)
- **Deployment**: Render free tier
