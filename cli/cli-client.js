#!/usr/bin/env node

// CLI客户端 - 命令行交互界面

import WebSocket from "ws";
import readline from "readline";
import minimist from "minimist";
import chalk from "chalk";

// 解析命令行参数
const argv = minimist(process.argv.slice(2), {
	default: {
		server: "localhost:8090",
		nickname: `玩家${Math.random().toString(36).substr(2, 4)}`
	},
	alias: {
		s: "server",
		n: "nickname"
	}
});

class NonameCLIClient {
	constructor(options = {}) {
		this.serverUrl = options.server || "localhost:8090";
		this.nickname = options.nickname || `玩家${Math.random().toString(36).substr(2, 4)}`;
		
		// 连接状态
		this.ws = null;
		this.connected = false;
		this.playerId = null;
		this.currentRoom = null;
		this.gameState = null;
		
		// 界面状态
		this.currentScreen = "main"; // main, room, game
		this.pendingChoices = new Map();
		
		this.setupReadline();
		this.setupCommands();
	}
	
	setupReadline() {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: chalk.cyan("无名杀> ")
		});
		
		this.rl.on("line", (input) => {
			this.handleCommand(input.trim());
		});
		
		this.rl.on("close", () => {
			this.disconnect();
			process.exit(0);
		});
	}
	
	setupCommands() {
		this.commands = {
			// 连接相关
			connect: {
				desc: "连接到服务器",
				usage: "connect [server:port]",
				handler: (args) => this.connect(args[0])
			},
			disconnect: {
				desc: "断开连接",
				handler: () => this.disconnect()
			},
			
			// 房间相关
			rooms: {
				desc: "查看房间列表",
				handler: () => this.listRooms()
			},
			create: {
				desc: "创建房间",
				usage: "create <房间名> [最大玩家数] [游戏模式] [密码]",
				handler: (args) => this.createRoom(args[0], args[1], args[2], args[3])
			},
			join: {
				desc: "加入房间",
				usage: "join <房间ID> [密码]",
				handler: (args) => this.joinRoom(args[0], args[1])
			},
			leave: {
				desc: "离开房间",
				handler: () => this.leaveRoom()
			},
			ready: {
				desc: "准备/取消准备",
				handler: () => this.toggleReady()
			},
			
			// 游戏相关
			card: {
				desc: "使用卡牌",
				usage: "card <卡牌名> [目标玩家ID...]",
				handler: (args) => this.useCard(args[0], args.slice(1))
			},
			skill: {
				desc: "使用技能",
				usage: "skill <技能名> [目标...]",
				handler: (args) => this.useSkill(args[0], args.slice(1))
			},
			end: {
				desc: "结束回合",
				handler: () => this.endTurn()
			},
			state: {
				desc: "查看游戏状态",
				handler: () => this.showGameState()
			},
			
			// 聊天相关
			say: {
				desc: "发送聊天消息",
				usage: "say <消息内容>",
				handler: (args) => this.sendChat(args.join(" "))
			},
			nick: {
				desc: "设置昵称",
				usage: "nick <新昵称>",
				handler: (args) => this.setNickname(args[0])
			},
			
			// 帮助
			help: {
				desc: "显示帮助信息",
				handler: () => this.showHelp()
			},
			clear: {
				desc: "清屏",
				handler: () => console.clear()
			},
			quit: {
				desc: "退出游戏",
				handler: () => process.exit(0)
			}
		};
	}
	
	async connect(server) {
		if (this.connected) {
			this.print("已经连接到服务器");
			return;
		}
		
		const serverUrl = server || this.serverUrl;
		const wsUrl = `ws://${serverUrl}`;
		
		this.print(`正在连接到 ${serverUrl}...`);
		
		try {
			this.ws = new WebSocket(wsUrl);
			
			this.ws.on("open", () => {
				this.connected = true;
				this.print(chalk.green(`✓ 已连接到服务器 ${serverUrl}`));
				this.setNickname(this.nickname);
				this.showMainMenu();
			});
			
			this.ws.on("message", (data) => {
				try {
					const message = JSON.parse(data.toString());
					this.handleServerMessage(message);
				} catch (error) {
					this.print(chalk.red(`消息解析错误: ${error.message}`));
				}
			});
			
			this.ws.on("close", () => {
				this.connected = false;
				this.playerId = null;
				this.currentRoom = null;
				this.print(chalk.yellow("与服务器断开连接"));
			});
			
			this.ws.on("error", (error) => {
				this.print(chalk.red(`连接错误: ${error.message}`));
			});
			
		} catch (error) {
			this.print(chalk.red(`连接失败: ${error.message}`));
		}
	}
	
	disconnect() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.connected = false;
		this.print("已断开连接");
	}
	
	send(message) {
		if (this.ws && this.connected) {
			this.ws.send(JSON.stringify(message));
		} else {
			this.print(chalk.red("未连接到服务器"));
		}
	}
	
	handleServerMessage(message) {
		switch (message.type) {
			case "connected":
				this.playerId = message.playerId;
				this.print(chalk.green(`已分配玩家ID: ${this.playerId}`));
				break;
				
			case "room-list":
				this.displayRoomList(message.rooms);
				break;
				
			case "joined-room":
				this.currentRoom = message.room;
				this.currentScreen = "room";
				this.displayRoom(message.room);
				break;
				
			case "left-room":
				this.currentRoom = null;
				this.currentScreen = "main";
				this.print("已离开房间");
				this.showMainMenu();
				break;
				
			case "player-joined":
				this.print(chalk.green(`${message.player.nickname} 加入了房间`));
				break;
				
			case "player-left":
				this.print(chalk.yellow(`玩家 ${message.playerId} 离开了房间`));
				break;
				
			case "player-ready":
				this.print(`${message.playerId} ${message.ready ? "已准备" : "取消准备"}`);
				break;
				
			case "game-started":
				this.currentScreen = "game";
				this.gameState = message;
				this.displayGameStart(message);
				break;
				
			case "game-message":
				this.handleGameMessage(message);
				break;
				
			case "choice-request":
				this.handleChoiceRequest(message);
				break;
				
			case "chat":
				this.displayChat(message);
				break;
				
			case "error":
				this.print(chalk.red(`错误: ${message.message}`));
				break;
				
			default:
				if (this.debug) {
					this.print(`未处理的消息: ${message.type}`);
				}
		}
	}
	
	handleCommand(input) {
		if (!input) {
			this.rl.prompt();
			return;
		}
		
		const [command, ...args] = input.split(" ");
		const cmd = this.commands[command];
		
		if (cmd) {
			try {
				cmd.handler(args);
			} catch (error) {
				this.print(chalk.red(`命令执行错误: ${error.message}`));
			}
		} else {
			this.print(chalk.red(`未知命令: ${command}. 输入 'help' 查看帮助`));
		}
		
		this.rl.prompt();
	}
	
	async listRooms() {
		if (!this.connected) {
			this.print(chalk.red("请先连接到服务器"));
			return;
		}
		
		try {
			const response = await fetch(`http://${this.serverUrl}/api/rooms`);
			const result = await response.json();
			
			if (result.success) {
				this.displayRoomList(result.rooms);
			} else {
				this.print(chalk.red("获取房间列表失败"));
			}
		} catch (error) {
			this.print(chalk.red(`获取房间列表错误: ${error.message}`));
		}
	}
	
	async createRoom(name, maxPlayers = "8", gameMode = "identity", password) {
		if (!this.connected) {
			this.print(chalk.red("请先连接到服务器"));
			return;
		}
		
		try {
			const response = await fetch(`http://${this.serverUrl}/api/rooms`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name || `${this.nickname}的房间`,
					maxPlayers: parseInt(maxPlayers),
					gameMode,
					isPrivate: !!password,
					password
				})
			});
			
			const result = await response.json();
			
			if (result.success) {
				this.print(chalk.green(`房间创建成功: ${result.roomId}`));
				// 自动加入创建的房间
				this.joinRoom(result.roomId, password);
			} else {
				this.print(chalk.red(`创建房间失败: ${result.error}`));
			}
		} catch (error) {
			this.print(chalk.red(`创建房间错误: ${error.message}`));
		}
	}
	
	joinRoom(roomId, password) {
		if (!this.connected) {
			this.print(chalk.red("请先连接到服务器"));
			return;
		}
		
		this.send({
			type: "join-room",
			roomId,
			password
		});
	}
	
	leaveRoom() {
		if (!this.currentRoom) {
			this.print("当前不在任何房间中");
			return;
		}
		
		this.send({ type: "leave-room" });
	}
	
	toggleReady() {
		if (!this.currentRoom) {
			this.print("请先加入房间");
			return;
		}
		
		const currentPlayer = this.currentRoom.players.find(p => p.id === this.playerId);
		const newReadyState = !currentPlayer?.isReady;
		
		this.send({
			type: "ready",
			ready: newReadyState
		});
	}
	
	useCard(cardName, targets = []) {
		if (this.currentScreen !== "game") {
			this.print("当前不在游戏中");
			return;
		}
		
		this.send({
			type: "game-action",
			action: "use-card",
			data: { cardName, targets }
		});
	}
	
	useSkill(skillName, targets = []) {
		if (this.currentScreen !== "game") {
			this.print("当前不在游戏中");
			return;
		}
		
		this.send({
			type: "game-action",
			action: "use-skill",
			data: { skillName, targets }
		});
	}
	
	endTurn() {
		if (this.currentScreen !== "game") {
			this.print("当前不在游戏中");
			return;
		}
		
		this.send({
			type: "game-action",
			action: "end-turn",
			data: {}
		});
	}
	
	sendChat(content) {
		if (!content) {
			this.print("请输入聊天内容");
			return;
		}
		
		this.send({
			type: "chat",
			content
		});
	}
	
	setNickname(nickname) {
		if (!nickname) {
			this.print("请输入昵称");
			return;
		}
		
		this.nickname = nickname;
		
		if (this.connected) {
			this.send({
				type: "set-nickname",
				nickname
			});
		}
	}
	
	// 显示方法
	displayRoomList(rooms) {
		this.print("\n" + chalk.bold.cyan("=== 房间列表 ==="));
		
		if (rooms.length === 0) {
			this.print("暂无房间");
			return;
		}
		
		rooms.forEach(room => {
			const status = room.status === "waiting" ? chalk.green("等待中") : chalk.yellow("游戏中");
			const privacy = room.isPrivate ? chalk.red("🔒") : chalk.green("🌐");
			
			this.print(`${privacy} ${chalk.bold(room.id)} - ${room.name}`);
			this.print(`   玩家: ${room.players}/${room.maxPlayers} | 模式: ${room.gameMode} | 状态: ${status}`);
		});
		
		this.print("\n使用 'join <房间ID>' 加入房间");
	}
	
	displayRoom(room) {
		console.clear();
		this.print(chalk.bold.green(`\n=== 房间: ${room.name} (${room.id}) ===`));
		this.print(`游戏模式: ${room.gameMode}`);
		this.print(`玩家数量: ${room.players.length}/${room.maxPlayers}\n`);
		
		this.print(chalk.bold("玩家列表:"));
		room.players.forEach(player => {
			const readyStatus = player.isReady ? chalk.green("✓") : chalk.red("✗");
			const isMe = player.id === this.playerId ? chalk.bold.cyan(" (你)") : "";
			this.print(`  ${readyStatus} ${player.nickname}${isMe}`);
		});
		
		this.print(chalk.dim("\n可用命令: ready, leave, say <消息>"));
	}
	
	displayGameStart(gameInfo) {
		console.clear();
		this.print(chalk.bold.green("\n🎮 游戏开始! 🎮"));
		this.print(`模式: ${gameInfo.gameMode}`);
		this.print(`玩家: ${gameInfo.players.map(p => p.nickname).join(", ")}`);
		this.print(chalk.dim("\n可用命令: card, skill, end, state, say"));
	}
	
	showGameState() {
		if (!this.gameState) {
			this.print("游戏状态不可用");
			return;
		}
		
		this.print(chalk.bold.cyan("\n=== 游戏状态 ==="));
		this.print(`回合: ${this.gameState.round}`);
		this.print(`阶段: ${this.gameState.phase}`);
		this.print(`当前玩家: ${this.gameState.currentPlayer || "无"}`);
		
		this.print(chalk.bold("\n玩家状态:"));
		this.gameState.players.forEach(player => {
			const status = player.isAlive ? chalk.green("存活") : chalk.red("死亡");
			const isMe = player.cliId === this.playerId ? chalk.bold.cyan(" (你)") : "";
			this.print(`  ${player.name}${isMe}: ${status} HP:${player.hp}/${player.maxHp} 手牌:${player.handCardCount}`);
		});
	}
	
	handleGameMessage(message) {
		const { gameType, data } = message;
		
		switch (gameType) {
			case "dialog":
				this.print(chalk.yellow(`📢 ${data.content}`));
				break;
			case "damage":
				this.print(chalk.red(`💥 ${data.attacker} 对 ${data.target} 造成了 ${data.damage} 点伤害`));
				break;
			case "heal":
				this.print(chalk.green(`💚 ${data.healer} 为 ${data.target} 回复了 ${data.heal} 点生命`));
				break;
			case "death":
				this.print(chalk.red(`💀 ${data.player} 阵亡了`));
				break;
			case "dodge":
				this.print(chalk.blue(`🛡️ ${data.target} 闪避了 ${data.attacker} 的攻击`));
				break;
			default:
				if (this.debug) {
					this.print(`游戏消息: ${gameType} - ${JSON.stringify(data)}`);
				}
		}
	}
	
	handleChoiceRequest(message) {
		const { requestId, choiceType, options } = message;
		
		this.print(chalk.bold.yellow(`\n⚡ 请做出选择 (${choiceType}):`));
		
		switch (choiceType) {
			case "choose-card":
				this.print(`${options.prompt}`);
				this.print("输入: choice <卡牌名>");
				break;
			case "choose-target":
				this.print(`${options.prompt}`);
				this.print("输入: choice <目标玩家ID>");
				break;
			case "choose-skill":
				this.print(`${options.prompt}`);
				this.print("输入: choice <技能名>");
				break;
		}
		
		// 存储待处理的选择
		this.pendingChoices.set("current", { requestId, choiceType, options });
		
		// 设置超时
		setTimeout(() => {
			if (this.pendingChoices.has("current")) {
				this.print(chalk.red("选择超时，自动跳过"));
				this.respondChoice(requestId, { auto: true });
			}
		}, options.timeout || 30000);
	}
	
	respondChoice(requestId, choice) {
		this.send({
			type: "game-action",
			action: "choice-response",
			data: { requestId, choice }
		});
		this.pendingChoices.delete("current");
	}
	
	displayChat(message) {
		const time = new Date(message.timestamp).toLocaleTimeString("zh-CN");
		this.print(chalk.dim(`[${time}] `) + chalk.cyan(`${message.nickname}: `) + message.content);
	}
	
	showMainMenu() {
		console.clear();
		this.print(chalk.bold.blue("\n🎯 欢迎来到无名杀命令行版! 🎯"));
		this.print(`昵称: ${chalk.cyan(this.nickname)}`);
		this.print(`服务器: ${chalk.green(this.serverUrl)}\n`);
		
		this.print(chalk.bold("快速开始:"));
		this.print("  rooms     - 查看房间列表");
		this.print("  create    - 创建房间");
		this.print("  join <ID> - 加入房间");
		this.print("  help      - 查看所有命令\n");
		
		this.currentScreen = "main";
	}
	
	showHelp() {
		this.print(chalk.bold.cyan("\n=== 命令帮助 ==="));
		
		Object.entries(this.commands).forEach(([name, cmd]) => {
			const usage = cmd.usage ? chalk.dim(` (${cmd.usage})`) : "";
			this.print(`  ${chalk.yellow(name)}${usage} - ${cmd.desc}`);
		});
		
		this.print(chalk.dim("\n特殊命令:"));
		this.print(chalk.dim("  choice <选项> - 回应游戏选择请求"));
		this.print(chalk.dim("  Ctrl+C       - 退出程序"));
	}
	
	print(message) {
		// 临时清除prompt，打印消息，然后恢复prompt
		readline.clearLine(process.stdout, 0);
		readline.cursorTo(process.stdout, 0);
		console.log(message);
		this.rl.prompt();
	}
	
	start() {
		console.clear();
		this.print(chalk.bold.magenta("🎮 无名杀 CLI 客户端 🎮"));
		this.print(`版本: 1.0.0 | 作者: 无名杀开发团队\n`);
		
		if (argv.server !== "localhost:8090") {
			this.connect(argv.server);
		} else {
			this.print("输入 'connect' 连接到默认服务器，或 'connect <服务器:端口>' 连接到指定服务器");
			this.print("输入 'help' 查看帮助信息\n");
		}
		
		this.rl.prompt();
	}
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
	const client = new NonameCLIClient({
		server: argv.server,
		nickname: argv.nickname
	});
	
	client.start();
}

export { NonameCLIClient };