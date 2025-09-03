#!/usr/bin/env node

import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import minimist from "minimist";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

// CLI服务器 - 提供命令行模式的联机功能
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);

// 解析命令行参数
const argv = minimist(process.argv.slice(2), {
	default: {
		port: 8090,
		debug: false,
		maxPlayers: 8,
		gameMode: "identity"
	},
	alias: {
		p: "port",
		d: "debug",
		m: "maxPlayers",
		g: "gameMode"
	}
});

class NonameCLIServer {
	constructor(options = {}) {
		this.port = options.port || 8090;
		this.debug = options.debug || false;
		this.maxPlayers = options.maxPlayers || 8;
		this.gameMode = options.gameMode || "identity";
		
		// 游戏状态
		this.rooms = new Map(); // 房间列表
		this.players = new Map(); // 玩家连接
		this.gameInstances = new Map(); // 游戏实例
		
		this.setupServer();
		this.setupWebSocket();
	}
	
	setupServer() {
		this.app = express();
		this.server = createServer(this.app);
		
		// 中间件
		this.app.use(express.json({ limit: "10mb" }));
		this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
		
		// 跨域设置
		this.app.use((req, res, next) => {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With,Content-Type");
			res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
			next();
		});
		
		// 静态文件服务
		this.app.use(express.static(rootDir));
		
		// API路由
		this.setupRoutes();
	}
	
	setupRoutes() {
		// 获取房间列表
		this.app.get("/api/rooms", (req, res) => {
			const roomList = Array.from(this.rooms.values()).map(room => ({
				id: room.id,
				name: room.name,
				players: room.players.length,
				maxPlayers: room.maxPlayers,
				gameMode: room.gameMode,
				status: room.status,
				isPrivate: room.isPrivate
			}));
			res.json({ success: true, rooms: roomList });
		});
		
		// 创建房间
		this.app.post("/api/rooms", (req, res) => {
			const { name, maxPlayers = 8, gameMode = "identity", isPrivate = false, password } = req.body;
			const roomId = this.generateRoomId();
			
			const room = {
				id: roomId,
				name: name || `房间${roomId}`,
				maxPlayers: Math.min(maxPlayers, 8),
				gameMode,
				isPrivate,
				password,
				players: [],
				status: "waiting", // waiting, playing, finished
				gameState: null,
				createdAt: new Date()
			};
			
			this.rooms.set(roomId, room);
			this.log(`创建房间: ${room.name} (${roomId})`);
			
			res.json({ success: true, roomId, room });
		});
		
		// 游戏状态同步
		this.app.post("/api/game-action", (req, res) => {
			const { roomId, playerId, action, data } = req.body;
			
			if (!this.rooms.has(roomId)) {
				return res.json({ success: false, error: "房间不存在" });
			}
			
			const room = this.rooms.get(roomId);
			this.handleGameAction(room, playerId, action, data);
			
			res.json({ success: true });
		});
	}
	
	setupWebSocket() {
		this.wss = new WebSocketServer({ server: this.server });
		
		this.wss.on("connection", (ws, req) => {
			const playerId = this.generatePlayerId();
			ws.playerId = playerId;
			ws.isAlive = true;
			
			this.players.set(playerId, {
				id: playerId,
				ws,
				roomId: null,
				nickname: `玩家${playerId.slice(-4)}`,
				isReady: false,
				connectedAt: new Date()
			});
			
			this.log(`玩家连接: ${playerId}`);
			
			// 心跳检测
			ws.on("pong", () => {
				ws.isAlive = true;
			});
			
			// 消息处理
			ws.on("message", (data) => {
				try {
					const message = JSON.parse(data.toString());
					this.handleWebSocketMessage(playerId, message);
				} catch (error) {
					this.log(`消息解析错误: ${error.message}`);
				}
			});
			
			// 断线处理
			ws.on("close", () => {
				this.handlePlayerDisconnect(playerId);
			});
			
			// 发送连接成功消息
			this.sendToPlayer(playerId, {
				type: "connected",
				playerId,
				serverInfo: {
					version: "1.0.0",
					maxPlayers: this.maxPlayers,
					supportedModes: ["identity", "guozhan", "versus", "single"]
				}
			});
		});
		
		// 定期清理断线连接
		setInterval(() => {
			this.wss.clients.forEach(ws => {
				if (!ws.isAlive) {
					ws.terminate();
					return;
				}
				ws.isAlive = false;
				ws.ping();
			});
		}, 30000);
	}
	
	handleWebSocketMessage(playerId, message) {
		const player = this.players.get(playerId);
		if (!player) return;
		
		switch (message.type) {
			case "join-room":
				this.handleJoinRoom(playerId, message.roomId, message.password);
				break;
			case "leave-room":
				this.handleLeaveRoom(playerId);
				break;
			case "ready":
				this.handlePlayerReady(playerId, message.ready);
				break;
			case "game-action":
				this.handleGameAction(player.roomId, playerId, message.action, message.data);
				break;
			case "chat":
				this.handleChat(playerId, message.content);
				break;
			case "set-nickname":
				this.handleSetNickname(playerId, message.nickname);
				break;
			default:
				this.log(`未知消息类型: ${message.type}`);
		}
	}
	
	handleJoinRoom(playerId, roomId, password) {
		const player = this.players.get(playerId);
		const room = this.rooms.get(roomId);
		
		if (!room) {
			return this.sendToPlayer(playerId, {
				type: "error",
				message: "房间不存在"
			});
		}
		
		if (room.players.length >= room.maxPlayers) {
			return this.sendToPlayer(playerId, {
				type: "error", 
				message: "房间已满"
			});
		}
		
		if (room.isPrivate && room.password !== password) {
			return this.sendToPlayer(playerId, {
				type: "error",
				message: "密码错误"
			});
		}
		
		if (room.status === "playing") {
			return this.sendToPlayer(playerId, {
				type: "error",
				message: "游戏进行中，无法加入"
			});
		}
		
		// 离开当前房间
		if (player.roomId) {
			this.handleLeaveRoom(playerId);
		}
		
		// 加入新房间
		player.roomId = roomId;
		player.isReady = false;
		room.players.push(playerId);
		
		this.log(`玩家 ${player.nickname} 加入房间 ${room.name}`);
		
		// 通知玩家加入成功
		this.sendToPlayer(playerId, {
			type: "joined-room",
			room: this.getRoomInfo(room)
		});
		
		// 通知房间内其他玩家
		this.broadcastToRoom(roomId, {
			type: "player-joined",
			player: this.getPlayerInfo(player)
		}, playerId);
	}
	
	handleLeaveRoom(playerId) {
		const player = this.players.get(playerId);
		if (!player || !player.roomId) return;
		
		const room = this.rooms.get(player.roomId);
		if (!room) return;
		
		// 从房间移除玩家
		room.players = room.players.filter(id => id !== playerId);
		
		this.log(`玩家 ${player.nickname} 离开房间 ${room.name}`);
		
		// 通知房间内其他玩家
		this.broadcastToRoom(player.roomId, {
			type: "player-left",
			playerId
		});
		
		// 如果房间为空，删除房间
		if (room.players.length === 0) {
			this.rooms.delete(player.roomId);
			this.log(`删除空房间: ${room.name}`);
		}
		
		player.roomId = null;
		player.isReady = false;
		
		// 通知玩家离开成功
		this.sendToPlayer(playerId, {
			type: "left-room"
		});
	}
	
	handlePlayerReady(playerId, ready) {
		const player = this.players.get(playerId);
		if (!player || !player.roomId) return;
		
		const room = this.rooms.get(player.roomId);
		if (!room) return;
		
		player.isReady = ready;
		
		// 通知房间内所有玩家
		this.broadcastToRoom(player.roomId, {
			type: "player-ready",
			playerId,
			ready
		});
		
		// 检查是否所有玩家都准备好了
		const allReady = room.players.every(id => {
			const p = this.players.get(id);
			return p && p.isReady;
		});
		
		if (allReady && room.players.length >= 2) {
			this.startGame(player.roomId);
		}
	}
	
	async startGame(roomId) {
		const room = this.rooms.get(roomId);
		if (!room) return;
		
		room.status = "playing";
		
		this.log(`开始游戏: 房间 ${room.name}, 模式 ${room.gameMode}`);
		
		// 创建游戏实例
		const gameInstance = await this.createGameInstance(room);
		this.gameInstances.set(roomId, gameInstance);
		
		// 通知所有玩家游戏开始
		this.broadcastToRoom(roomId, {
			type: "game-started",
			gameMode: room.gameMode,
			players: room.players.map(id => this.getPlayerInfo(this.players.get(id)))
		});
		
		// 开始游戏逻辑
		await gameInstance.start();
	}
	
	async createGameInstance(room) {
		// 这里会集成无名杀的游戏逻辑
		const { NonameCLIGame } = await import("./cli-game.js");
		return new NonameCLIGame({
			roomId: room.id,
			players: room.players,
			gameMode: room.gameMode,
			server: this
		});
	}
	
	handleGameAction(roomId, playerId, action, data) {
		if (!roomId) return;
		
		const gameInstance = this.gameInstances.get(roomId);
		if (!gameInstance) return;
		
		gameInstance.handlePlayerAction(playerId, action, data);
	}
	
	handleChat(playerId, content) {
		const player = this.players.get(playerId);
		if (!player || !player.roomId) return;
		
		const message = {
			type: "chat",
			playerId,
			nickname: player.nickname,
			content,
			timestamp: new Date().toISOString()
		};
		
		this.broadcastToRoom(player.roomId, message);
	}
	
	handleSetNickname(playerId, nickname) {
		const player = this.players.get(playerId);
		if (!player) return;
		
		const oldNickname = player.nickname;
		player.nickname = nickname.slice(0, 20); // 限制长度
		
		this.log(`玩家改名: ${oldNickname} -> ${player.nickname}`);
		
		// 如果在房间中，通知其他玩家
		if (player.roomId) {
			this.broadcastToRoom(player.roomId, {
				type: "player-nickname-changed",
				playerId,
				oldNickname,
				newNickname: player.nickname
			});
		}
	}
	
	handlePlayerDisconnect(playerId) {
		const player = this.players.get(playerId);
		if (!player) return;
		
		this.log(`玩家断线: ${player.nickname}`);
		
		// 离开房间
		if (player.roomId) {
			this.handleLeaveRoom(playerId);
		}
		
		// 清理玩家数据
		this.players.delete(playerId);
	}
	
	// 工具方法
	sendToPlayer(playerId, message) {
		const player = this.players.get(playerId);
		if (player && player.ws.readyState === 1) { // WebSocket.OPEN
			player.ws.send(JSON.stringify(message));
		}
	}
	
	broadcastToRoom(roomId, message, excludePlayerId = null) {
		const room = this.rooms.get(roomId);
		if (!room) return;
		
		room.players.forEach(playerId => {
			if (playerId !== excludePlayerId) {
				this.sendToPlayer(playerId, message);
			}
		});
	}
	
	getRoomInfo(room) {
		return {
			id: room.id,
			name: room.name,
			maxPlayers: room.maxPlayers,
			gameMode: room.gameMode,
			status: room.status,
			players: room.players.map(id => this.getPlayerInfo(this.players.get(id)))
		};
	}
	
	getPlayerInfo(player) {
		return {
			id: player.id,
			nickname: player.nickname,
			isReady: player.isReady
		};
	}
	
	generateRoomId() {
		return Math.random().toString(36).substr(2, 8).toUpperCase();
	}
	
	generatePlayerId() {
		return Math.random().toString(36).substr(2, 12);
	}
	
	log(message) {
		const timestamp = new Date().toLocaleString("zh-CN");
		console.log(`[${timestamp}] ${message}`);
	}
	
	start() {
		this.server.listen(this.port, () => {
			console.log(`\n🎮 无名杀CLI服务器已启动`);
			console.log(`📡 端口: ${this.port}`);
			console.log(`🎯 最大玩家数: ${this.maxPlayers}`);
			console.log(`🎲 默认模式: ${this.gameMode}`);
			console.log(`🌐 管理面板: http://localhost:${this.port}/cli/admin.html`);
			console.log(`📝 调试模式: ${this.debug ? "开启" : "关闭"}`);
			console.log(`\n服务器运行中... 按 Ctrl+C 退出\n`);
		});
		
		// 优雅关闭
		process.on("SIGINT", () => {
			console.log("\n正在关闭服务器...");
			this.server.close(() => {
				console.log("服务器已关闭");
				process.exit(0);
			});
		});
	}
}

// 启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new NonameCLIServer(argv);
	server.start();
}

export { NonameCLIServer };