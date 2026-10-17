const mongoose = require('mongoose');
const starSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  type: { type: String, default: 'Unknown stellar object' },
  desc: { type: String, default: '' },
  fact: { type: String, default: '' },
  coordinates: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 }, z: { type: Number, default: 0 } },
  color: { type: String, default: '#00ffff' },
  slug: { type: String, unique: true, sparse: true, index: true }
}, { timestamps: true });
module.exports = mongoose.model('Star', starSchema);
