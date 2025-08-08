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

        // Yayıncıya bildir: yeni kullanıcı geldi
        socket.to(roomId).emit('user-joined', socket.id, mode);

        // Katılan kullanıcıya onay
        socket.emit('joined-success', { roomId, yourSocketId: socket.id });
    });

    // İzleyici, yayıncıdan offer ister
    socket.on('request-offer', (toId, fromId) => {
        io.to(toId).emit('request-offer', fromId);
    });

    // WebRTC offer, answer, ice-candidate
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
        // Ayrılma durumu
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
