const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
function issueToken(user) { return jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '1d' }); }
router.post('/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (username.length < 2 || username.length > 40) return res.status(400).json({ msg: 'Username must be 2–40 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ msg: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ msg: 'Password must be at least 8 characters.' });
    if (await User.findOne({ $or: [{ email }, { username }] })) return res.status(409).json({ msg: 'Username or email already exists.' });
    const user = await User.create({ username, email, password: await bcrypt.hash(password, 12) });
    return res.status(201).json({ token: issueToken(user), user: { id: user.id, username: user.username } });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ msg: 'Username or email already exists.' }); console.error(err); return res.status(500).json({ msg: 'Server error' }); }
});
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ msg: 'Invalid credentials.' });
    return res.json({ token: issueToken(user), user: { id: user.id, username: user.username } });
  } catch (err) { console.error(err); return res.status(500).json({ msg: 'Server error' }); }
});
module.exports = router;
