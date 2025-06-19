const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
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
    try {
        const comments = await Comment.find().sort({ createdAt: -1 });
        res.json(comments);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error fetching comments' });
    }
});

router.post('/', authMiddleware, upload.array('images'), async (req, res) => {
    try {
        let { text, coords } = req.body;
        if (!text || !coords) {
            if (req.files && req.files.length > 0) {
                req.files.forEach(file => {
                    const filePath = path.join(__dirname, '..', file.path);
                    fs.unlink(filePath, (err) => {
                        if (err) console.error(`Ошибка при удалении файла ${filePath} после неудачной попытки добавления комментария:`, err);
                    });
                });
            }
            return res.status(400).json({ error: 'Missing fields: text or coords' });
        }
        
        if (typeof coords === 'string') coords = JSON.parse(coords);

        const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        const comment = new Comment({
            user: req.user.id,
            username: req.user.username,
            text,
            coords,
            imageUrls: imageUrls
        });

        await comment.save();
        res.json(comment);
    } catch (e) {
        console.error(e);
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const filePath = path.join(__dirname, '..', file.path);
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Ошибка при удалении файла ${filePath} после внутренней ошибки сервера:`, err);
                });
            });
        }
        res.status(500).json({ error: 'Server error when adding comment' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        if (comment.user.toString() !== req.user.id) return res.status(403).json({ error: 'Forbidden: You can only delete your own comments' });

        if (comment.imageUrls && comment.imageUrls.length > 0) {
            comment.imageUrls.forEach(imageUrl => {
                const filePath = path.join(__dirname, '..', imageUrl);
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Ошибка при удалении файла ${filePath}:`, err);
                    else console.log(`Файл ${filePath} успешно удален.`);
                });
            });
        }

        await Comment.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error when deleting comment' });
    }
});

module.exports = router;
