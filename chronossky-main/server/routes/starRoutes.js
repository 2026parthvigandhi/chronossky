const express = require('express');
const mongoose = require('mongoose');
const Star = require('../models/Star');
const User = require('../models/User');
const VisitLog = require('../models/VisitLog');
const auth = require('../middleware/auth');
const router = express.Router();
router.get('/', async (_req, res) => {
  try { const stars = await Star.find().select('-__v').lean(); return res.json(stars); }
  catch (err) { console.error(err); return res.status(500).json({ msg: 'Unable to load stars.' }); }
});
router.post('/:starId/visit', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.starId)) return res.status(400).json({ msg: 'Invalid star ID.' });
    const [star, user] = await Promise.all([Star.findById(req.params.starId), User.findById(req.user.user.id)]);
    if (!star) return res.status(404).json({ msg: 'Star not found.' });
    if (!user) return res.status(401).json({ msg: 'Account not found; sign in again.' });
    const alreadyVisited = user.visitedStarIds.some(id => id.equals(star._id));
    if (!alreadyVisited) { user.visitedStarIds.addToSet(star._id); await user.save(); await VisitLog.updateOne({ user: user._id, star: star._id }, { $setOnInsert: { user: user._id, star: star._id } }, { upsert: true }); }
    return res.json({ msg: alreadyVisited ? 'Already visited' : 'Star visit saved', visited: true, starId: star.id });
  } catch (err) { console.error(err); return res.status(500).json({ msg: 'Unable to save star visit.' }); }
});
router.get('/visited', auth, async (req, res) => {
  try { const user = await User.findById(req.user.user.id).populate('visitedStarIds', 'name type color slug'); if (!user) return res.status(404).json({ msg: 'User not found.' }); return res.json(user.visitedStarIds); }
  catch (err) { console.error(err); return res.status(500).json({ msg: 'Unable to load visit history.' }); }
});
module.exports = router;
