const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Statik dosyaları serve et
app.use(express.static(path.join(__dirname, './')));
app.use(cors());

// WebRTC Signaling
io.on('connection', (socket) => {
    socket.on('join-room', (roomId, userId, mode) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', userId, mode);
    });
    socket.on('offer', (offer, targetId) => {
        socket.to(targetId).emit('offer', offer, socket.id);
    });
    socket.on('answer', (answer, targetId) => {
        socket.to(targetId).emit('answer', answer, socket.id);
    });
    socket.on('ice-candidate', (candidate, targetId) => {
        socket.to(targetId).emit('ice-candidate', candidate, socket.id);
    });
    socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 