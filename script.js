const socket = io();

// Peer bağlantılarını tut
const peerConnections = {};

// STUN server
const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

const video = document.getElementById('screen-view');
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const mode = urlParams.get('mode');

socket.on('connect', () => {
  console.log("Bağlandı:", socket.id);
  socket.emit('join-room', roomId, mode);

  if (mode === "viewer") {
    // Yayıncıdan offer iste
    socket.emit('request-offer', roomId, socket.id);
  }
});

// Sunucudan yayıncı isteği geldi
socket.on('request-offer', (fromId) => {
  if (mode === "broadcaster") {
    startStreaming(fromId);
  }
});

// Yayına biri katıldı (yayıncıya gelir)
socket.on('user-joined', (userId, userMode) => {
  if (mode === "broadcaster" && userMode === "viewer") {
    startStreaming(userId);
  }
});

socket.on('offer', async (offer, fromId) => {
  if (mode === "viewer") {
    const pc = createPeerConnection(fromId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', answer, fromId);
  }
});

socket.on('answer', async (answer, fromId) => {
  const pc = peerConnections[fromId];
  if (pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on('ice-candidate', async (candidate, fromId) => {
  const pc = peerConnections[fromId];
  if (pc) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

// Peer bağlantısı oluştur
function createPeerConnection(targetId) {
  const pc = new RTCPeerConnection(configuration);
  peerConnections[targetId] = pc;

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, targetId);
    }
  };

  pc.ontrack = (event) => {
    if (mode === "viewer") {
      video.srcObject = event.streams[0];
    }
  };

  return pc;
}

// Yayıncı ekran paylaşımını başlatır
async function startStreaming(targetId) {
  const pc = createPeerConnection(targetId);

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false
  });

  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', offer, targetId);
}
