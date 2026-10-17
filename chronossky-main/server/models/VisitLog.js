const mongoose = require('mongoose');
const visitLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  star: { type: mongoose.Schema.Types.ObjectId, ref: 'Star', required: true },
  visitedAt: { type: Date, default: Date.now }
});
visitLogSchema.index({ user: 1, star: 1 }, { unique: true });
module.exports = mongoose.model('VisitLog', visitLogSchema);
