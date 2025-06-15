const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const jwt = require('jsonwebtoken');
const multer = require('multer');

// настройки multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.get('/', async (req, res) => {
  const comments = await Comment.find().sort({ createdAt: -1 });
  res.json(comments);
});

router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    let { text, coords } = req.body;
    if (!text || !coords) return res.status(400).json({ error: 'Missing fields' });
    if (typeof coords === 'string') coords = JSON.parse(coords);

    const comment = new Comment({
      user: req.user.id,
      username: req.user.username,
      text,
      coords,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null
    });

    await comment.save();
    res.json(comment);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.user.toString() !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  await Comment.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

module.exports = router;
