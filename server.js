// server.js - güncellenmiş
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

    // Odaya katılma: server diğerlerine socket.id ile bildirir
    socket.on('join-room', (roomId, mode) => {
        socket.join(roomId);

        // Odaya yeni bir kullanıcı katıldı - diğerlerine socket.id ve mod gönder
        socket.to(roomId).emit('user-joined', socket.id, mode);

        // (İsteğe bağlı) Katılan kişiye oda bilgisini gönder
        socket.emit('joined-success', { roomId, yourSocketId: socket.id });
    });

    // Tekil socket'e doğrudan gönderim için io.to(...) kullanılmalı
    socket.on('offer', (offer, targetSocketId) => {
        if (targetSocketId) {
            io.to(targetSocketId).emit('offer', offer, socket.id);
        }
    });

    socket.on('answer', (answer, targetSocketId) => {
        if (targetSocketId) {
            io.to(targetSocketId).emit('answer', answer, socket.id);
        }
    });

    socket.on('ice-candidate', (candidate, targetSocketId) => {
        if (targetSocketId) {
            io.to(targetSocketId).emit('ice-candidate', candidate, socket.id);
        }
    });

    socket.on('disconnect', () => {
        // İsteğe bağlı: odalardaki diğerlerine ayrıldığını bildir
        // let rooms = Array.from(socket.rooms); // eğer gerekirse
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
