// CLI游戏逻辑 - 集成无名杀核心游戏系统到命令行模式

import { game, get, lib, ai, _status, ui } from "../noname.js";

export class NonameCLIGame {
	constructor(options) {
		this.roomId = options.roomId;
		this.playerIds = options.players;
		this.gameMode = options.gameMode;
		this.server = options.server;
		
		// 游戏状态
		this.gameState = "preparing"; // preparing, playing, finished
		this.currentPlayer = null;
		this.round = 0;
		this.phase = "init";
		
		// 玩家映射
		this.cliPlayers = new Map(); // CLI玩家ID -> 游戏玩家对象
		this.gameToCliMap = new Map(); // 游戏玩家 -> CLI玩家ID
		
		this.initializeGame();
	}
	
	async initializeGame() {
		// 创建虚拟的UI环境用于CLI
		this.setupVirtualUI();
		
		// 初始化游戏状态
		this.setupGameState();
		
		// 加载游戏模式
		await this.loadGameMode();
	}
	
	setupVirtualUI() {
		// 创建虚拟UI对象，拦截UI操作并转换为CLI消息
		this.virtualUI = {
			arena: { classList: { add: () => {}, remove: () => {} } },
			window: {},
			system: {},
			controls: [],
			dialogs: [],
			
			// 重写关键UI方法
			create: {
				dialog: (content) => {
					const dialog = {
						content,
						close: () => {},
						add: () => {},
						buttons: []
					};
					this.sendGameUpdate("dialog", { content, type: "info" });
					return dialog;
				},
				
				control: (...args) => {
					const control = {
						close: () => {},
						replace: () => {}
					};
					
					// 发送选择按钮给玩家
					this.sendGameUpdate("control", { 
						buttons: args.filter(arg => typeof arg === "string"),
						type: "choice"
					});
					
					return control;
				},
				
				me: () => {
					// 创建虚拟的"我"玩家对象
					return {};
				}
			}
		};
		
		// 替换全局ui对象
		if (typeof ui !== "undefined") {
			Object.assign(ui, this.virtualUI);
		}
	}
	
	setupGameState() {
		// 重置游戏状态
		if (typeof _status !== "undefined") {
			_status.mode = this.gameMode;
			_status.connectMode = true;
			_status.over = false;
			_status.paused = false;
			_status.auto = false;
		}
		
		// 清空玩家列表
		if (typeof game !== "undefined") {
			game.players = [];
			game.dead = [];
			game.me = null;
		}
	}
	
	async loadGameMode() {
		try {
			// 动态加载游戏模式
			const modeModule = await import(`../mode/${this.gameMode}.js`);
			this.modeConfig = modeModule.default();
			
			this.log(`已加载游戏模式: ${this.modeConfig.name}`);
		} catch (error) {
			this.log(`加载游戏模式失败: ${error.message}`);
			throw error;
		}
	}
	
	async start() {
		try {
			this.gameState = "playing";
			this.log(`开始游戏 - 模式: ${this.gameMode}, 玩家数: ${this.playerIds.length}`);
			
			// 创建游戏玩家对象
			await this.createGamePlayers();
			
			// 发送游戏开始消息
			this.broadcastGameUpdate("game-start", {
				mode: this.gameMode,
				players: this.getPlayersInfo(),
				round: this.round
			});
			
			// 执行游戏模式的开始逻辑
			if (this.modeConfig && this.modeConfig.start) {
				await this.executeGameFunction(this.modeConfig.start);
			}
			
		} catch (error) {
			this.log(`游戏启动失败: ${error.message}`);
			this.gameState = "finished";
		}
	}
	
	async createGamePlayers() {
		// 为每个CLI玩家创建游戏内的Player对象
		for (let i = 0; i < this.playerIds.length; i++) {
			const cliPlayerId = this.playerIds[i];
			const serverPlayer = this.server.players.get(cliPlayerId);
			
			// 创建虚拟的游戏玩家对象
			const gamePlayer = {
				id: i,
				name: serverPlayer.nickname,
				cliId: cliPlayerId,
				identity: null,
				hp: 4,
				maxHp: 4,
				handCards: [],
				equipCards: [],
				skills: [],
				isAlive: true,
				
				// 玩家行动方法
				chooseCard: (options) => this.requestPlayerChoice(cliPlayerId, "choose-card", options),
				chooseTarget: (options) => this.requestPlayerChoice(cliPlayerId, "choose-target", options),
				chooseSkill: (options) => this.requestPlayerChoice(cliPlayerId, "choose-skill", options),
				
				// 状态查询方法
				countCards: (type) => {
					switch (type) {
						case "h": return this.handCards.length;
						case "e": return this.equipCards.length;
						default: return this.handCards.length + this.equipCards.length;
					}
				}
			};
			
			this.cliPlayers.set(cliPlayerId, gamePlayer);
			this.gameToCliMap.set(gamePlayer, cliPlayerId);
			
			if (typeof game !== "undefined") {
				game.players.push(gamePlayer);
				if (i === 0) game.me = gamePlayer;
			}
		}
	}
	
	async requestPlayerChoice(playerId, choiceType, options) {
		return new Promise((resolve) => {
			const requestId = this.generateRequestId();
			
			// 存储请求回调
			this.pendingRequests = this.pendingRequests || new Map();
			this.pendingRequests.set(requestId, resolve);
			
			// 发送选择请求给玩家
			this.server.sendToPlayer(playerId, {
				type: "choice-request",
				requestId,
				choiceType,
				options,
				timeout: options.timeout || 30000
			});
			
			// 设置超时
			setTimeout(() => {
				if (this.pendingRequests.has(requestId)) {
					this.pendingRequests.delete(requestId);
					resolve({ auto: true }); // 自动选择
				}
			}, options.timeout || 30000);
		});
	}
	
	handlePlayerAction(playerId, action, data) {
		switch (action) {
			case "choice-response":
				this.handleChoiceResponse(data.requestId, data.choice);
				break;
			case "use-card":
				this.handleUseCard(playerId, data);
				break;
			case "use-skill":
				this.handleUseSkill(playerId, data);
				break;
			case "end-turn":
				this.handleEndTurn(playerId);
				break;
			default:
				this.log(`未知游戏行动: ${action}`);
		}
	}
	
	handleChoiceResponse(requestId, choice) {
		if (this.pendingRequests && this.pendingRequests.has(requestId)) {
			const resolve = this.pendingRequests.get(requestId);
			this.pendingRequests.delete(requestId);
			resolve(choice);
		}
	}
	
	async handleUseCard(playerId, data) {
		const player = this.cliPlayers.get(playerId);
		if (!player) return;
		
		const { cardName, targets } = data;
		
		// 验证卡牌使用的合法性
		if (!this.canUseCard(player, cardName, targets)) {
			this.sendToPlayer(playerId, "error", "无法使用该卡牌");
			return;
		}
		
		// 执行卡牌效果
		await this.executeCardEffect(player, cardName, targets);
		
		// 广播游戏状态更新
		this.broadcastGameState();
	}
	
	canUseCard(player, cardName, targets) {
		// 检查玩家是否有该卡牌
		const hasCard = player.handCards.some(card => card.name === cardName);
		if (!hasCard) return false;
		
		// 检查目标合法性
		if (targets && targets.length > 0) {
			// 验证目标玩家存在且合法
			for (const targetId of targets) {
				const target = this.cliPlayers.get(targetId);
				if (!target || !target.isAlive) return false;
			}
		}
		
		return true;
	}
	
	async executeCardEffect(player, cardName, targets) {
		// 这里会调用无名杀的卡牌效果系统
		this.log(`${player.name} 使用了 ${cardName}`);
		
		// 移除手牌
		player.handCards = player.handCards.filter(card => card.name !== cardName);
		
		// 根据卡牌类型执行效果
		switch (cardName) {
			case "sha":
				await this.executeAttack(player, targets);
				break;
			case "shan":
				await this.executeDefense(player);
				break;
			case "tao":
				await this.executeHeal(player, targets);
				break;
			// 更多卡牌效果...
		}
	}
	
	async executeAttack(attacker, targets) {
		for (const targetId of targets) {
			const target = this.cliPlayers.get(targetId);
			if (!target) continue;
			
			// 请求目标玩家出闪
			const response = await this.requestPlayerChoice(targetId, "choose-card", {
				prompt: `${attacker.name} 对你使用了杀，请出闪`,
				cardType: "shan",
				timeout: 15000
			});
			
			if (response && response.cardName === "shan") {
				this.sendGameUpdate("dodge", { 
					attacker: attacker.name, 
					target: target.name 
				});
			} else {
				// 造成伤害
				target.hp = Math.max(0, target.hp - 1);
				this.sendGameUpdate("damage", {
					attacker: attacker.name,
					target: target.name,
					damage: 1,
					newHp: target.hp
				});
				
				// 检查死亡
				if (target.hp <= 0) {
					await this.handlePlayerDeath(target);
				}
			}
		}
	}
	
	async executeDefense(player) {
		// 闪的逻辑通常在攻击处理中
		this.log(`${player.name} 使用了闪`);
	}
	
	async executeHeal(healer, targets) {
		const target = targets.length > 0 ? this.cliPlayers.get(targets[0]) : healer;
		if (!target) return;
		
		target.hp = Math.min(target.maxHp, target.hp + 1);
		this.sendGameUpdate("heal", {
			healer: healer.name,
			target: target.name,
			heal: 1,
			newHp: target.hp
		});
	}
	
	async handlePlayerDeath(player) {
		player.isAlive = false;
		this.sendGameUpdate("death", { player: player.name });
		
		// 检查游戏结束条件
		await this.checkGameEnd();
	}
	
	async checkGameEnd() {
		const alivePlayers = Array.from(this.cliPlayers.values()).filter(p => p.isAlive);
		
		if (alivePlayers.length <= 1) {
			await this.endGame(alivePlayers[0]);
		}
	}
	
	async endGame(winner) {
		this.gameState = "finished";
		
		this.broadcastGameUpdate("game-end", {
			winner: winner ? winner.name : null,
			players: this.getPlayersInfo()
		});
		
		// 清理游戏实例
		this.server.gameInstances.delete(this.roomId);
		
		// 重置房间状态
		const room = this.server.rooms.get(this.roomId);
		if (room) {
			room.status = "waiting";
			room.players.forEach(playerId => {
				const player = this.server.players.get(playerId);
				if (player) player.isReady = false;
			});
		}
		
		this.log(`游戏结束 - 获胜者: ${winner ? winner.name : "无"}`);
	}
	
	// 游戏函数执行器 - 用于执行无名杀的游戏逻辑
	async executeGameFunction(func) {
		if (typeof func === "function") {
			try {
				// 在安全的上下文中执行游戏函数
				await func.call(this);
			} catch (error) {
				this.log(`游戏函数执行错误: ${error.message}`);
			}
		}
	}
	
	// 消息发送方法
	sendToPlayer(playerId, type, data) {
		this.server.sendToPlayer(playerId, {
			type: "game-message",
			gameType: type,
			data,
			timestamp: Date.now()
		});
	}
	
	sendGameUpdate(updateType, data) {
		this.broadcastGameUpdate("game-update", {
			updateType,
			data,
			gameState: this.getGameState()
		});
	}
	
	broadcastGameUpdate(type, data) {
		this.server.broadcastToRoom(this.roomId, {
			type,
			data,
			timestamp: Date.now()
		});
	}
	
	broadcastGameState() {
		this.broadcastGameUpdate("state-update", this.getGameState());
	}
	
	getGameState() {
		return {
			state: this.gameState,
			round: this.round,
			phase: this.phase,
			currentPlayer: this.currentPlayer ? this.gameToCliMap.get(this.currentPlayer) : null,
			players: this.getPlayersInfo()
		};
	}
	
	getPlayersInfo() {
		return Array.from(this.cliPlayers.entries()).map(([cliId, gamePlayer]) => ({
			cliId,
			name: gamePlayer.name,
			hp: gamePlayer.hp,
			maxHp: gamePlayer.maxHp,
			handCardCount: gamePlayer.handCards.length,
			equipCardCount: gamePlayer.equipCards.length,
			isAlive: gamePlayer.isAlive,
			skills: gamePlayer.skills.map(skill => skill.name || skill)
		}));
	}
	
	generateRequestId() {
		return Math.random().toString(36).substr(2, 12);
	}
	
	log(message) {
		const timestamp = new Date().toLocaleString("zh-CN");
		console.log(`[游戏-${this.roomId}] ${message}`);
	}
}

// 扩展游戏类以支持CLI特定功能
export class CLIGameAdapter {
	constructor(cliGame) {
		this.cliGame = cliGame;
	}
	
	// 适配器方法，将无名杀的UI调用转换为CLI消息
	adaptUICall(method, args) {
		switch (method) {
			case "create.dialog":
				return this.cliGame.sendGameUpdate("dialog", { content: args[0] });
			case "create.control":
				return this.cliGame.sendGameUpdate("control", { buttons: args });
			case "create.arena":
				return this.cliGame.sendGameUpdate("arena", {});
			default:
				// 忽略其他UI调用
				return {};
		}
	}
	
	// 适配玩家选择
	async adaptPlayerChoice(player, type, options) {
		const cliId = this.cliGame.gameToCliMap.get(player);
		if (!cliId) return null;
		
		return await this.cliGame.requestPlayerChoice(cliId, type, options);
	}
}