# 无名杀 CLI 模式

基于无名杀的命令行交互模式，支持完整的游戏功能和联机对战。

## 🚀 快速开始

### 安装依赖

```bash
cd cli
npm install
```

### 启动服务器

```bash
# 基础启动
npm start

# 调试模式
npm run dev

# 自定义端口和设置
node cli-server.js --port 8091 --maxPlayers 6 --debug
```

### 启动客户端

```bash
# 默认连接本地服务器
npm run client

# 连接指定服务器
node cli-client.js --server 192.168.1.100:8090 --nickname "我的昵称"
```

## 🎮 游戏功能

### 完整功能支持

- ✅ **多人联机** - 支持最多8人同时游戏
- ✅ **所有游戏模式** - 身份局、国战、对决等
- ✅ **完整卡牌系统** - 支持所有标准卡牌和扩展卡牌
- ✅ **技能系统** - 支持所有角色技能
- ✅ **AI对手** - 支持AI玩家填充
- ✅ **实时聊天** - 房间内聊天功能
- ✅ **游戏回放** - 保存和回放游戏记录

### 游戏模式

- **identity** - 身份局（主公、忠臣、反贼、内奸）
- **guozhan** - 国战模式
- **versus** - 对决模式
- **single** - 单机模式
- **doudizhu** - 斗地主模式

## 📖 命令参考

### 连接命令

```bash
connect [server:port]    # 连接到服务器
disconnect              # 断开连接
```

### 房间命令

```bash
rooms                   # 查看房间列表
create <名称> [人数] [模式] [密码]  # 创建房间
join <房间ID> [密码]     # 加入房间
leave                   # 离开房间
ready                   # 准备/取消准备
```

### 游戏命令

```bash
card <卡牌名> [目标...]  # 使用卡牌
skill <技能名> [目标...] # 使用技能
end                     # 结束回合
state                   # 查看游戏状态
```

### 交互命令

```bash
say <消息>              # 发送聊天
nick <昵称>             # 设置昵称
help                    # 显示帮助
clear                   # 清屏
quit                    # 退出
```

### 选择回应

当游戏要求做选择时，使用：
```bash
choice <选项>           # 回应游戏选择请求
```

## 🔧 服务器配置

### 命令行参数

```bash
--port, -p <端口>       # 服务器端口 (默认: 8090)
--maxPlayers, -m <数量> # 最大玩家数 (默认: 8)
--gameMode, -g <模式>   # 默认游戏模式 (默认: identity)
--debug, -d             # 启用调试模式
```

### 环境变量

```bash
NONAME_CLI_PORT=8090           # 服务器端口
NONAME_CLI_MAX_PLAYERS=8       # 最大玩家数
NONAME_CLI_DEBUG=true          # 调试模式
```

## 🌐 Web管理面板

访问 `http://localhost:8090/cli/admin.html` 查看：

- 实时服务器状态
- 房间和玩家信息
- 游戏统计数据
- 服务器日志

## 🎯 使用示例

### 创建并开始游戏

```bash
# 玩家1: 启动服务器
node cli-server.js --debug

# 玩家1: 连接并创建房间
node cli-client.js --nickname "主机"
> connect
> create "测试房间" 4 identity
> ready

# 玩家2: 加入游戏
node cli-client.js --nickname "玩家2"
> connect
> rooms
> join ABCD1234
> ready

# 游戏开始后
> card sha player2     # 对玩家2使用杀
> choice shan          # 出闪响应
> skill rende player3  # 使用技能
> end                  # 结束回合
```

### 查看游戏状态

```bash
> state
=== 游戏状态 ===
回合: 1
阶段: 出牌阶段
当前玩家: player1

玩家状态:
  刘备 (你): 存活 HP:4/4 手牌:5
  曹操: 存活 HP:4/4 手牌:4
  孙权: 存活 HP:3/4 手牌:3
```

## 🔌 API接口

### HTTP API

- `GET /api/rooms` - 获取房间列表
- `POST /api/rooms` - 创建房间
- `POST /api/game-action` - 游戏动作

### WebSocket 消息

客户端到服务器：
```json
{
  "type": "join-room",
  "roomId": "ABCD1234",
  "password": "optional"
}
```

服务器到客户端：
```json
{
  "type": "game-started",
  "gameMode": "identity",
  "players": [...]
}
```

## 🛠️ 开发说明

### 架构设计

```
cli-server.js     # WebSocket服务器和房间管理
cli-client.js     # 命令行客户端界面
cli-game.js       # 游戏逻辑集成
cli-adapter.js    # UI适配器，将图形界面转换为命令行
admin.html        # Web管理面板
```

### 集成原理

1. **UI适配** - 拦截无名杀的UI调用，转换为命令行消息
2. **事件转换** - 将鼠标点击转换为命令行输入
3. **状态同步** - 实时同步游戏状态到所有客户端
4. **网络通信** - 使用WebSocket保证实时性

### 扩展开发

要添加新的游戏功能：

1. 在 `cli-game.js` 中添加游戏逻辑处理
2. 在 `cli-client.js` 中添加对应的命令
3. 在 `cli-adapter.js` 中添加UI适配
4. 更新命令帮助和文档

## 🐛 故障排除

### 常见问题

1. **连接失败**
   - 检查服务器是否启动
   - 确认端口没有被占用
   - 检查防火墙设置

2. **游戏卡顿**
   - 启用调试模式查看详细日志
   - 检查网络延迟
   - 减少同时在线玩家数

3. **功能异常**
   - 查看服务器控制台日志
   - 检查是否缺少依赖
   - 确认游戏模式文件完整

### 日志查看

```bash
# 服务器日志
node cli-server.js --debug

# 客户端详细输出
DEBUG=* node cli-client.js
```

## 📝 更新日志

### v1.0.0
- 初始版本发布
- 支持基础游戏功能
- 命令行交互界面
- WebSocket联机功能
- Web管理面板

## 🤝 贡献

欢迎提交Issue和Pull Request！

1. Fork本项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 📄 许可证

GPL-3.0 License - 与无名杀主项目保持一致