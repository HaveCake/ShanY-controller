const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 托管静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 房间数据存储
const rooms = {};

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 发送房间列表给新用户
    socket.emit('updateRoomList', getPublicRooms());

    // 创建房间
    socket.on('createRoom', ({ roomName, password, isPublic }) => {
        if (rooms[roomName]) {
            socket.emit('showToast', '房间名已存在', 'error');
            return;
        }

        rooms[roomName] = {
            password: password,
            isPublic: isPublic,
            users: [socket.id],
            host: socket.id,
            cleanupTimer: null,
            closeTimer: null,
            closeCountdown: null
        };
        
        socket.join(roomName);
        socket.emit('roomJoined', { roomName, isHost: true });
        io.emit('updateRoomList', getPublicRooms());
        socket.emit('showToast', `房间 ${roomName} 创建成功`, 'success');
    });

    // 加入房间
    socket.on('joinRoom', ({ roomName, password }) => {
        const room = rooms[roomName];
        if (!room) {
            socket.emit('showToast', '房间不存在或已过期', 'error');
            return;
        }

        if (room.users.length >= 2) {
            socket.emit('showToast', '房间人数已满', 'error');
            return;
        }

        if (room.password && room.password !== password) {
            socket.emit('showToast', '密码错误', 'error');
            return;
        }

        // 清除自动关闭定时器（如果存在）
        if (room.closeTimer) {
            clearTimeout(room.closeTimer);
            room.closeTimer = null;
        }
        if (room.closeCountdown) {
            clearInterval(room.closeCountdown);
            room.closeCountdown = null;
        }

        room.users.push(socket.id);
        socket.join(roomName);
        
        socket.emit('roomJoined', { roomName, isHost: false });
        io.to(roomName).emit('logUpdate', '新用户加入了房间，可以开始远程控制了！');
        // 通知房主关闭倒计时已取消
        io.to(room.host).emit('roomCloseCancelled');
        io.emit('updateRoomList', getPublicRooms()); // 更新列表人数
    });

    // 房主重置房间关闭时间
    socket.on('resetRoomCloseTimer', ({ roomName }) => {
        const room = rooms[roomName];
        if (!room || room.host !== socket.id) return;

        // 清除现有定时器
        if (room.closeTimer) {
            clearTimeout(room.closeTimer);
            room.closeTimer = null;
        }
        if (room.closeCountdown) {
            clearInterval(room.closeCountdown);
            room.closeCountdown = null;
        }

        // 重新启动10分钟倒计时
        startRoomCloseCountdown(roomName, room);
        socket.emit('showToast', '房间关闭时间已重置', 'success');
        io.to(roomName).emit('logUpdate', '房主已重置房间关闭倒计时');
    });

    // 远程控制信号
    socket.on('remoteVibrate', ({ roomName, strong, weak, leftMag, rightMag }) => {
        // 广播给房间内除了自己以外的人
        socket.to(roomName).emit('triggerVibrate', { strong, weak, leftMag, rightMag });
    });

    // 断开连接
    socket.on('disconnect', () => {
        for (const roomName in rooms) {
            const room = rooms[roomName];
            const index = room.users.indexOf(socket.id);
            if (index !== -1) {
                const wasHost = room.host === socket.id;
                room.users.splice(index, 1);
                io.to(roomName).emit('logUpdate', '用户已离开房间');
                
                // 如果房间只剩1人，启动10分钟倒计时关闭
                if (room.users.length === 1) {
                    console.log(`房间 ${roomName} 只剩1人，10分钟后关闭...`);
                    startRoomCloseCountdown(roomName, room);
                }
                
                // 如果房间没人了，立即删除
                if (room.users.length === 0) {
                    console.log(`房间 ${roomName} 已空，立即删除`);
                    if (room.closeTimer) clearTimeout(room.closeTimer);
                    if (room.closeCountdown) clearInterval(room.closeCountdown);
                    delete rooms[roomName];
                }
                
                // 如果房主离开，转移房主权限
                if (wasHost && room.users.length > 0) {
                    room.host = room.users[0];
                    io.to(room.host).emit('becameHost');
                    io.to(roomName).emit('logUpdate', '房主已离开，新房主接管房间');
                }
                
                io.emit('updateRoomList', getPublicRooms());
            }
        }
    });
});

// 启动房间关闭倒计时
function startRoomCloseCountdown(roomName, room) {
    const CLOSE_DELAY = 10 * 60 * 1000; // 10分钟
    const WARNING_TIMES = [9, 6, 3, 1]; // 在剩余9、6、3、1分钟时发送警告
    
    let remainingSeconds = CLOSE_DELAY / 1000;
    
    // 发送初始警告
    io.to(room.host).emit('roomClosingSoon', { 
        minutes: Math.ceil(remainingSeconds / 60),
        seconds: remainingSeconds 
    });
    
    // 倒计时更新
    room.closeCountdown = setInterval(() => {
        remainingSeconds--;
        
        // 每分钟更新一次倒计时显示
        if (remainingSeconds % 60 === 0 || remainingSeconds <= 60) {
            io.to(room.host).emit('roomCloseCountdown', { 
                seconds: remainingSeconds,
                minutes: Math.ceil(remainingSeconds / 60)
            });
        }
        
        // 在特定时间点发送警告
        const minutesLeft = Math.ceil(remainingSeconds / 60);
        if (WARNING_TIMES.includes(minutesLeft) && remainingSeconds % 60 === 0) {
            io.to(room.host).emit('roomClosingWarning', { minutes: minutesLeft });
        }
        
        if (remainingSeconds <= 0) {
            clearInterval(room.closeCountdown);
            room.closeCountdown = null;
        }
    }, 1000);
    
    // 关闭定时器
    room.closeTimer = setTimeout(() => {
        if (rooms[roomName] && rooms[roomName].users.length <= 1) {
            // 通知房间内用户房间即将关闭
            io.to(roomName).emit('roomClosed', '房间因人数不足已自动关闭');
            
            // 强制断开房间内所有用户
            const sockets = io.sockets.adapter.rooms.get(roomName);
            if (sockets) {
                sockets.forEach(socketId => {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket) {
                        socket.leave(roomName);
                        socket.emit('forceLeaveRoom');
                    }
                });
            }
            
            delete rooms[roomName];
            io.emit('updateRoomList', getPublicRooms());
            console.log(`房间 ${roomName} 因人数不足已自动关闭`);
        }
    }, CLOSE_DELAY);
}

function getPublicRooms() {
    const list = [];
    for (const [name, data] of Object.entries(rooms)) {
        if (data.isPublic) {
            list.push({
                name: name,
                hasPassword: !!data.password,
                count: data.users.length
            });
        }
    }
    return list;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
