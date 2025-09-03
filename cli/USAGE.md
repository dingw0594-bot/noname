# 无名杀CLI模式使用指南

## 🚀 快速体验

### 方法一：使用Deno（推荐）

```bash
# 1. 启动CLI服务器
deno task cli-server

# 2. 在新终端启动客户端
deno task cli-client

# 3. 或者使用启动器
deno task cli-start --mode both
```

### 方法二：使用Node.js

```bash
# 1. 进入CLI目录并安装依赖
cd cli
npm install

# 2. 启动服务器
npm start

# 3. 在新终端启动客户端
npm run client
```

## 🎮 基础游戏流程

### 1. 连接服务器

```bash
无名杀> connect
✓ 已连接到服务器 localhost:8090
已分配玩家ID: abc123def456
```

### 2. 创建或加入房间

```bash
# 查看房间列表
无名杀> rooms

# 创建房间
无名杀> create "我的房间" 4 identity

# 加入房间
无名杀> join ABCD1234
```

### 3. 准备开始游戏

```bash
# 准备
无名杀> ready

# 等待其他玩家准备...
# 游戏自动开始
```

### 4. 游戏中操作

```bash
# 查看游戏状态
无名杀> state

# 使用卡牌
无名杀> card sha player2

# 回应选择（当游戏要求时）
无名杀> choice shan

# 使用技能
无名杀> skill rende player3

# 结束回合
无名杀> end

# 聊天
无名杀> say 大家好！
```

## 🎯 详细命令说明

### 连接管理

| 命令 | 说明 | 示例 |
|------|------|------|
| `connect [server]` | 连接到服务器 | `connect 192.168.1.100:8090` |
| `disconnect` | 断开连接 | `disconnect` |

### 房间操作

| 命令 | 说明 | 示例 |
|------|------|------|
| `rooms` | 查看房间列表 | `rooms` |
| `create <名称> [人数] [模式] [密码]` | 创建房间 | `create "测试房间" 6 guozhan` |
| `join <房间ID> [密码]` | 加入房间 | `join ABCD1234 password` |
| `leave` | 离开房间 | `leave` |
| `ready` | 切换准备状态 | `ready` |

### 游戏操作

| 命令 | 说明 | 示例 |
|------|------|------|
| `card <卡牌> [目标...]` | 使用卡牌 | `card sha player2` |
| `skill <技能> [目标...]` | 使用技能 | `skill rende player3` |
| `choice <选项>` | 回应选择 | `choice shan` |
| `end` | 结束回合 | `end` |
| `state` | 查看游戏状态 | `state` |

### 社交功能

| 命令 | 说明 | 示例 |
|------|------|------|
| `say <消息>` | 发送聊天 | `say 大家好！` |
| `nick <昵称>` | 设置昵称 | `nick 无名玩家` |

### 系统功能

| 命令 | 说明 | 示例 |
|------|------|------|
| `help` | 显示帮助 | `help` |
| `clear` | 清屏 | `clear` |
| `quit` | 退出 | `quit` |

## 🃏 游戏模式说明

### identity（身份局）
经典的身份局模式，包含主公、忠臣、反贼、内奸四种身份。

```bash
无名杀> create "身份局" 8 identity
```

### guozhan（国战）
三国势力对战模式，魏蜀吴群四个势力。

```bash
无名杀> create "国战" 6 guozhan
```

### versus（对决）
1v1或小队对战模式。

```bash
无名杀> create "对决" 4 versus
```

### single（单机）
单人练习模式，与AI对战。

```bash
无名杀> create "单机练习" 2 single
```

## 🎲 游戏示例

### 完整游戏流程示例

```bash
# 玩家A：创建房间
无名杀> connect
无名杀> nick "主机玩家"
无名杀> create "测试房间" 4 identity
房间创建成功: ABCD1234

# 玩家B：加入游戏
无名杀> connect  
无名杀> nick "玩家二"
无名杀> rooms
无名杀> join ABCD1234
已加入房间: 测试房间

# 所有玩家准备
无名杀> ready
等待其他玩家...
🎮 游戏开始! 🎮

# 游戏中
无名杀> state
=== 游戏状态 ===
回合: 1
当前玩家: 主机玩家
身份: 主公
血量: 5/5
手牌: 5张

# 出牌阶段
无名杀> card sha 玩家二
⚡ 请做出选择 (choose-card):
玩家二对你使用了杀，请出闪
输入: choice <卡牌名>

# 玩家二响应
无名杀> choice shan
🛡️ 玩家二 闪避了 主机玩家 的攻击

# 结束回合
无名杀> end
```

### 技能使用示例

```bash
# 刘备使用仁德
无名杀> skill rende 玩家二
请选择要给出的手牌
无名杀> choice 桃

# 郭嘉使用遗计
无名杀> skill yiji 玩家三
💚 郭嘉 为 玩家三 分配了2张牌
```

## 🔧 高级功能

### 服务器配置

```bash
# 自定义端口
deno task cli-server --port 8091

# 调试模式
deno task cli-server --debug

# 设置最大玩家数
deno task cli-server --maxPlayers 6
```

### 客户端配置

```bash
# 连接远程服务器
deno task cli-client --server 192.168.1.100:8090

# 设置昵称
deno task cli-client --nickname "我的昵称"
```

### 批量启动

```bash
# 同时启动服务器和客户端
deno task cli-start --mode both

# 启动多个客户端（用于测试）
deno task cli-start --mode client --nickname "玩家1" &
deno task cli-start --mode client --nickname "玩家2" &
deno task cli-start --mode client --nickname "玩家3" &
```

## 🌐 Web管理面板

访问 `http://localhost:8090/cli/admin.html` 可以：

- 查看服务器实时状态
- 监控房间和玩家
- 查看游戏统计
- 管理服务器设置

## 🐛 常见问题

### Q: 连接失败怎么办？
A: 检查服务器是否启动，端口是否正确，防火墙设置等。

### Q: 游戏卡住了？
A: 尝试输入 `state` 查看当前状态，或者 `help` 查看可用命令。

### Q: 如何邀请朋友？
A: 告诉朋友你的服务器IP和端口，让他们使用 `connect IP:端口` 连接。

### Q: 支持哪些卡牌和技能？
A: 支持无名杀的所有标准卡牌和角色技能，与原版完全兼容。

### Q: 如何保存游戏记录？
A: 游戏记录会自动保存，可以通过Web管理面板查看历史记录。

## 📝 开发者信息

- 版本：v1.0.0
- 兼容：无名杀 v1.10+
- 协议：GPL-3.0
- 项目地址：https://github.com/libnoname/noname

## 🤝 获取帮助

- 在游戏中输入 `help` 查看命令帮助
- 查看项目Wiki获取详细文档
- 在GitHub提交Issue报告问题
- 加入社区群组讨论交流