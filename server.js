'use strict';
require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');

const { initDB }       = require('./database');
const authRoutes       = require('./routes/auth');
const complaintsRoutes = require('./routes/complaints');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc:  ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com","https://fonts.gstatic.com"],
    fontSrc:    ["'self'", "https://fonts.gstatic.com"],
    imgSrc:     ["'self'", "data:", "blob:"],
    connectSrc: ["'self'"],
  },
}}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'CHANGE_THIS_SECRET_IN_PROD',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000,
  },
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',       authRoutes);
app.use('/api/complaints', complaintsRoutes);

app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/admin',  (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.get('/admin/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));

app.use((_req, res) => res.status(404).json({ error: 'المسار غير موجود' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'خطأ داخلي في الخادم' });
});

// Async boot — wait for DB before accepting connections
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running → http://localhost:${PORT}`);
      console.log(`   Student page  → http://localhost:${PORT}/`);
      console.log(`   Admin panel   → http://localhost:${PORT}/admin\n`);
    });
  })
  .catch(err => {
    console.error('[FATAL] Could not initialise database:', err);
    process.exit(1);
  });
