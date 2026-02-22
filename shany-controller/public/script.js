const socket = io();
let gamepadIndex = null;
let currentRoomName = null;
let isHost = false;
let localElasticMode = false;
let remoteElasticMode = false;
let phoneVibrateMode = false;

// 震动循环相关
let localVibrationInterval = null;
let remoteVibrationInterval = null;
let currentLocalValues = { left: 0, right: 0 };
let currentRemoteValues = { left: 0, right: 0 };

// DOM 元素
const logBox = document.getElementById('log-box');
const statusBadge = document.getElementById('gamepad-status');
const roomStatusBadge = document.getElementById('room-status');
const roomListDiv = document.getElementById('room-list');
const remoteControllerDiv = document.getElementById('remote-controller');
const roomClosePanel = document.getElementById('room-close-panel');
const closeCountdownEl = document.getElementById('close-countdown');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    window.addEventListener("gamepadconnected", handleConnect);
    window.addEventListener("gamepaddisconnected", handleDisconnect);
    initRoomClosePanel();
    initRoomToggle();
    initVibrateTargetToggle();
    initLocalControl();
    initRemoteControl();
});

// === 日志与弹窗系统 ===
function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = `<span style="opacity:0.6">[${time}]</span> ${msg}`;
    logBox.insertBefore(div, logBox.firstChild);
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// === 主题切换 ===
function initTheme() {
    const btn = document.getElementById('theme-toggle');
    const icon = btn.querySelector('i');
    let isDark = false;

    btn.addEventListener('click', () => {
        isDark = !isDark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    });
}

// === 房间功能展开/收起 ===
function initRoomToggle() {
    const toggleBtn = document.getElementById('btn-toggle-room');
    const roomContent = document.getElementById('room-content');
    const btnText = toggleBtn.querySelector('span');
    const btnIcon = toggleBtn.querySelector('i');

    toggleBtn.addEventListener('click', () => {
        const isCollapsed = roomContent.classList.contains('collapsed');
        
        if (isCollapsed) {
            roomContent.classList.remove('collapsed');
            toggleBtn.classList.remove('collapsed');
            btnText.textContent = '收起房间功能';
            btnIcon.className = 'fas fa-chevron-up';
        } else {
            roomContent.classList.add('collapsed');
            toggleBtn.classList.add('collapsed');
            btnText.textContent = '展开房间功能';
            btnIcon.className = 'fas fa-chevron-down';
        }
    });
}

// === 震动目标切换 ===
function initVibrateTargetToggle() {
    const toggle = document.getElementById('vibrate-target-mode');
    const hint = document.getElementById('vibrate-target-hint');

    toggle.addEventListener('change', (e) => {
        phoneVibrateMode = e.target.checked;
        hint.textContent = phoneVibrateMode ? '当前：手机震动' : '当前：手柄震动';
        addLog(phoneVibrateMode ? '已切换为手机震动模式' : '已切换为手柄震动模式');

        if (phoneVibrateMode) {
            stopVibration();
        } else {
            stopPhoneVibration();
        }
    });
}

// === 手机震动 API ===
function triggerPhoneVibration(strong, weak) {
    if (navigator.vibrate) {
        const intensity = Math.max(strong, weak);
        if (intensity > 0) {
            navigator.vibrate(Math.round(intensity * 200));
        }
    }
}

function stopPhoneVibration() {
    if (navigator.vibrate) {
        navigator.vibrate(0);
    }
}

// === 房间关闭倒计时面板 ===
function initRoomClosePanel() {
    const keepAliveBtn = document.getElementById('btn-keep-alive');
    
    keepAliveBtn.addEventListener('click', () => {
        if (currentRoomName && isHost) {
            socket.emit('resetRoomCloseTimer', { roomName: currentRoomName });
        }
    });
}

function formatCountdown(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showRoomClosePanel() {
    roomClosePanel.classList.remove('hidden');
}

function hideRoomClosePanel() {
    roomClosePanel.classList.add('hidden');
}

// === 本地控制初始化 ===
function initLocalControl() {
    const leftSlider = document.getElementById('local-left');
    const rightSlider = document.getElementById('local-right');
    const leftValue = document.getElementById('local-left-value');
    const rightValue = document.getElementById('local-right-value');
    const elasticMode = document.getElementById('local-elastic-mode');
    const maxBtn = document.getElementById('btn-max-vibrate');
    const stopBtn = document.getElementById('btn-stop-vibrate');

    const updateValues = () => {
        leftValue.textContent = leftSlider.value + '%';
        rightValue.textContent = rightSlider.value + '%';
    };

    // 持续震动函数 - 使用setInterval确保持续震动
    const startLocalVibration = () => {
        if (localVibrationInterval) return;
        
        localVibrationInterval = setInterval(() => {
            const leftVal = currentLocalValues.left;
            const rightVal = currentLocalValues.right;
            
            if (leftVal > 0 || rightVal > 0) {
                if (phoneVibrateMode) {
                    triggerPhoneVibration(leftVal, rightVal);
                } else if (gamepadIndex !== null) {
                    triggerVibration(leftVal, rightVal);
                }
            }
        }, 50); // 每50ms触发一次，确保持续震动
    };

    const stopLocalVibration = () => {
        if (localVibrationInterval) {
            clearInterval(localVibrationInterval);
            localVibrationInterval = null;
        }
    };

    elasticMode.addEventListener('change', (e) => {
        localElasticMode = e.target.checked;
        addLog(localElasticMode ? '本地弹性模式已开启' : '本地弹性模式已关闭');
        
        if (!localElasticMode) {
            // 非弹性模式：持续震动
            startLocalVibration();
        } else {
            // 弹性模式：停止持续震动，由input事件控制
            stopLocalVibration();
        }
    });

    // 左马达滑块控制
    leftSlider.addEventListener('input', () => {
        updateValues();
        const value = parseInt(leftSlider.value) / 100;
        currentLocalValues.left = value;
        
        if (phoneVibrateMode || gamepadIndex !== null) {
            // 立即触发震动
            if (phoneVibrateMode) {
                triggerPhoneVibration(currentLocalValues.left, currentLocalValues.right);
            } else {
                triggerVibration(currentLocalValues.left, currentLocalValues.right);
            }
            
            // 如果不是持续震动模式，启动持续震动
            if (!localVibrationInterval && !localElasticMode) {
                startLocalVibration();
            }
        }
    });

    // 右马达滑块控制
    rightSlider.addEventListener('input', () => {
        updateValues();
        const value = parseInt(rightSlider.value) / 100;
        currentLocalValues.right = value;
        
        if (phoneVibrateMode || gamepadIndex !== null) {
            // 立即触发震动
            if (phoneVibrateMode) {
                triggerPhoneVibration(currentLocalValues.left, currentLocalValues.right);
            } else {
                triggerVibration(currentLocalValues.left, currentLocalValues.right);
            }
            
            // 如果不是持续震动模式，启动持续震动
            if (!localVibrationInterval && !localElasticMode) {
                startLocalVibration();
            }
        }
    });

    // 弹性回弹 - 左马达
    leftSlider.addEventListener('change', () => {
        if (localElasticMode) {
            leftSlider.value = 0;
            updateValues();
            currentLocalValues.left = 0;
            
            if (currentLocalValues.right === 0) {
                phoneVibrateMode ? stopPhoneVibration() : stopVibration();
            } else if (phoneVibrateMode) {
                triggerPhoneVibration(0, currentLocalValues.right);
            } else {
                triggerVibration(0, currentLocalValues.right);
            }
            addLog('左马达已回弹停止');
        }
    });

    // 弹性回弹 - 右马达
    rightSlider.addEventListener('change', () => {
        if (localElasticMode) {
            rightSlider.value = 0;
            updateValues();
            currentLocalValues.right = 0;
            
            if (currentLocalValues.left === 0) {
                phoneVibrateMode ? stopPhoneVibration() : stopVibration();
            } else if (phoneVibrateMode) {
                triggerPhoneVibration(currentLocalValues.left, 0);
            } else {
                triggerVibration(currentLocalValues.left, 0);
            }
            addLog('右马达已回弹停止');
        }
    });

    // 一键最大震动
    maxBtn.addEventListener('click', () => {
        leftSlider.value = 100;
        rightSlider.value = 100;
        updateValues();
        currentLocalValues.left = 1;
        currentLocalValues.right = 1;
        
        // 启动持续震动
        if (!localVibrationInterval) {
            startLocalVibration();
        }
        
        if (phoneVibrateMode) {
            triggerPhoneVibration(1, 1);
        } else {
            triggerVibration(1, 1);
        }
        addLog('本地触发：一键最大震动');
    });

    // 一键关闭震动
    stopBtn.addEventListener('click', () => {
        leftSlider.value = 0;
        rightSlider.value = 0;
        updateValues();
        currentLocalValues.left = 0;
        currentLocalValues.right = 0;
        
        stopLocalVibration();
        phoneVibrateMode ? stopPhoneVibration() : stopVibration();
        addLog('本地震动已停止');
    });

    // 默认启动持续震动（非弹性模式）
    startLocalVibration();
}

// === Gamepad API ===
function handleConnect(e) {
    gamepadIndex = e.gamepad.index;
    statusBadge.className = 'status-box connected';
    statusBadge.innerHTML = '<i class="fas fa-check-circle"></i><span>已连接手柄</span>';
    addLog(`手柄已连接: ${e.gamepad.id}`);
}

function handleDisconnect(e) {
    gamepadIndex = null;
    statusBadge.className = 'status-box disconnected';
    statusBadge.innerHTML = '<i class="fas fa-times-circle"></i><span>未连接手柄</span>';
    addLog("手柄已断开");
}

function triggerVibration(strong, weak) {
    if (gamepadIndex !== null) {
        const gp = navigator.getGamepads()[gamepadIndex];
        if (gp && gp.vibrationActuator) {
            // 使用较长的duration确保持续震动，强度直接传入
            gp.vibrationActuator.playEffect("dual-rumble", {
                startDelay: 0,
                duration: 1000, // 增加到1000ms，确保持续感
                weakMagnitude: weak,
                strongMagnitude: strong
            });
        }
    }
}

function stopVibration() {
    if (gamepadIndex !== null) {
        const gp = navigator.getGamepads()[gamepadIndex];
        if (gp && gp.vibrationActuator) {
            gp.vibrationActuator.playEffect("dual-rumble", {
                startDelay: 0,
                duration: 0,
                weakMagnitude: 0,
                strongMagnitude: 0
            });
        }
    }
}

// === Socket.io (远程控制) ===
document.getElementById('btn-create').addEventListener('click', () => {
    const name = document.getElementById('create-name').value;
    const pass = document.getElementById('create-pass').value;
    const isPublic = document.getElementById('create-public').checked;
    
    if(!name) return showToast('请输入房间名', 'error');
    socket.emit('createRoom', { roomName: name, password: pass, isPublic });
});

document.getElementById('btn-join').addEventListener('click', () => {
    const name = document.getElementById('join-name').value;
    const pass = document.getElementById('join-pass').value;
    
    if(!name) return showToast('请填写房间名', 'error');
    socket.emit('joinRoom', { roomName: name, password: pass });
});

socket.on('showToast', (msg, type) => showToast(msg, type));
socket.on('logUpdate', (msg) => addLog(msg));

socket.on('roomJoined', ({ roomName, isHost: hostStatus }) => {
    currentRoomName = roomName;
    isHost = hostStatus;
    roomStatusBadge.className = 'status-box connected';
    roomStatusBadge.innerHTML = `<i class="fas fa-check-circle"></i><span>房间: ${roomName}</span>`;
    addLog(`成功加入房间: ${roomName} ${hostStatus ? '(房主)' : ''}`);
    remoteControllerDiv.classList.remove('hidden');
    
    // 自动收起房间功能
    const roomContent = document.getElementById('room-content');
    const toggleBtn = document.getElementById('btn-toggle-room');
    const btnText = toggleBtn.querySelector('span');
    const btnIcon = toggleBtn.querySelector('i');
    roomContent.classList.add('collapsed');
    toggleBtn.classList.add('collapsed');
    btnText.textContent = '展开房间功能';
    btnIcon.className = 'fas fa-chevron-down';
    
    if (hostStatus) showRoomClosePanel();
});

socket.on('becameHost', () => {
    isHost = true;
    addLog('你已成为新房主');
    showRoomClosePanel();
});

socket.on('roomClosingSoon', ({ minutes, seconds }) => {
    if (isHost) {
        showRoomClosePanel();
        closeCountdownEl.textContent = formatCountdown(seconds);
        showToast(`房间将在${minutes}分钟后关闭`, 'warning');
    }
});

socket.on('roomCloseCountdown', ({ seconds }) => {
    if (isHost) closeCountdownEl.textContent = formatCountdown(seconds);
});

socket.on('roomClosingWarning', ({ minutes }) => {
    if (isHost) showToast(`房间将在${minutes}分钟后关闭`, 'warning');
});

socket.on('roomCloseCancelled', () => {
    hideRoomClosePanel();
    addLog('房间关闭倒计时已取消');
});

socket.on('roomClosed', (msg) => {
    showToast(msg, 'error');
    addLog(msg);
    resetRoomState();
});

socket.on('forceLeaveRoom', () => {
    resetRoomState();
    showToast('房间已关闭', 'error');
});

function resetRoomState() {
    currentRoomName = null;
    isHost = false;
    roomStatusBadge.className = 'status-box disconnected';
    roomStatusBadge.innerHTML = '<i class="fas fa-times-circle"></i><span>未加入房间</span>';
    remoteControllerDiv.classList.add('hidden');
    hideRoomClosePanel();
    
    const roomContent = document.getElementById('room-content');
    const toggleBtn = document.getElementById('btn-toggle-room');
    const btnText = toggleBtn.querySelector('span');
    const btnIcon = toggleBtn.querySelector('i');
    roomContent.classList.remove('collapsed');
    toggleBtn.classList.remove('collapsed');
    btnText.textContent = '收起房间功能';
    btnIcon.className = 'fas fa-chevron-up';
}

socket.on('updateRoomList', (rooms) => {
    roomListDiv.innerHTML = '';
    if(rooms.length === 0) {
        roomListDiv.innerHTML = '<div class="empty-list">暂无公开房间</div>';
        return;
    }
    
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        div.innerHTML = `
            <span>${room.name} ${room.hasPassword ? '<i class="fas fa-lock room-lock"></i>' : ''}</span>
            <span><i class="fas fa-user"></i> ${room.count}/2</span>
        `;
        div.onclick = () => {
            document.getElementById('join-name').value = room.name;
            if(!room.hasPassword) {
                document.getElementById('join-pass').value = '';
                document.getElementById('btn-join').click();
            } else {
                document.getElementById('join-pass').focus();
                showToast('该房间需要密码', 'error');
            }
        };
        roomListDiv.appendChild(div);
    });
});

// 远程控制器
function initRemoteControl() {
    const leftSlider = document.getElementById('remote-left');
    const rightSlider = document.getElementById('remote-right');
    const leftValue = document.getElementById('remote-left-value');
    const rightValue = document.getElementById('remote-right-value');
    const elasticMode = document.getElementById('remote-elastic-mode');
    const maxBtn = document.getElementById('btn-remote-max');
    const stopBtn = document.getElementById('btn-remote-stop');

    const updateValues = () => {
        leftValue.textContent = leftSlider.value + '%';
        rightValue.textContent = rightSlider.value + '%';
    };

    const sendRemoteVibration = () => {
        if (currentRoomName) {
            socket.emit('remoteVibrate', {
                roomName: currentRoomName,
                strong: currentRemoteValues.left,
                weak: currentRemoteValues.right
            });
        }
    };

    // 持续震动函数
    const startRemoteVibration = () => {
        if (remoteVibrationInterval) return;
        
        remoteVibrationInterval = setInterval(() => {
            if (currentRoomName) {
                const leftVal = currentRemoteValues.left;
                const rightVal = currentRemoteValues.right;
                
                if (leftVal > 0 || rightVal > 0) {
                    sendRemoteVibration();
                }
            }
        }, 50); // 每50ms发送一次
    };

    const stopRemoteVibration = () => {
        if (remoteVibrationInterval) {
            clearInterval(remoteVibrationInterval);
            remoteVibrationInterval = null;
        }
    };

    elasticMode.addEventListener('change', (e) => {
        remoteElasticMode = e.target.checked;
        addLog(remoteElasticMode ? '远程弹性模式已开启' : '远程弹性模式已关闭');
        
        if (!remoteElasticMode) {
            startRemoteVibration();
        } else {
            stopRemoteVibration();
        }
    });

    // 左马达滑块
    leftSlider.addEventListener('input', () => {
        updateValues();
        const value = parseInt(leftSlider.value) / 100;
        currentRemoteValues.left = value;
        
        if (currentRoomName) {
            // 立即发送
            sendRemoteVibration();
            
            // 如果不是持续震动模式，启动持续震动
            if (!remoteVibrationInterval && !remoteElasticMode) {
                startRemoteVibration();
            }
        }
    });

    // 右马达滑块
    rightSlider.addEventListener('input', () => {
        updateValues();
        const value = parseInt(rightSlider.value) / 100;
        currentRemoteValues.right = value;
        
        if (currentRoomName) {
            // 立即发送
            sendRemoteVibration();
            
            // 如果不是持续震动模式，启动持续震动
            if (!remoteVibrationInterval && !remoteElasticMode) {
                startRemoteVibration();
            }
        }
    });

    // 弹性回弹 - 左马达
    leftSlider.addEventListener('change', () => {
        if (remoteElasticMode && currentRoomName) {
            leftSlider.value = 0;
            updateValues();
            currentRemoteValues.left = 0;
            
            socket.emit('remoteVibrate', {
                roomName: currentRoomName,
                strong: 0,
                weak: currentRemoteValues.right
            });
            
            addLog('远程左马达已回弹停止');
        }
    });

    // 弹性回弹 - 右马达
    rightSlider.addEventListener('change', () => {
        if (remoteElasticMode && currentRoomName) {
            rightSlider.value = 0;
            updateValues();
            currentRemoteValues.right = 0;
            
            socket.emit('remoteVibrate', {
                roomName: currentRoomName,
                strong: currentRemoteValues.left,
                weak: 0
            });
            
            addLog('远程右马达已回弹停止');
        }
    });

    // 一键最大震动
    maxBtn.addEventListener('click', () => {
        if (currentRoomName) {
            leftSlider.value = 100;
            rightSlider.value = 100;
            updateValues();
            currentRemoteValues.left = 1;
            currentRemoteValues.right = 1;
            
            if (!remoteVibrationInterval) {
                startRemoteVibration();
            }
            
            socket.emit('remoteVibrate', {
                roomName: currentRoomName,
                strong: 1,
                weak: 1
            });
            addLog('远程触发：一键最大震动');
        }
    });

    // 一键关闭震动
    stopBtn.addEventListener('click', () => {
        if (currentRoomName) {
            leftSlider.value = 0;
            rightSlider.value = 0;
            updateValues();
            currentRemoteValues.left = 0;
            currentRemoteValues.right = 0;
            
            stopRemoteVibration();
            socket.emit('remoteVibrate', {
                roomName: currentRoomName,
                strong: 0,
                weak: 0
            });
            addLog('远程震动已停止');
        }
    });

    // 默认启动
    startRemoteVibration();
}

// 接收远程指令
socket.on('triggerVibrate', ({ strong, weak }) => {
    if (phoneVibrateMode) {
        triggerPhoneVibration(strong, weak);
    } else if (gamepadIndex !== null) {
        const gp = navigator.getGamepads()[gamepadIndex];
        if (gp && gp.vibrationActuator) {
            // 增加duration确保持续感
            gp.vibrationActuator.playEffect("dual-rumble", {
                startDelay: 0,
                duration: 1000, // 增加到1000ms
                weakMagnitude: weak,
                strongMagnitude: strong
            });
        }
    }
});
