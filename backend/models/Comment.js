const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    coords: { type: [Number], required: true },
    // Изменяем с 'imageUrl: { type: String, default: null }'
    // на 'imageUrls: { type: [String], default: [] }' для поддержки массива строк
    imageUrls: { 
        type: [String], // Массив строк для хранения путей к нескольким изображениям
        default: []    // По умолчанию это пустой массив
    }
}, { timestamps: true }); // timestamps: true добавляет createdAt и updatedAt автоматически

module.exports = mongoose.model('Comment', commentSchema);
