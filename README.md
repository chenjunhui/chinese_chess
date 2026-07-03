# 中国象棋

在线双人中国象棋对弈平台，支持双人对战、单人双控、人机对战三种模式。

## 功能特性

- **双人对战**：两位玩家分别选择不同桌子的红方和黑方入座，坐满后自动开始
- **单人模式**：一人控制红黑双方，自行对弈
- **人机对战**：与 AI 对弈，支持简单/中等/困难三个难度（Minimax + Alpha-Beta 剪枝）
- **悔棋**：支持撤回走法，人机模式下可撤回玩家和 AI 的走法
- **重新开始**：随时重新开局
- **完整规则**：将/帅、车、马、炮、士、象、兵全部走法校验，包含蹩马腿、塞象眼、炮翻山、将帅对面等规则

## 技术架构

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Pinia + Vue Router |
| 构建 | Vite |
| 后端 | Node.js + Express + WebSocket (ws) |
| 通信 | WebSocket 实时双向通信 |

```
┌─────────────┐    WebSocket    ┌─────────────┐
│   前端客户端  │ ◄────────────► │  Node.js 服务端  │
│  Vue 3 + Pinia│               │  Express + ws   │
│  Vite 开发服务 │               │  游戏状态管理     │
└─────────────┘               └─────────────┘
```

## 项目结构

```
chinese-chess/
├── src/
│   ├── views/          # 页面组件
│   │   ├── LobbyView.vue    # 大厅
│   │   └── GameView.vue     # 游戏页面
│   ├── components/     # 可复用组件
│   │   ├── ChessBoard.vue   # 棋盘
│   │   ├── TableCard.vue    # 桌子卡片
│   │   └── GameResult.vue   # 游戏结果弹窗
│   ├── stores/         # Pinia 状态管理
│   │   ├── lobby.js         # 大厅状态
│   │   └── game.js          # 游戏状态
│   ├── game/           # 棋盘逻辑
│   │   ├── board.js         # 棋盘渲染
│   │   ├── rules.js         # 走法规则
│   │   ├── ai.js            # AI 算法
│   │   └── constants.js     # 常量定义
│   ├── ws/             # WebSocket 通信
│   │   ├── client.js        # 客户端封装
│   │   └── protocol.js      # 消息协议
│   └── router/         # 路由配置
├── server/
│   ├── index.js        # 服务端入口
│   ├── gameState.js    # 游戏状态管理
│   ├── rooms.js        # 房间管理
│   └── protocol.js     # 消息协议
└── package.json
```

## 运行指南

### 环境要求

- Node.js >= 16

### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..
```

### 启动服务

需要同时启动前后端两个服务：

```bash
# 终端 1：启动后端服务（端口 3000）
cd server && npm start

# 终端 2：启动前端开发服务（端口 5173）
npm run dev
```

### 访问游戏

打开浏览器访问 http://localhost:5173

## 游戏规则

| 棋子 | 走法 |
|---|---|
| 将/帅 | 宫内横竖一格 |
| 士 | 宫内斜走一格 |
| 象 | 斜走两格，不能过河，蹩象眼不能走 |
| 马 | 走"日"字，蹩马腿不能走 |
| 车 | 横竖任意格 |
| 炮 | 横竖移动，吃子必须隔一个棋子翻山 |
| 兵 | 未过河只能前进，过河后可左右移动 |

- 将帅不能在同一列直接对面（对面笑）
- 不能送将（被将军必须应将）
- 吃掉对方将/帅即获胜
