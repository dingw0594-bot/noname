#!/bin/bash

# 无名杀CLI模式启动脚本

set -e

echo "🎮 无名杀CLI模式启动器"
echo "=========================="

# 检查Deno是否安装
if command -v deno &> /dev/null; then
    echo "✓ 检测到Deno环境"
    RUNTIME="deno"
elif command -v node &> /dev/null; then
    echo "✓ 检测到Node.js环境"
    RUNTIME="node"
else
    echo "❌ 未检测到Deno或Node.js环境"
    echo "请安装Deno或Node.js后重试"
    exit 1
fi

# 解析命令行参数
MODE="server"
PORT="8090"
NICKNAME="玩家$(date +%s | tail -c 4)"
SERVER="localhost:8090"
DEBUG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -n|--nickname)
            NICKNAME="$2"
            shift 2
            ;;
        -s|--server)
            SERVER="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG="--debug"
            shift
            ;;
        -h|--help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  -m, --mode <模式>     启动模式: server|client|both (默认: server)"
            echo "  -p, --port <端口>     服务器端口 (默认: 8090)"
            echo "  -n, --nickname <昵称> 玩家昵称"
            echo "  -s, --server <地址>   服务器地址 (默认: localhost:8090)"
            echo "  -d, --debug           启用调试模式"
            echo "  -h, --help           显示帮助"
            echo ""
            echo "示例:"
            echo "  $0                    # 启动服务器"
            echo "  $0 -m client          # 启动客户端"
            echo "  $0 -m both            # 同时启动服务器和客户端"
            exit 0
            ;;
        *)
            echo "未知参数: $1"
            echo "使用 -h 查看帮助"
            exit 1
            ;;
    esac
done

# 启动函数
start_server() {
    echo "🚀 启动CLI服务器 (端口: $PORT)..."
    if [ "$RUNTIME" = "deno" ]; then
        deno run --unstable-detect-cjs --allow-all cli/cli-server.js --port $PORT $DEBUG
    else
        cd cli && node cli-server.js --port $PORT $DEBUG
    fi
}

start_client() {
    echo "🎯 启动CLI客户端..."
    if [ "$RUNTIME" = "deno" ]; then
        deno run --unstable-detect-cjs --allow-all cli/cli-client.js --server $SERVER --nickname "$NICKNAME"
    else
        cd cli && node cli-client.js --server $SERVER --nickname "$NICKNAME"
    fi
}

# 根据模式启动
case $MODE in
    server)
        start_server
        ;;
    client)
        start_client
        ;;
    both)
        echo "📦 同时启动服务器和客户端..."
        start_server &
        SERVER_PID=$!
        sleep 3
        start_client &
        CLIENT_PID=$!
        
        # 等待进程结束
        wait $SERVER_PID $CLIENT_PID
        ;;
    *)
        echo "❌ 未知模式: $MODE"
        echo "支持的模式: server, client, both"
        exit 1
        ;;
esac