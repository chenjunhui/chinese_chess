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

### 离开游戏室按钮（未完成）
- LobbyView 大厅界面增加"离开游戏室"按钮
- 点击后：清除 localStorage 的 `chess_playerName`，断开 WebSocket（`wsClient.close()`），重置 lobby store 状态，回到登录界面
- 需要在 lobby store 添加 `disconnect()` 方法，内部调用 `wsClient.close()` 并重置所有状态
- 同时需要关闭自动重连（wsClient.onclose 中的 reconnectTimer）

## 2026-07-02 修改记录

### 重新开始功能
- GameView.vue 添加"重新开始"按钮，始终显示（游戏进行中和结束后都可见）
- 服务器端处理 `GAME_RESTART` 和 `GAME_RESTART_RESPOND` 消息
- 对方同意后创建新 GameState，发送 `GAME_START` 给双方，棋盘回到初始状态
- **关键 bug fix**: 服务器启动游戏时必须设置 `table.isPlaying = true`，否则重启请求被 `if (!table || !table.isPlaying) break` 阻止
- `table.isPlaying` 在玩家离开或断线时设为 `false`

### 座位选择
- 玩家在大厅直接选择红方/黑方座位（点击对应座位的"坐下"按钮）
- 服务器 `sitDown()` 新增 `seatIndex` 参数，直接分配到指定位置
- seat 0 = 红方，seat 1 = 黑方

### table.isPlaying 状态修复
- 游戏开始时必须设置 `table.isPlaying = true`
- 游戏结束时设置 `table.isPlaying = false`
- 玩家离开或断线时，如果两个座位都空了，也要设置 `table.isPlaying = false`
- 涉及代码路径：TABLE_SIT, GAME_OVER, TABLE_LEAVE, ws.on('close'), leaveSeat(), removeUser()

### 单人玩模式（一人控制红黑双方）
- 玩家坐下后点击另一个座位，弹出模式选择对话框（一人玩/人机对玩）
- 选择"一人玩"后，服务器创建 GameState，两个座位都是同一用户
- 服务器 GameState 添加 `isSinglePlayer` 标志（检查两个玩家 userId 是否相同）
- `getPlayerColor(userId, currentTurn)` 在单人模式下返回 `currentTurn`
- 客户端 `gameMode` 状态：'multiplayer' | 'single' | 'ai'
- 单人模式下：`myTurn` 始终为 true，可移动任意一方棋子
- 单人模式下：离开时不提示"判负"
- 单人模式下悔棋：无需对方确认，服务器检测到 `isSinglePlayer` 直接执行 `applyUndo`，只发 `GAME_UNDO_RESULT` 给自己
- 单人模式下重新开始：服务器检测两个座位同一用户，直接调用 `startGameForTable`，跳过请求/确认流程
- 单人模式重新开始前弹出 `confirm('你想重新开始玩吗？')`
- **ChessBoard 点击逻辑**：先判断吃子/走子（`selectedPiece && isValid && 非当前回合颜色`），再判断选中棋子（`piece.color === currentTurn`）。用 `currentTurn` 而非 `myColor` 判断，否则黑方回合吃红子被误判为"吃自己人"
- **离开单人模式座位清理**：`TABLE_LEAVE` 需遍历两个座位，如果都是同一用户则都清除，否则只剩一个座位有数据
- 相关文件：TableCard.vue, LobbyView.vue, lobby.js, game.js, GameView.vue, ChessBoard.vue, protocol.js, index.js, gameState.js

### 代码优化与 bug 修复
- 抽取 `startGameForTable(tableId, gameMode)` 公共函数，替代 3 处重复的游戏启动逻辑（TABLE_SIT、GAME_SELECT_MODE、GAME_RESTART_RESPOND）
- `game.js selectPiece`：简化单人/多人分支，去掉冗余重复代码
- `index.js ws.on('close')`：修复单人模式断线只清一个座位的 bug，改为遍历两个座位
- `GameView.vue`：删除未使用的 `PIECE_NAMES` 导入
- **重启请求条件修复**：`GAME_RESTART` 和 `GAME_RESTART_RESPOND` 的判断从 `!table.isPlaying` 改为 `!table.seats[0] || !table.seats[1]`。游戏结束后 `isPlaying` 为 false，会导致重启请求被静默丢弃，改为检查座位是否有人即可
- **`startGameForTable` 自动检测 gameMode**：若未传 gameMode，自动根据两座位 userId 是否相同判断 'single' 或 'multiplayer'，避免重启后 gameMode 被重置为 'multiplayer'

### 人机对玩模式（AI）
- 新增 `src/game/ai.js`：Minimax + Alpha-Beta 剪枝算法，搜索深度可配置（1/2/3层）
- 棋子价值：K=10000, R=900, C=450, N=400, B=200, A=200, P=100（过河前）/200（过河后）
- 位置权重表：每种棋子有 10×9 的位置价值矩阵，如马在中心更好、车在开阔行更好
- AI 始终执黑，玩家执红，两个座位用同一 userId（和单人模式一致）
- AI 回合处理：`GAME_MOVED` 后检测轮到 AI → `thinking=true` → setTimeout 500ms → `getAIMove()` → 发送 GAME_MOVE
- AI 思考期间 `thinking=true`，禁用棋盘点击，显示"AI 思考中..."动画
- 难度选择：点击黑方座位 → 选"人机对玩" → 二级对话框选简单(深度1)/中等(深度2)/困难(深度3)
- 悔棋：AI 模式下只撤回 AI 的走法（当前回合为 RED 时允许撤回），需 confirm 确认
- 重新开始：AI 模式直接重启（和单人模式相同），需 confirm 确认
- 游戏结束提示：AI 模式显示"红方获胜!/黑方获胜!"（和单人模式相同）
- 相关文件：ai.js, game.js, GameView.vue, TableCard.vue, lobby.js, index.js, gameState.js
- **悔棋修复**：`applyUndo` 新增 `skipTurnFlip` 参数，单人/AI 模式下跳过 turn 翻转，服务器返回 `turn: RED`，客户端和服务器状态一致
- **重启保持 gameMode**：桌子对象新增 `gameMode` 字段，`startGameForTable` 优先使用 `table.gameMode`，避免重启后 AI 模式退化为单人模式。游戏结束或离开时清除 `table.gameMode`

### AI 算法增强
- **走法排序**（`orderMoves`）：搜索前按吃子价值差排序，吃大子的走法先搜，Alpha-Beta 剪枝效率大幅提升
- **静默搜索**（`quiesce`）：到达搜索深度后继续搜索吃子走法，避免地平线效应（AI 在关键吃子前停下看不到）
- **将军加分**：评估函数中将军对方 +50 分，被将军 -50 分
- **吃子优先级公式**：`moveScore = (目标棋子价值 × 10 - 源棋子价值)`，用小子吃大子排最前

### 大厅 UI 改动
- 桌子数量改为 6 张（`TABLE_COUNT = 6`）
- 大厅最大宽度 1200px，桌子固定 2 列并排
- 游戏说明放左侧区域（280px 宽，`position: sticky` 固定不动），可折叠展开
- 游戏说明内容：游戏模式、如何开始、棋子走法、特殊规则、操作按钮
- 标题"欢迎"后逗号改为空格

### 游戏说明放在桌子左侧区域
- 使用 `lobby-layout` flex 布局，左侧 help-section + 右侧 tables-grid
- help-section 设置 `position: sticky; top: 20px`，滚动时固定
- 默认收拢，点击展开

## 2026-07-03 修改记录

### 悔棋逻辑修复（两个 bug）
- **Bug 1 — 多人模式红方不能悔棋**：`GameView.vue` 悔棋按钮条件从 `game.turn === 'red'` 改为 `game.turn !== game.myColor`。原来只有黑方走完（轮到红方时）才显示按钮，改为"不是自己的回合时可见"（即刚走完棋的人可悔棋）
- **Bug 2 — AI 模式只回退一步**：新增 `applySinglePlayerUndo()` 方法，根据 `currentTurn` 判断最后一步是谁走的：
  - `currentTurn === RED`（AI 刚走完）→ 回退 2 步（AI + 玩家）
  - `currentTurn === BLACK`（玩家刚走完）→ 回退 1 步（玩家）
  - 完成后强制 `currentTurn = RED`，始终轮到人下棋
- 前端文件：`src/views/GameView.vue`
- 后端文件：`server/index.js`, `server/gameState.js`

### AI 悔棋定时器修复
- AI 模式悔棋时需清除 `setTimeout` 定时器，否则定时器触发后会发送无效的 GAME_MOVE 导致"不能移动对方棋子"报错
- 在 `requestUndo` 中立即清除定时器，而非等 GAME_UNDO_RESULT 回来再清（避免竞态条件）
- 新增 `aiTimer` 变量存储定时器 ID

### 弹窗统一为自定义样式
- 所有原生 `confirm()` / `alert()` 替换为自定义毛玻璃弹窗
- 风格：半透明背景 + backdrop-filter: blur(4px) + 渐变按钮 + 悬停上浮效果
- 新增 `showConfirm(message)` 返回 Promise，`showAlert(message)` 仅展示
- 涉及文件：`game.js`（store）、`GameView.vue`、`TableCard.vue`、`GameResult.vue`

### AI 难度选择弹窗闪烁修复
- `table-card` 的 `transform: translateY(-2px)` 导致内部 `position: fixed` 失效
- 使用 `<Teleport to="body">` 将弹窗传送到 body 上，脱离父组件 transform 影响

### 多人对战改名为双人对战
- `README.md`、`LobbyView.vue` 中所有"多人"改为"双人"

### 直接访问 /game 路由守卫
- `router/index.js` 添加 `beforeEach` 守卫，未进入游戏时访问 `/game` 自动跳转首页

### 棋盘最后一步高亮
- 红黑双方的最后一步分别用不同颜色高亮（红色/深灰色半透明 + 光晕）
- 新增 `lastMoveRed` / `lastMoveBlack` ref，分别追踪双方最后一步

### AI 思考中标签优化
- 从独立行改为绝对定位叠在棋盘中央，不占布局空间
- 悔棋结果回来时重置 `thinking` 状态

### 旁观者功能
- **服务端**：`rooms.js` 新增 `spectators` 数组追踪旁观者；`index.js` 新增 `TABLE_WATCH` handler
- **客户端**：`lobby.js` 新增 `watch()` 方法；`game.js` 新增 `isSpectator` 状态
- **大厅**：TableCard 新增"旁观"按钮（仅对弈中的桌子显示），显示旁观人数
- **游戏界面**：旁观者显示"旁观中"标签，隐藏悔棋/重启按钮，禁止操作棋子
- **棋盘**：旁观者加入时同步最后一步高亮
- **悔棋同步**：单人/AI 模式悔棋结果发送给桌上所有客户端（含旁观者）
- **游戏结束**：旁观者显示"对局结束"而非"恭喜你赢了"
- **AI 难度**：旁观者加入时从 `table.aiDepth` 获取难度信息
- 涉及文件：`server/protocol.js`、`server/rooms.js`、`server/index.js`、`src/ws/protocol.js`、`src/stores/lobby.js`、`src/stores/game.js`、`src/components/TableCard.vue`、`src/views/LobbyView.vue`、`src/views/GameView.vue`、`src/components/GameResult.vue`

## 待办

### 离开游戏室按钮（未完成）
- LobbyView 大厅界面增加"离开游戏室"按钮
- 点击后：清除 localStorage 的 `chess_playerName`，断开 WebSocket，重置 lobby store 状态，回到登录界面

### Playwright 自动化测试（2026-07-04）
- 已安装 playwright（devDependency），Chromium 浏览器下载中断，需完成安装
- 测试用例覆盖：大厅进入、双人对战、单人模式、AI 对战、悔棋、旁观者、游戏结束
- 测试脚本放在 `tests/` 目录
