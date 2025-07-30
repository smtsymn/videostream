// ScreenShare Pro - Main JavaScript
class ScreenShareApp {
    constructor() {
        this.stream = null;
        this.audioEnabled = false;
        this.videoEnabled = true;
        this.isSharing = false;
        this.currentMode = null; // 'viewer' veya 'broadcaster'
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
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.checkSavedMode();
        this.bindEvents();
        this.checkBrowserSupport();
        this.hideLoadingScreen();
        this.updateStats();
    }

    checkSavedMode() {
        const savedMode = localStorage.getItem('screenshare-mode');
        const rememberMode = localStorage.getItem('screenshare-remember-mode') === 'true';
        
        if (savedMode && rememberMode) {
            this.setMode(savedMode);
        } else {
            this.showModeSelection();
        }
    }

    showModeSelection() {
        document.getElementById('mode-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    setMode(mode) {
        this.currentMode = mode;
        this.updateModeUI();
        this.loadInstructions();
        this.updatePlaceholder();
        
        // Save mode if remember is checked
        if (this.settings.rememberMode) {
            localStorage.setItem('screenshare-mode', mode);
            localStorage.setItem('screenshare-remember-mode', 'true');
        }
        
        // Hide mode selection modal
        document.getElementById('mode-modal').classList.add('hidden');
        document.body.style.overflow = '';
        
        // Show notification
        const modeText = mode === 'viewer' ? 'İzleyici' : 'Yayıncı';
        this.showNotification(`${modeText} moduna geçildi`, 'success');
    }

    updateModeUI() {
        const modeBadge = document.getElementById('mode-badge');
        const switchModeBtn = document.getElementById('switch-mode-btn');
        
        if (this.currentMode) {
            modeBadge.textContent = this.currentMode === 'viewer' ? 'İzleyici' : 'Yayıncı';
            modeBadge.className = `mode-badge ${this.currentMode}`;
            modeBadge.classList.remove('hidden');
            
            // Update switch mode button icon
            const icon = switchModeBtn.querySelector('i');
            icon.className = this.currentMode === 'viewer' ? 'fas fa-broadcast-tower' : 'fas fa-eye';
            switchModeBtn.title = this.currentMode === 'viewer' ? 'Yayıncı Moduna Geç' : 'İzleyici Moduna Geç';
        } else {
            modeBadge.classList.add('hidden');
        }
    }

    updatePlaceholder() {
        const placeholderTitle = document.getElementById('placeholder-title');
        const placeholderDescription = document.getElementById('placeholder-description');
        const shareBtn = document.getElementById('share-btn');
        const viewerWaiting = document.getElementById('viewer-waiting');
        
        if (this.currentMode === 'viewer') {
            placeholderTitle.textContent = 'Yayın Bekleniyor';
            placeholderDescription.textContent = 'Yayıncı bağlandığında otomatik olarak yayın başlayacak';
            shareBtn.classList.add('hidden');
            viewerWaiting.classList.remove('hidden');
        } else {
            placeholderTitle.textContent = 'Ekran Paylaşımı Başlatın';
            placeholderDescription.textContent = 'Profesyonel ekran paylaşımı için aşağıdaki butona tıklayın';
            shareBtn.classList.remove('hidden');
            viewerWaiting.classList.add('hidden');
        }
    }

    loadInstructions() {
        const infoContent = document.getElementById('info-content');
        
        if (this.currentMode === 'viewer') {
            infoContent.innerHTML = `
                <div class="instruction-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Yayın Bekleyin</h4>
                        <p>Yayıncı bağlandığında otomatik olarak yayın başlar</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>İzleyin</h4>
                        <p>Paylaşılan ekranı gerçek zamanlı olarak izleyin</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Chat Yapın</h4>
                        <p>Diğer kullanıcılarla mesajlaşın</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>Sese Katılın</h4>
                        <p>İsterseniz sesli chat'e katılın</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">5</div>
                    <div class="step-content">
                        <h4>Mod Değiştirin</h4>
                        <p>İsterseniz yayıncı moduna geçerek kendi paylaşımınızı yapın</p>
                    </div>
                </div>
            `;
        } else {
            infoContent.innerHTML = `
                <div class="instruction-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Ekran Paylaş</h4>
                        <p>Ana butona tıklayarak paylaşımı başlatın</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Paylaşım Seçin</h4>
                        <p>Ekran, pencere veya sekme seçin</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Ses Ekle</h4>
                        <p>İsteğe bağlı olarak sistem sesini dahil edin</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>İzleyicilerle Etkileşim</h4>
                        <p>Chat ve sesli chat ile izleyicilerle iletişim kurun</p>
                    </div>
                </div>
                <div class="instruction-step">
                    <div class="step-number">5</div>
                    <div class="step-content">
                        <h4>Kontrol Et</h4>
                        <p>Alt kontrollerle ses ve videoyu yönetin</p>
                    </div>
                </div>
            `;
        }
    }

    bindEvents() {
        // Mode selection
        document.querySelectorAll('.mode-option').forEach(option => {
            option.addEventListener('click', () => {
                const mode = option.dataset.mode;
                this.setMode(mode);
            });
        });

        // Remember mode checkbox
        document.getElementById('remember-mode').addEventListener('change', (e) => {
            this.settings.rememberMode = e.target.checked;
            this.saveSettings();
        });

        // Switch mode button
        document.getElementById('switch-mode-btn').addEventListener('click', () => {
            this.showModeSelection();
        });

        // Chat events
        document.getElementById('toggle-chat').addEventListener('click', () => this.toggleChat());
        document.getElementById('send-chat').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // Voice chat events
        document.getElementById('toggle-voice').addEventListener('click', () => this.toggleVoice());
        document.getElementById('join-voice').addEventListener('click', () => this.joinVoiceChat());
        document.getElementById('leave-voice').addEventListener('click', () => this.leaveVoiceChat());

        // Info toggle
        document.getElementById('toggle-info').addEventListener('click', () => this.toggleInfo());

        // Main buttons
        document.getElementById('share-btn').addEventListener('click', () => this.startSharing());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopSharing());
        document.getElementById('toggle-audio-btn').addEventListener('click', () => this.toggleAudio());
        document.getElementById('toggle-video-btn').addEventListener('click', () => this.toggleVideo());
        
        // Settings
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.getElementById('close-settings').addEventListener('click', () => this.closeSettings());
        
        // Video controls
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('quality-btn').addEventListener('click', () => this.openSettings());
        
        // Settings form
        document.getElementById('video-quality').addEventListener('change', (e) => this.updateSetting('videoQuality', e.target.value));
        document.getElementById('frame-rate').addEventListener('change', (e) => this.updateSetting('frameRate', parseInt(e.target.value)));
        document.getElementById('auto-quality').addEventListener('change', (e) => this.updateSetting('autoQuality', e.target.checked));
        document.getElementById('show-stats').addEventListener('change', (e) => this.updateSetting('showStats', e.target.checked));
        document.getElementById('auto-join').addEventListener('change', (e) => this.updateSetting('autoJoin', e.target.checked));
        document.getElementById('chat-notifications').addEventListener('change', (e) => this.updateSetting('chatNotifications', e.target.checked));
        document.getElementById('voice-notifications').addEventListener('change', (e) => this.updateSetting('voiceNotifications', e.target.checked));
        document.getElementById('notification-volume').addEventListener('input', (e) => this.updateNotificationVolume(e.target.value));
        
        // Modal backdrop click
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') {
                this.closeSettings();
            }
        });

        document.getElementById('mode-modal').addEventListener('click', (e) => {
            if (e.target.id === 'mode-modal') {
                // Don't close mode modal on backdrop click - user must choose
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Visibility change (when user switches tabs)
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    async startSharing() {
        // Only allow sharing in broadcaster mode
        if (this.currentMode !== 'broadcaster') {
            this.showNotification('Yayıncı modunda olmalısınız', 'error');
            return;
        }

        try {
            this.showStatusOverlay('Ekran paylaşımı başlatılıyor...');
            
            const constraints = this.getVideoConstraints();
            
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: constraints.video,
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000
                }
            });

            // Check if audio is being captured
            this.audioEnabled = this.stream.getAudioTracks().length > 0;
            
            // Set up video element
            const videoElement = document.getElementById('screen-view');
            videoElement.srcObject = this.stream;
            
            // Wait for video to load
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = resolve;
            });

            this.isSharing = true;
            this.updateUI();
            this.hideStatusOverlay();
            
            // Handle when user stops sharing via browser UI
            this.stream.getVideoTracks()[0].onended = () => {
                this.stopSharing();
            };

            // Start stats monitoring
            this.startStatsMonitoring();
            
            this.showNotification('Ekran paylaşımı başlatıldı!', 'success');
            console.log('Screen sharing started:', this.stream);
            
        } catch (err) {
            this.hideStatusOverlay();
            this.handleError('Ekran paylaşımı başlatılamadı', err);
        }
    }

    stopSharing() {
        if (!this.stream) return;

        // Stop all tracks
        this.stream.getTracks().forEach(track => track.stop());
        
        // Clear video element
        const videoElement = document.getElementById('screen-view');
        videoElement.srcObject = null;
        
        // Reset state
        this.stream = null;
        this.isSharing = false;
        this.audioEnabled = false;
        this.videoEnabled = true;
        
        // Stop stats monitoring
        this.stopStatsMonitoring();
        
        // Update UI
        this.updateUI();
        
        this.showNotification('Ekran paylaşımı durduruldu', 'info');
        console.log('Screen sharing stopped');
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