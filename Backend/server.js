// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const socketHandler = require('./sockets/socketHandler');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const messageRoutes = require('./routes/messageRoutes');
const fileRoutes = require('./routes/fileRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use((req, res, next) => {
    req.io = io;
    next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', (req, res, next) => {
    const filePath = path.join(__dirname, 'uploads', req.url);
    console.log('Requested file:', filePath); // Debug log
    if (!fs.existsSync(filePath)) {
        console.log('File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }
    next();
}, express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/test', (req, res) => {
    console.log('Test endpoint hit');
    res.send('Server is running');
});
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', groupRoutes);
app.use('/api', messageRoutes);
app.use('/api', fileRoutes);
app.use(express.static(path.join(__dirname, "..", "Frontend", "dist")));
app.get('*', (_, res) => {
    res.sendFile(path.resolve(__dirname, "..", "Frontend", "dist", "index.html"));
});

// Socket.IO Handling
socketHandler(io);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err.message));

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test endpoint: http://localhost:${PORT}/test`);
});