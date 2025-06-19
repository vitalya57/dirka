const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment'); // Убедись, что модель Comment поддерживает массив imageUrls
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs'); // Для удаления файлов при удалении комментария
const path = require('path'); // Для работы с путями

// настройки multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/'; // Путь относительно корня проекта
        // Создаем папку, если она не существует
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
// Изменяем с upload.single на upload.array и указываем имя поля 'images'
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

// Изменяем с upload.single('image') на upload.array('images')
router.post('/', authMiddleware, upload.array('images'), async (req, res) => {
    try {
        let { text, coords } = req.body;
        // Проверяем наличие текста и координат
        if (!text || !coords) {
            // Если файлы были загружены, но произошла ошибка, удаляем их
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

        // Собираем массив путей к загруженным файлам
        const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

        const comment = new Comment({
            user: req.user.id,
            username: req.user.username,
            text,
            coords,
            imageUrls: imageUrls // Сохраняем массив URL-ов
        });

        await comment.save();
        res.json(comment);
    } catch (e) {
        console.error(e);
        // Дополнительная очистка, если ошибка произошла после multer, но до сохранения в БД
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

        // Удаляем связанные файлы с диска
        if (comment.imageUrls && comment.imageUrls.length > 0) {
            comment.imageUrls.forEach(imageUrl => {
                // Извлекаем путь к файлу относительно корня проекта
                // `path.join(__dirname, '..', imageUrl)` - корректный путь, так как `comments.js` находится в `backend/`
                const filePath = path.join(__dirname, '..', imageUrl);
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Ошибка при удалении файла ${filePath}:`, err);
                    else console.log(`Файл ${filePath} успешно удален.`);
                });
            });
        }

        await Comment.findByIdAndDelete(req.params.id);
        res.status(204).end(); // 204 No Content - успешное удаление без тела ответа
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error when deleting comment' });
    }
});

module.exports = router;
