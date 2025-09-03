#!/usr/bin/env node

// 无名杀CLI模式启动脚本

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import minimist from "minimist";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argv = minimist(process.argv.slice(2), {
	default: {
		mode: "server",
		port: 8090,
		nickname: `玩家${Math.random().toString(36).substr(2, 4)}`
	},
	alias: {
		m: "mode",
		p: "port",
		n: "nickname",
		s: "server",
		h: "help"
	}
});

function showHelp() {
	console.log(`
🎮 无名杀 CLI 模式启动器

用法: node start.js [选项]

模式选项:
  -m, --mode <模式>     启动模式: server|client|both (默认: server)
  
服务器选项:
  -p, --port <端口>     服务器端口 (默认: 8090)
  --maxPlayers <数量>   最大玩家数 (默认: 8)
  --gameMode <模式>     默认游戏模式 (默认: identity)
  --debug               启用调试模式

客户端选项:
  -s, --server <地址>   服务器地址 (默认: localhost:8090)
  -n, --nickname <昵称> 玩家昵称
  
其他选项:
  -h, --help           显示帮助信息

示例:
  node start.js                          # 启动服务器
  node start.js -m client                # 启动客户端
  node start.js -m both                  # 同时启动服务器和客户端
  node start.js -p 8091 --debug          # 调试模式启动服务器
  node start.js -m client -s 192.168.1.100:8090  # 连接远程服务器
`);
}

function startServer(args = []) {
	console.log("🚀 启动无名杀CLI服务器...");
	
	const serverArgs = [
		join(__dirname, "cli-server.js"),
		...args
	];
	
	const server = spawn("node", serverArgs, {
		stdio: "inherit",
		cwd: __dirname
	});
	
	server.on("error", (error) => {
		console.error(`服务器启动失败: ${error.message}`);
		process.exit(1);
	});
	
	server.on("exit", (code) => {
		console.log(`服务器进程退出，代码: ${code}`);
	});
	
	return server;
}

function startClient(args = []) {
	console.log("🎯 启动无名杀CLI客户端...");
	
	const clientArgs = [
		join(__dirname, "cli-client.js"),
		...args
	];
	
	const client = spawn("node", clientArgs, {
		stdio: "inherit",
		cwd: __dirname
	});
	
	client.on("error", (error) => {
		console.error(`客户端启动失败: ${error.message}`);
		process.exit(1);
	});
	
	client.on("exit", (code) => {
		console.log(`客户端进程退出，代码: ${code}`);
	});
	
	return client;
}

function main() {
	if (argv.help) {
		showHelp();
		return;
	}
	
	// 构建启动参数
	const serverArgs = [];
	const clientArgs = [];
	
	// 服务器参数
	if (argv.port) serverArgs.push("--port", argv.port);
	if (argv.maxPlayers) serverArgs.push("--maxPlayers", argv.maxPlayers);
	if (argv.gameMode) serverArgs.push("--gameMode", argv.gameMode);
	if (argv.debug) serverArgs.push("--debug");
	
	// 客户端参数
	if (argv.server) clientArgs.push("--server", argv.server);
	if (argv.nickname) clientArgs.push("--nickname", argv.nickname);
	
	const processes = [];
	
	switch (argv.mode) {
		case "server":
			processes.push(startServer(serverArgs));
			break;
			
		case "client":
			processes.push(startClient(clientArgs));
			break;
			
		case "both":
			processes.push(startServer(serverArgs));
			// 等待服务器启动后再启动客户端
			setTimeout(() => {
				processes.push(startClient(clientArgs));
			}, 2000);
			break;
			
		default:
			console.error(`未知模式: ${argv.mode}`);
			showHelp();
			process.exit(1);
	}
	
	// 优雅退出
	process.on("SIGINT", () => {
		console.log("\n正在关闭所有进程...");
		processes.forEach(proc => {
			if (proc && !proc.killed) {
				proc.kill("SIGINT");
			}
		});
		process.exit(0);
	});
	
	process.on("SIGTERM", () => {
		processes.forEach(proc => {
			if (proc && !proc.killed) {
				proc.kill("SIGTERM");
			}
		});
		process.exit(0);
	});
}

main();