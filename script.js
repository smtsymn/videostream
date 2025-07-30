// ScreenShare Pro - Main JavaScript
class ScreenShareApp {
    constructor() {
        this.stream = null;
        this.audioEnabled = false;
        this.videoEnabled = true;
        this.isSharing = false;
        
        // YENİ EKLENEN: URL'den veya localStorage'dan mod belirleme
        const urlParams = new URLSearchParams(window.location.search);
        this.currentMode = urlParams.get('mode') || localStorage.getItem('screenShareMode') || 'viewer';
        
        this.settings = {
            videoQuality: 'medium',
            frameRate: 30,
            autoQuality: true,
            showStats: true,
            autoJoin: false,
            rememberMode: false,
            chatNotifications: true,
            voiceNotifications: true,
            notificationVolume: 50
        };
        this.stats = {
            fps: 0,
            latency: 0,
            bitrate: 0
        };
        this.statsInterval = null;
        
        // Chat and voice properties
        this.chatMessages = [];
        this.voiceParticipants = [];
        this.isInVoiceChat = false;
        this.notificationSound = null;
        this.userId = this.generateUserId();
        
        // WebRTC properties - YENİ EKLENEN
        this.socket = null;
        this.peerConnections = {};
        this.localStream = null;
        this.roomId = this.getRoomIdFromURL();
        
        this.init();
    }

    // YENİ EKLENEN: URL'den room ID alma
    getRoomIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId) {
            return roomId;
        } else {
            // Room ID yoksa otomatik oluştur ve URL'yi güncelle
            const autoRoomId = this.generateRoomId();
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('room', autoRoomId);
            window.history.replaceState({}, '', newUrl);
            return autoRoomId;
        }
    }

    // YENİ EKLENEN: Otomatik room ID oluşturma
    generateRoomId() {
        return 'room_' + Math.random().toString(36).substr(2, 9);
    }

    init() {
        this.loadSettings();
//this.updateModeUI(); // Mod UI'ını güncelle
        this.initSocket(); // YENİ EKLENEN
        this.bindEvents();
        this.checkBrowserSupport();
        this.hideLoadingScreen();
        this.updateStats();
    }

    // YENİ EKLENEN: Socket.IO başlatma
    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Socket.IO bağlandı, Room ID:', this.roomId, 'Mode:', this.currentMode);
            this.joinRoom();
            this.updateRoomInfo();
        });

        this.socket.on('user-joined', (userId, mode) => {
            console.log('Kullanıcı katıldı:', userId, 'Mode:', mode);
            
            // Yayıncı katıldığında izleyicileri bilgilendir
            if (mode === 'broadcaster' && this.currentMode === 'viewer') {
                this.handleBroadcasterJoined(userId);
            }
            
            // İzleyici katıldığında yayıncıyı bilgilendir
            if (mode === 'viewer' && this.currentMode === 'broadcaster' && this.isSharing) {
                this.showNotification('Yeni izleyici katıldı', 'info');
            }
        });

        this.socket.on('offer', (offer, fromId) => {
            this.handleOffer(offer, fromId);
        });

        this.socket.on('answer', (answer, fromId) => {
            this.handleAnswer(answer, fromId);
        });

        this.socket.on('ice-candidate', (candidate, fromId) => {
            this.handleIceCandidate(candidate, fromId);
        });

        this.socket.on('disconnect', () => {
            console.log('Socket.IO bağlantısı kesildi');
        });
    }

    // YENİ EKLENEN: Odaya katılma
    joinRoom() {
        console.log('Odaya katılıyor:', this.roomId, 'Mode:', this.currentMode);
        this.socket.emit('join-room', this.roomId, this.userId, this.currentMode);
    }

    // YENİ EKLENEN: Room bilgisini UI'da gösterme
    updateRoomInfo() {
        const roomInfo = document.getElementById('room-info');
        if (roomInfo) {
            roomInfo.textContent = `Oda: ${this.roomId} | Mod: ${this.currentMode === 'viewer' ? 'İzleyici' : 'Yayıncı'}`;
        }
        
        // URL'yi paylaşılabilir hale getir
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomId}&mode=${this.currentMode}`;
        console.log('Paylaşım URL\'si:', shareUrl);
        
        this.addCopyUrlButton(shareUrl);
    }

    // YENİ EKLENEN: URL kopyalama butonu
    addCopyUrlButton(shareUrl) {
        const headerControls = document.querySelector('.header-controls');
        if (headerControls && !document.getElementById('copy-url-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.id = 'copy-url-btn';
            copyBtn.className = 'btn btn-icon';
            copyBtn.title = 'URL\'yi Kopyala';
            copyBtn.innerHTML = '<i class="fas fa-link"></i>';
            
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(shareUrl).then(() => {
                    this.showNotification('URL kopyalandı!', 'success');
                }).catch(() => {
                    this.showNotification('URL kopyalanamadı', 'error');
                });
            });
            
            headerControls.insertBefore(copyBtn, headerControls.firstChild);
        }
    }

    // YENİ EKLENEN: Yayıncı katıldığında izleyici tarafında çalışır
    async handleBroadcasterJoined(broadcasterId) {
        if (this.currentMode !== 'viewer') return;
        
        try {
            console.log('Yayıncı katıldı, bağlantı kuruluyor...');
            
            // İzleyici olarak peer connection oluştur
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            this.peerConnections[broadcasterId] = peerConnection;

            // Remote stream'i al
            peerConnection.ontrack = (event) => {
                console.log('Remote stream alındı');
                const videoElement = document.getElementById('screen-view');
                videoElement.srcObject = event.streams[0];
                this.isSharing = true;
                this.updateUI();
                this.showNotification('Yayın başladı!', 'success');
            };

            // ICE candidate'ları gönder
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', event.candidate, broadcasterId);
                }
            };

            // Offer gönder
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            this.socket.emit('offer', offer, broadcasterId);

        } catch (error) {
            console.error('Broadcaster bağlantısı hatası:', error);
            this.showNotification('Bağlantı hatası: ' + error.message, 'error');
        }
    }

    // YENİ EKLENEN: Offer alındığında yayıncı tarafında çalışır
    async handleOffer(offer, fromId) {
        if (this.currentMode !== 'broadcaster' || !this.localStream) return;

        try {
            console.log('Offer alındı, yanıt veriliyor...');
            
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            this.peerConnections[fromId] = peerConnection;

            // Local stream'i ekle
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });

            // ICE candidate'ları gönder
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', event.candidate, fromId);
                }
            };

            await peerConnection.setRemoteDescription(offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            this.socket.emit('answer', answer, fromId);

        } catch (error) {
            console.error('Offer işleme hatası:', error);
            this.showNotification('Bağlantı hatası: ' + error.message, 'error');
        }
    }

    // YENİ EKLENEN: Answer işleme
    async handleAnswer(answer, fromId) {
        const peerConnection = this.peerConnections[fromId];
        if (peerConnection) {
            await peerConnection.setRemoteDescription(answer);
        }
    }

    // YENİ EKLENEN: ICE candidate işleme
    async handleIceCandidate(candidate, fromId) {
        const peerConnection = this.peerConnections[fromId];
        if (peerConnection) {
            await peerConnection.addIceCandidate(candidate);
        }
    }

    async startSharing() {
        if (this.currentMode !== 'broadcaster') {
            this.showNotification('Yayıncı modunda olmalısınız', 'error');
            return;
        }

        try {
            this.showStatusOverlay('Ekran paylaşımı başlatılıyor...');
            
            const constraints = this.getVideoConstraints();
            
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: constraints.video,
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000
                }
            });

            this.audioEnabled = this.localStream.getAudioTracks().length > 0;
            
            // Local video element'i güncelle
            const videoElement = document.getElementById('screen-view');
            videoElement.srcObject = this.localStream;
            
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = resolve;
            });

            this.isSharing = true;
            this.updateUI();
            this.hideStatusOverlay();
            
            // Mevcut peer connection'lara stream ekle
            Object.values(this.peerConnections).forEach(pc => {
                this.localStream.getTracks().forEach(track => {
                    pc.addTrack(track, this.localStream);
                });
            });

            this.localStream.getVideoTracks()[0].onended = () => {
                this.stopSharing();
            };

            this.startStatsMonitoring();
            this.showNotification('Ekran paylaşımı başlatıldı!', 'success');
            
        } catch (err) {
            this.hideStatusOverlay();
            this.handleError('Ekran paylaşımı başlatılamadı', err);
        }
    }

    stopSharing() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Peer connection'ları kapat
        Object.values(this.peerConnections).forEach(pc => pc.close());
        this.peerConnections = {};

        const videoElement = document.getElementById('screen-view');
        videoElement.srcObject = null;
        
        this.isSharing = false;
        this.audioEnabled = false;
        this.videoEnabled = true;
        
        this.stopStatsMonitoring();
        this.updateUI();
        
        this.showNotification('Ekran paylaşımı durduruldu', 'info');
    }

    toggleAudio() {
        if (!this.stream) return;
        
        const audioTracks = this.stream.getAudioTracks();
        if (audioTracks.length > 0) {
            this.audioEnabled = !this.audioEnabled;
            audioTracks[0].enabled = this.audioEnabled;
            this.updateAudioButton();
            
            const status = this.audioEnabled ? 'açıldı' : 'kapatıldı';
            this.showNotification(`Ses ${status}`, 'info');
        }
    }

    toggleVideo() {
        if (!this.stream) return;
        
        const videoTracks = this.stream.getVideoTracks();
        if (videoTracks.length > 0) {
            this.videoEnabled = !this.videoEnabled;
            videoTracks[0].enabled = this.videoEnabled;
            this.updateVideoButton();
            
            const status = this.videoEnabled ? 'açıldı' : 'kapatıldı';
            this.showNotification(`Video ${status}`, 'info');
        }
    }

    updateUI() {
        const shareBtn = document.getElementById('share-btn');
        const stopBtn = document.getElementById('stop-btn');
        const toggleAudioBtn = document.getElementById('toggle-audio-btn');
        const toggleVideoBtn = document.getElementById('toggle-video-btn');
        const placeholder = document.getElementById('placeholder');
        const videoControls = document.getElementById('video-controls');
        const statusIndicator = document.querySelector('.status-dot');
        const connectionStatus = document.getElementById('connection-status');
        const statsSection = document.querySelector('.sidebar-section:last-child');

        if (this.isSharing) {
            // Hide placeholder, show video
            placeholder.style.display = 'none';
            videoControls.classList.remove('hidden');
            
            // Update buttons
            shareBtn.disabled = true;
            stopBtn.disabled = false;
            toggleAudioBtn.disabled = !this.audioEnabled;
            toggleVideoBtn.disabled = false;
            
            // Update status
            statusIndicator.classList.add('active');
            connectionStatus.textContent = 'Paylaşım aktif';
            connectionStatus.className = 'status-text text-green-400';
            
            // Show stats if enabled
            if (this.settings.showStats) {
                statsSection.style.display = 'block';
            }
            
        } else {
            // Show placeholder, hide video
            placeholder.style.display = 'flex';
            videoControls.classList.add('hidden');
            
            // Update buttons based on mode
            if (this.currentMode === 'broadcaster') {
                shareBtn.disabled = false;
                stopBtn.disabled = true;
                toggleAudioBtn.disabled = true;
                toggleVideoBtn.disabled = true;
            } else {
                // Viewer mode - hide share button
                shareBtn.classList.add('hidden');
                stopBtn.disabled = true;
                toggleAudioBtn.disabled = true;
                toggleVideoBtn.disabled = true;
            }
            
            // Update status
            statusIndicator.classList.remove('active');
            connectionStatus.textContent = this.currentMode === 'viewer' ? 'Yayın bekleniyor' : 'Bağlantı yok';
            connectionStatus.className = 'status-text';
            
            // Hide stats
            statsSection.style.display = 'none';
        }

        this.updateAudioButton();
        this.updateVideoButton();
    }

    updateAudioButton() {
        const btn = document.getElementById('toggle-audio-btn');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        if (!this.stream) return;
        
        if (this.audioEnabled) {
            icon.className = 'fas fa-microphone';
            text.textContent = 'Ses';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-success');
        } else {
            icon.className = 'fas fa-microphone-slash';
            text.textContent = 'Ses Kapalı';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-secondary');
        }
    }

    updateVideoButton() {
        const btn = document.getElementById('toggle-video-btn');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        if (!this.stream) return;
        
        if (this.videoEnabled) {
            icon.className = 'fas fa-video';
            text.textContent = 'Video';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-success');
        } else {
            icon.className = 'fas fa-video-slash';
            text.textContent = 'Video Kapalı';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-secondary');
        }
    }

    getVideoConstraints() {
        const qualitySettings = {
            high: { width: 1920, height: 1080 },
            medium: { width: 1280, height: 720 },
            low: { width: 854, height: 480 }
        };

        return {
            video: {
                displaySurface: 'monitor',
                logicalSurface: true,
                cursor: 'always',
                frameRate: { ideal: this.settings.frameRate },
                ...qualitySettings[this.settings.videoQuality]
            }
        };
    }

    openSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        
        if (key === 'showStats') {
            const statsSection = document.querySelector('.sidebar-section:last-child');
            statsSection.style.display = value ? 'block' : 'none';
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('screenshare-settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        
        // Update form values
        document.getElementById('video-quality').value = this.settings.videoQuality;
        document.getElementById('frame-rate').value = this.settings.frameRate;
        document.getElementById('auto-quality').checked = this.settings.autoQuality;
        document.getElementById('show-stats').checked = this.settings.showStats;
        document.getElementById('auto-join').checked = this.settings.autoJoin;
        document.getElementById('remember-mode').checked = this.settings.rememberMode;
        document.getElementById('chat-notifications').checked = this.settings.chatNotifications;
        document.getElementById('voice-notifications').checked = this.settings.voiceNotifications;
        document.getElementById('notification-volume').value = this.settings.notificationVolume;
        document.getElementById('volume-display').textContent = this.settings.notificationVolume + '%';
    }

    saveSettings() {
        localStorage.setItem('screenshare-settings', JSON.stringify(this.settings));
    }

    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            const shareBtn = document.getElementById('share-btn');
            shareBtn.disabled = true;
            shareBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Tarayıcı Desteklenmiyor';
            shareBtn.classList.add('btn-danger');
            
            this.showNotification('Tarayıcınız ekran paylaşımını desteklemiyor. Chrome, Edge veya Firefox kullanın.', 'error');
        }
    }

    startStatsMonitoring() {
        if (!this.settings.showStats) return;
        
        this.statsInterval = setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    stopStatsMonitoring() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }

    updateStats() {
        if (!this.stream || !this.settings.showStats) return;

        // Simulate stats (in real app, you'd get these from WebRTC stats)
        this.stats.fps = Math.floor(Math.random() * 30) + 20;
        this.stats.latency = Math.floor(Math.random() * 200) + 50;
        this.stats.bitrate = Math.floor(Math.random() * 5000) + 2000;

        document.getElementById('fps-counter').textContent = this.stats.fps;
        document.getElementById('latency-counter').textContent = `${this.stats.latency}ms`;
        document.getElementById('bitrate-counter').textContent = `${(this.stats.bitrate / 1000).toFixed(1)}k`;

        // Update quality indicator
        const qualityLevel = document.getElementById('quality-level');
        const qualityText = document.getElementById('quality-text');
        
        if (this.stats.fps > 25 && this.stats.latency < 100) {
            qualityLevel.style.width = '100%';
            qualityText.textContent = 'Kalite: Mükemmel';
        } else if (this.stats.fps > 20 && this.stats.latency < 200) {
            qualityLevel.style.width = '75%';
            qualityText.textContent = 'Kalite: İyi';
        } else if (this.stats.fps > 15 && this.stats.latency < 300) {
            qualityLevel.style.width = '50%';
            qualityText.textContent = 'Kalite: Orta';
        } else {
            qualityLevel.style.width = '25%';
            qualityText.textContent = 'Kalite: Düşük';
        }
    }

    toggleFullscreen() {
        const videoContainer = document.querySelector('.video-container');
        
        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen().catch(err => {
                this.showNotification('Tam ekran modu başlatılamadı', 'error');
            });
        } else {
            document.exitFullscreen();
        }
    }

    showStatusOverlay(message) {
        const overlay = document.getElementById('status-overlay');
        const messageSpan = overlay.querySelector('span');
        messageSpan.textContent = message;
        overlay.classList.remove('hidden');
    }

    hideStatusOverlay() {
        document.getElementById('status-overlay').classList.add('hidden');
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    handleError(message, error) {
        console.error(message, error);
        this.showNotification(`${message}: ${error.message}`, 'error');
    }

    handleKeyboard(e) {
        // Escape key closes modals
        if (e.key === 'Escape') {
            this.closeSettings();
        }
        
        // Space key toggles play/pause (if video is playing)
        if (e.key === ' ' && this.isSharing) {
            e.preventDefault();
            const video = document.getElementById('screen-view');
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        }
        
        // F11 for fullscreen
        if (e.key === 'F11' && this.isSharing) {
            e.preventDefault();
            this.toggleFullscreen();
        }
    }

    handleVisibilityChange() {
        if (document.hidden && this.isSharing) {
            this.showNotification('Sekme arka planda çalışıyor', 'warning');
        }
    }

    handleResize() {
        // Update video container aspect ratio on mobile
        if (window.innerWidth <= 768) {
            const videoContainer = document.querySelector('.video-container');
            videoContainer.style.aspectRatio = '16/10';
        }
    }

    hideLoadingScreen() {
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 1000);
    }

    // Chat Methods
    toggleChat() {
        const container = document.getElementById('chat-container');
        const icon = document.querySelector('#toggle-chat i');
        
        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-down';
        } else {
            container.classList.add('collapsed');
            icon.className = 'fas fa-chevron-up';
        }
    }

    toggleVoice() {
        const container = document.getElementById('voice-container');
        const icon = document.querySelector('#toggle-voice i');
        
        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-down';
        } else {
            container.classList.add('collapsed');
            icon.className = 'fas fa-chevron-up';
        }
    }

    toggleInfo() {
        const container = document.getElementById('info-container');
        const icon = document.querySelector('#toggle-info i');
        
        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-down';
        } else {
            container.classList.add('collapsed');
            icon.className = 'fas fa-chevron-up';
        }
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (message) {
            this.addChatMessage(this.userId, message, true);
            input.value = '';
            
            // In real app, this would send to server for other users
            // For now, just send locally
        }
    }

    addChatMessage(userId, message, isOwn = false) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
        
        const time = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="chat-message-header">
                <span class="chat-message-user">${userId}</span>
                <span class="chat-message-time">${time}</span>
            </div>
            <div class="chat-message-text">${message}</div>
        `;
        
        // Remove welcome message if exists
        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) {
            welcome.remove();
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Play notification sound if enabled and not own message
        if (!isOwn && this.settings.chatNotifications) {
            this.playNotificationSound();
        }
    }

    joinVoiceChat() {
        this.isInVoiceChat = true;
        this.updateVoiceUI();
        this.addVoiceParticipant(this.userId);
        this.showNotification('Sesli chat\'e katıldınız', 'success');
    }

    leaveVoiceChat() {
        this.isInVoiceChat = false;
        this.updateVoiceUI();
        this.removeVoiceParticipant(this.userId);
        this.showNotification('Sesli chat\'ten ayrıldınız', 'info');
    }

    updateVoiceUI() {
        const joinBtn = document.getElementById('join-voice');
        const leaveBtn = document.getElementById('leave-voice');
        const indicator = document.querySelector('.voice-indicator');
        const icon = indicator.querySelector('i');
        const text = indicator.querySelector('span');
        
        if (this.isInVoiceChat) {
            joinBtn.classList.add('hidden');
            leaveBtn.classList.remove('hidden');
            indicator.classList.add('connected');
            icon.className = 'fas fa-microphone';
            text.textContent = 'Ses açık';
        } else {
            joinBtn.classList.remove('hidden');
            leaveBtn.classList.add('hidden');
            indicator.classList.remove('connected');
            icon.className = 'fas fa-microphone-slash';
            text.textContent = 'Ses kapalı';
        }
    }

    addVoiceParticipant(userId) {
        const participants = document.getElementById('voice-participants');
        const noParticipants = participants.querySelector('.no-participants');
        
        if (noParticipants) {
            noParticipants.remove();
        }
        
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant-item';
        participantDiv.id = `participant-${userId}`;
        
        participantDiv.innerHTML = `
            <div class="participant-status"></div>
            <span class="participant-name">${userId}</span>
        `;
        
        participants.appendChild(participantDiv);
    }

    removeVoiceParticipant(userId) {
        const participant = document.getElementById(`participant-${userId}`);
        if (participant) {
            participant.remove();
        }
        
        // Show no participants message if empty
        const participants = document.getElementById('voice-participants');
        if (participants.children.length === 0) {
            participants.innerHTML = '<p class="no-participants">Henüz kimse sese katılmadı</p>';
        }
    }

    generateUserId() {
        return 'Kullanıcı_' + Math.random().toString(36).substr(2, 6);
    }

    playNotificationSound() {
        // Create a simple notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.settings.notificationVolume / 100, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    }

    updateNotificationVolume(value) {
        this.settings.notificationVolume = parseInt(value);
        document.getElementById('volume-display').textContent = value + '%';
        this.saveSettings();
    }

    // YENİ EKLENEN: URL'ye mode parametresi ekleme
    updateURLWithMode(mode) {
        const url = new URL(window.location);
        url.searchParams.set('mode', mode);
        window.history.replaceState({}, '', url);
    }

    // YENİ EKLENEN: URL'den mode parametresini alma
    getModeFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('mode');
    }

    setMode(mode) {
        this.currentMode = mode;
        
        // YENİ EKLENEN: localStorage'a kaydet
        localStorage.setItem('screenShareMode', mode);
        
        // YENİ EKLENEN: URL'yi güncelle
        const url = new URL(window.location);
        url.searchParams.set('mode', mode);
        window.history.replaceState({}, '', url);
        
        this.updateModeUI();
        this.loadInstructions();
        this.updatePlaceholder();
        
        // Socket.IO bağlantısını yeniden başlat
        if (this.socket && this.socket.connected) {
            this.socket.disconnect();
            this.initSocket();
        }
        
        // Hide mode selection modal
        document.getElementById('mode-modal').classList.add('hidden');
        document.body.style.overflow = '';
        
        // Show notification
        const modeText = mode === 'viewer' ? 'İzleyici' : 'Yayıncı';
        this.showNotification(`${modeText} moduna geçildi`, 'success');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScreenShareApp();
});

// Service Worker for PWA support (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Add touch support for mobile
document.addEventListener('touchstart', function() {}, {passive: true});

// Prevent zoom on double tap (mobile)
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false); 
