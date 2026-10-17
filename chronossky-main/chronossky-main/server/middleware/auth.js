const jwt = require('jsonwebtoken');
module.exports = function auth(req, res, next) {
  const token = req.get('x-auth-token') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch (_) { return res.status(401).json({ msg: 'Token is not valid' }); }
};
