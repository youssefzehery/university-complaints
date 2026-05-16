function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
  }
  next();
}

function requireDeveloper(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'developer') {
    return res.status(403).json({ error: 'هذه العملية تتطلب صلاحيات المطور' });
  }
  next();
}

module.exports = { requireAuth, requireDeveloper };
