const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  coords: { type: [Number], required: true },
  imageUrl: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
