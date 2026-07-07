# Chess Project Memory

## 2026-07-01 修改记录

### 离开棋局回到大厅
- `LobbyView.vue` 的 `joined` 改为 `computed(() => !!lobby.playerName)`，避免回到大厅显示登录界面
- 服务端 `leaveSeat()` 返回座位索引（非布尔值），`removeUser()` 返回 `{ tableId, seatIndex }`
- `TABLE_LEAVE` 和断线广播必须带正确的 `seatIndex`，否则客户端无法清除座位状态

### 悔棋逻辑修复
- `makeMove` 记录 `fromPlayer` 到 moveHistory
- `requestUndo` 只允许走出最后一步的玩家悔棋（`fromPlayer === userId`）
- `applyUndo` 恢复 `lastMovePlayer` 为历史记录中的走棋者（不置空）
- 悔棋按钮：`!game.myTurn && !game.gameOver && game.lastMove`，即刚走完棋的人可见

### 棋盘重绘
- 从格子布局改为线条+交叉点布局
- 交叉点用显示索引 `ri * cellSize` 定位（非逻辑坐标），支持翻转
- 横线 10 条，竖线两侧（列0、8）贯穿，中间（列1~7）河界断开
- 九宫斜线 45°
- 星位标记：兵/炮初始位置四角括号，朝向交叉点内部
- 星位标记翻转时也用显示坐标

### 棋子渲染
- 绝对定位居中，`transform: translate(-50%, -50%)`
- 选中/悬停的 scale 变换需合并 translate
- 木质质感：radial-gradient 高光+暗部，linear-gradient 底色

### 棋盘视觉
- 木质纹理：repeating-linear-gradient 叠加木纹条纹
- 纯色底 #D4A862（不用渐变）
- 内阴影模拟立体感，边框 #6B3010
- "楚河""汉界"字号 24px，left/right: 102px

### 注意事项
- 服务端 .js 改动需手动重启（Vite HMR 只热更新客户端）
- CSS 中不能用 `4.5 * 60px` 语法，需用 calc() 或直接写像素值

### 客户端记忆功能
- 用户名保存到 localStorage（key: `chess_playerName`），在 `lobby.connect()` 时写入
- LobbyView `onMounted` 读取并自动连接，跳过登录界面

## 待办

（无）

### Playwright 自动化测试（2026-07-07 已完成）
- 测试覆盖：大厅进入、双人对战、单人模式、AI 对战、旁观者、UI 交互、离开游戏室
- 需同时启动两个服务器：Vite dev server (5173) + Backend server (3000)
- playwright.config.ts 使用 webServer 数组同时启动两个服务

### 离开游戏室按钮（2026-07-07 已完成）
- lobby store 添加 `disconnect()` 方法：清除 localStorage、断开 WebSocket、重置状态
- LobbyView 添加"离开游戏室"按钮，点击后回到登录界面
- wsClient 添加 `isManualClose` 标志，手动关闭时阻止自动重连
