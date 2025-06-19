const path = require('path');

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const commentRoutes = require('./routes/comments');

const app = express();
app.use(cors());
app.use(express.json());


app.use(express.static(path.join(__dirname, '..', 'frontend')));


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/auth', authRoutes);
app.use('/comments', commentRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT || 5000, () => console.log('Server started'));
  })
  .catch(e => console.error(e));
