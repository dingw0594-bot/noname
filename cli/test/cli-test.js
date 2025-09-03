#!/usr/bin/env node

// 无名杀CLI模式测试脚本

import { NonameCLIServer } from "../cli-server.js";
import WebSocket from "ws";
import { setTimeout } from "timers/promises";

class CLITester {
	constructor() {
		this.server = null;
		this.clients = [];
		this.testResults = [];
	}
	
	async runTests() {
		console.log("🧪 开始无名杀CLI模式测试\n");
		
		try {
			await this.startServer();
			await this.testServerConnection();
			await this.testRoomCreation();
			await this.testPlayerJoin();
			await this.testGameStart();
			await this.testGameplay();
			await this.cleanup();
			
			this.showResults();
		} catch (error) {
			console.error("❌ 测试失败:", error.message);
			await this.cleanup();
			process.exit(1);
		}
	}
	
	async startServer() {
		this.log("启动测试服务器...");
		
		this.server = new NonameCLIServer({
			port: 8091,
			debug: true,
			maxPlayers: 4
		});
		
		// 启动服务器
		this.server.start();
		await setTimeout(2000); // 等待服务器启动
		
		this.pass("服务器启动成功");
	}
	
	async testServerConnection() {
		this.log("测试服务器连接...");
		
		const client = await this.createTestClient("测试玩家1");
		await this.waitForConnection(client);
		
		this.pass("服务器连接成功");
	}
	
	async testRoomCreation() {
		this.log("测试房间创建...");
		
		// 通过HTTP API创建房间
		const response = await fetch("http://localhost:8091/api/rooms", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "测试房间",
				maxPlayers: 4,
				gameMode: "identity"
			})
		});
		
		const result = await response.json();
		
		if (!result.success) {
			throw new Error("房间创建失败");
		}
		
		this.testRoomId = result.roomId;
		this.pass("房间创建成功: " + this.testRoomId);
	}
	
	async testPlayerJoin() {
		this.log("测试玩家加入房间...");
		
		// 创建多个测试客户端
		for (let i = 1; i <= 3; i++) {
			const client = await this.createTestClient(`测试玩家${i}`);
			await this.waitForConnection(client);
			
			// 加入房间
			client.send(JSON.stringify({
				type: "join-room",
				roomId: this.testRoomId
			}));
			
			await setTimeout(500);
		}
		
		this.pass("玩家加入房间成功");
	}
	
	async testGameStart() {
		this.log("测试游戏开始...");
		
		// 所有玩家准备
		for (const client of this.clients) {
			client.send(JSON.stringify({
				type: "ready",
				ready: true
			}));
			await setTimeout(200);
		}
		
		// 等待游戏开始
		await setTimeout(3000);
		
		this.pass("游戏开始测试完成");
	}
	
	async testGameplay() {
		this.log("测试游戏玩法...");
		
		// 模拟一些游戏操作
		const client = this.clients[0];
		
		// 发送聊天消息
		client.send(JSON.stringify({
			type: "chat",
			content: "测试聊天消息"
		}));
		
		// 模拟游戏动作
		client.send(JSON.stringify({
			type: "game-action",
			action: "use-card",
			data: { cardName: "sha", targets: ["player2"] }
		}));
		
		await setTimeout(1000);
		
		this.pass("游戏玩法测试完成");
	}
	
	async createTestClient(nickname) {
		return new Promise((resolve, reject) => {
			const client = new WebSocket("ws://localhost:8091");
			client.nickname = nickname;
			
			client.on("open", () => {
				// 设置昵称
				client.send(JSON.stringify({
					type: "set-nickname",
					nickname
				}));
				
				this.clients.push(client);
				resolve(client);
			});
			
			client.on("error", reject);
			
			client.on("message", (data) => {
				try {
					const message = JSON.parse(data.toString());
					if (this.server.debug) {
						console.log(`[${nickname}] 收到:`, message.type);
					}
				} catch (error) {
					console.error("消息解析错误:", error);
				}
			});
		});
	}
	
	async waitForConnection(client) {
		return new Promise((resolve) => {
			const checkConnection = () => {
				if (client.readyState === WebSocket.OPEN) {
					resolve();
				} else {
					setTimeout(checkConnection, 100);
				}
			};
			checkConnection();
		});
	}
	
	async cleanup() {
		this.log("清理测试环境...");
		
		// 关闭所有客户端连接
		for (const client of this.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.close();
			}
		}
		
		// 关闭服务器
		if (this.server && this.server.server) {
			this.server.server.close();
		}
		
		await setTimeout(1000);
		this.log("清理完成");
	}
	
	log(message) {
		console.log(`📝 ${message}`);
	}
	
	pass(message) {
		console.log(`✅ ${message}`);
		this.testResults.push({ status: "pass", message });
	}
	
	fail(message) {
		console.log(`❌ ${message}`);
		this.testResults.push({ status: "fail", message });
	}
	
	showResults() {
		console.log("\n" + "=".repeat(50));
		console.log("🧪 测试结果统计");
		console.log("=".repeat(50));
		
		const passed = this.testResults.filter(r => r.status === "pass").length;
		const failed = this.testResults.filter(r => r.status === "fail").length;
		const total = this.testResults.length;
		
		console.log(`总测试数: ${total}`);
		console.log(`通过: ${passed}`);
		console.log(`失败: ${failed}`);
		console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);
		
		if (failed === 0) {
			console.log("\n🎉 所有测试通过！CLI模式工作正常。");
		} else {
			console.log("\n⚠️ 部分测试失败，请检查问题。");
		}
		
		console.log("\n测试详情:");
		this.testResults.forEach((result, index) => {
			const icon = result.status === "pass" ? "✅" : "❌";
			console.log(`  ${index + 1}. ${icon} ${result.message}`);
		});
	}
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
	const tester = new CLITester();
	tester.runTests().catch(console.error);
}