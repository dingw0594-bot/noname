// CLI适配器 - 将无名杀的UI系统适配到命令行界面

import { lib, game, ui, get, ai, _status } from "../noname.js";

export class CLIAdapter {
	constructor(cliGame) {
		this.cliGame = cliGame;
		this.originalUI = {};
		this.virtualElements = new Map();
		this.setupUIInterception();
	}
	
	setupUIInterception() {
		// 保存原始UI方法
		if (typeof ui !== "undefined") {
			this.originalUI = {
				create: { ...ui.create },
				click: { ...ui.click }
			};
			
			// 重写UI创建方法
			this.interceptUICreate();
			this.interceptUIClick();
		}
	}
	
	interceptUICreate() {
		const self = this;
		
		// 拦截对话框创建
		ui.create.dialog = function(content, ...args) {
			const dialogId = self.generateElementId();
			const dialog = {
				id: dialogId,
				content,
				buttons: [],
				close: () => self.closeDialog(dialogId),
				add: (element) => self.addToDialog(dialogId, element)
			};
			
			self.virtualElements.set(dialogId, dialog);
			
			// 发送对话框消息到CLI
			self.cliGame.sendGameUpdate("dialog", {
				id: dialogId,
				content: self.extractTextContent(content),
				type: "info"
			});
			
			return dialog;
		};
		
		// 拦截控制按钮创建
		ui.create.control = function(...args) {
			const controlId = self.generateElementId();
			const buttons = [];
			const callbacks = [];
			
			// 解析参数
			args.forEach((arg, index) => {
				if (typeof arg === "string") {
					buttons.push(arg);
				} else if (typeof arg === "function") {
					callbacks[buttons.length - 1] = arg;
				}
			});
			
			const control = {
				id: controlId,
				buttons,
				callbacks,
				close: () => self.closeControl(controlId),
				replace: (...newArgs) => ui.create.control(...newArgs)
			};
			
			self.virtualElements.set(controlId, control);
			
			// 发送控制按钮消息到CLI
			self.cliGame.sendGameUpdate("control", {
				id: controlId,
				buttons,
				type: "choice"
			});
			
			return control;
		};
		
		// 拦截卡牌创建
		ui.create.card = function(cardData, ...args) {
			const cardId = self.generateElementId();
			const card = {
				id: cardId,
				name: cardData.name || cardData,
				suit: cardData.suit,
				number: cardData.number,
				nature: cardData.nature,
				
				// 虚拟方法
				classList: { add: () => {}, remove: () => {} },
				style: {},
				addEventListener: () => {},
				removeEventListener: () => {}
			};
			
			self.virtualElements.set(cardId, card);
			return card;
		};
		
		// 拦截玩家创建
		ui.create.player = function(playerData, ...args) {
			const playerId = self.generateElementId();
			const player = {
				id: playerId,
				name: playerData.name || playerData,
				identity: playerData.identity,
				hp: playerData.hp || 4,
				maxHp: playerData.maxHp || 4,
				
				// 虚拟方法
				classList: { add: () => {}, remove: () => {} },
				style: {},
				node: {}
			};
			
			self.virtualElements.set(playerId, player);
			return player;
		};
	}
	
	interceptUIClick() {
		const self = this;
		
		// 拦截点击事件
		ui.click.card = function(card, ...args) {
			self.cliGame.sendGameUpdate("card-click", {
				cardId: card.id,
				cardName: card.name
			});
		};
		
		ui.click.player = function(player, ...args) {
			self.cliGame.sendGameUpdate("player-click", {
				playerId: player.id,
				playerName: player.name
			});
		};
		
		ui.click.skill = function(skill, ...args) {
			self.cliGame.sendGameUpdate("skill-click", {
				skillName: skill.name || skill
			});
		};
	}
	
	// 处理CLI输入转换为游戏事件
	handleCLIInput(playerId, inputType, data) {
		switch (inputType) {
			case "button-click":
				this.handleButtonClick(data.controlId, data.buttonIndex);
				break;
			case "card-select":
				this.handleCardSelect(playerId, data.cardName);
				break;
			case "target-select":
				this.handleTargetSelect(playerId, data.targetId);
				break;
			case "skill-activate":
				this.handleSkillActivate(playerId, data.skillName);
				break;
		}
	}
	
	handleButtonClick(controlId, buttonIndex) {
		const control = this.virtualElements.get(controlId);
		if (!control || !control.callbacks) return;
		
		const callback = control.callbacks[buttonIndex];
		if (typeof callback === "function") {
			callback();
		}
	}
	
	handleCardSelect(playerId, cardName) {
		// 模拟卡牌选择事件
		const event = {
			type: "card-select",
			playerId,
			cardName,
			preventDefault: () => {},
			stopPropagation: () => {}
		};
		
		// 触发相应的游戏事件
		this.triggerGameEvent("cardSelect", event);
	}
	
	handleTargetSelect(playerId, targetId) {
		const event = {
			type: "target-select",
			playerId,
			targetId,
			preventDefault: () => {},
			stopPropagation: () => {}
		};
		
		this.triggerGameEvent("targetSelect", event);
	}
	
	handleSkillActivate(playerId, skillName) {
		const event = {
			type: "skill-activate",
			playerId,
			skillName,
			preventDefault: () => {},
			stopPropagation: () => {}
		};
		
		this.triggerGameEvent("skillActivate", event);
	}
	
	// 触发游戏事件
	triggerGameEvent(eventType, eventData) {
		// 这里会调用无名杀的事件系统
		if (typeof game !== "undefined" && game.trigger) {
			game.trigger(eventType, eventData);
		}
	}
	
	// 工具方法
	extractTextContent(content) {
		if (typeof content === "string") {
			return content;
		} else if (content && content.textContent) {
			return content.textContent;
		} else if (Array.isArray(content)) {
			return content.map(item => this.extractTextContent(item)).join(" ");
		}
		return String(content);
	}
	
	generateElementId() {
		return `cli_${Math.random().toString(36).substr(2, 8)}`;
	}
	
	closeDialog(dialogId) {
		this.virtualElements.delete(dialogId);
		this.cliGame.sendGameUpdate("dialog-close", { id: dialogId });
	}
	
	closeControl(controlId) {
		this.virtualElements.delete(controlId);
		this.cliGame.sendGameUpdate("control-close", { id: controlId });
	}
	
	addToDialog(dialogId, element) {
		const dialog = this.virtualElements.get(dialogId);
		if (dialog) {
			dialog.content += "\n" + this.extractTextContent(element);
			this.cliGame.sendGameUpdate("dialog-update", {
				id: dialogId,
				content: dialog.content
			});
		}
	}
	
	// 恢复原始UI
	restoreUI() {
		if (typeof ui !== "undefined" && this.originalUI.create) {
			Object.assign(ui.create, this.originalUI.create);
			Object.assign(ui.click, this.originalUI.click);
		}
	}
}

// 虚拟DOM元素类
export class VirtualElement {
	constructor(type = "div") {
		this.tagName = type.toUpperCase();
		this.id = "";
		this.className = "";
		this.textContent = "";
		this.innerHTML = "";
		this.style = {};
		this.children = [];
		this.parentElement = null;
		this.classList = {
			add: (className) => {
				if (!this.className.includes(className)) {
					this.className += " " + className;
				}
			},
			remove: (className) => {
				this.className = this.className.replace(className, "").trim();
			},
			contains: (className) => this.className.includes(className)
		};
	}
	
	appendChild(child) {
		this.children.push(child);
		child.parentElement = this;
		return child;
	}
	
	removeChild(child) {
		const index = this.children.indexOf(child);
		if (index > -1) {
			this.children.splice(index, 1);
			child.parentElement = null;
		}
		return child;
	}
	
	addEventListener(event, handler) {
		// 虚拟事件监听
		this.eventHandlers = this.eventHandlers || {};
		this.eventHandlers[event] = this.eventHandlers[event] || [];
		this.eventHandlers[event].push(handler);
	}
	
	removeEventListener(event, handler) {
		if (this.eventHandlers && this.eventHandlers[event]) {
			const index = this.eventHandlers[event].indexOf(handler);
			if (index > -1) {
				this.eventHandlers[event].splice(index, 1);
			}
		}
	}
	
	click() {
		if (this.eventHandlers && this.eventHandlers.click) {
			this.eventHandlers.click.forEach(handler => handler());
		}
	}
}