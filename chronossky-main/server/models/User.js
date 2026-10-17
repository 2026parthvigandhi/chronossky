const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 40, unique: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: true, select: false },
  visitedStarIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Star' }],
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', userSchema);
