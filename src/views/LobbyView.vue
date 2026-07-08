<template>
  <div class="lobby">
    <div v-if="!joined" class="join-form">
      <h2>进入游戏大厅</h2>
      <input v-model="nameInput" placeholder="请输入您的名字" @keyup.enter="join" />
      <button @click="join" :disabled="!nameInput.trim()">进入大厅</button>
    </div>
    <div v-else class="tables-container">
      <div class="lobby-header">
        <h2>游戏大厅 - 欢迎 {{ lobby.playerName }}</h2>
        <button class="logout-btn" @click="logout">离开游戏大厅</button>
      </div>
      <div class="lobby-layout">
        <div class="help-section">
          <div class="help-header" @click="showHelp = !showHelp">
            <span>游戏说明</span>
            <span class="arrow">{{ showHelp ? '▲' : '▼' }}</span>
          </div>
          <div v-if="showHelp" class="help-content">
            <div class="help-item">
              <h3>游戏模式</h3>
              <ul>
                <li><b>双人对战</b>：两位玩家各坐一方，实时 WebSocket 对弈</li>
                <li><b>一人玩</b>：一人控制红黑双方，自由练习</li>
                <li><b>人机对战</b>：与 AI 对弈，支持简单/中等/困难三个难度</li>
                <li><b>旁观</b>：点击对弈中桌子的「旁观」按钮，可实时观看他人对局，人数不限</li>
              </ul>
            </div>
            <div class="help-item">
              <h3>如何开始</h3>
              <p><b>双人对战</b>：两位玩家分别选择不同桌子的红方和黑方入座，两人坐满后自动开始。</p>
              <p><b>单人/AI 模式</b>：先点击一张桌子的红方（或黑方）入座，再点击同一张桌子的另一个空位，会弹出模式选择对话框，选择「一人玩」或「人机对玩」即可开始。</p>
            </div>
            <div class="help-item">
              <h3>棋子走法</h3>
              <ul>
                <li><b>帅/将</b>：九宫格内上下左右移动一步</li>
                <li><b>仕/士</b>：九宫格内沿斜线移动一步</li>
                <li><b>相/象</b>：走「田」字对角，不能过河，有塞象眼</li>
                <li><b>马</b>：走「日」字，有蹩马腿</li>
                <li><b>车</b>：横竖直线移动，不限格数</li>
                <li><b>炮</b>：直线移动，吃子需隔一个棋子（翻山）</li>
                <li><b>兵/卒</b>：过河前只能向前，过河后可左右移动</li>
              </ul>
            </div>
            <div class="help-item">
              <h3>特殊规则</h3>
              <ul>
                <li>将对方的<b>将/帅</b>吃掉即可获胜</li>
                <li>无棋可走（困毙）也会判负</li>
                <li>将帅不能面对面（中间无棋子阻隔）</li>
              </ul>
            </div>
            <div class="help-item">
              <h3>操作按钮</h3>
              <ul>
                <li><b>悔棋</b>：撤回上一步操作（双人模式需对方同意）</li>
                <li><b>重新开始</b>：重新开局（双人模式需对方同意）</li>
                <li><b>离开对局</b>：返回大厅（双人对战中离开将判负）</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="tables-grid">
        <TableCard
          v-for="table in lobby.tables"
          :key="table.id"
          :table="table"
          :my-table-id="lobby.myTableId"
          :my-seat-index="lobby.mySeat"
          :spectator-count="table.spectatorCount || 0"
          @sit="onSit"
          @leave="onLeave"
          @select-mode="onSelectMode"
          @watch="onWatch"
        />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLobbyStore } from '../stores/lobby.js'
import TableCard from '../components/TableCard.vue'

const lobby = useLobbyStore()
const nameInput = ref('')
const joined = computed(() => !!lobby.playerName)
const showHelp = ref(false)

function join() {
  if (!nameInput.value.trim()) return
  lobby.connect(nameInput.value.trim())
}

function onSit(tableId, seatIndex) {
  lobby.sit(tableId, seatIndex)
}

function onLeave() {
  lobby.leave()
}

function onSelectMode(tableId, seatIndex, mode, depth) {
  lobby.selectMode(tableId, seatIndex, mode, depth)
}

function onWatch(tableId) {
  lobby.watch(tableId)
}

function logout() {
  lobby.disconnect()
}
</script>

<style scoped>
.lobby {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.join-form {
  text-align: center;
  margin-top: 100px;
}

.join-form h2 {
  margin-bottom: 20px;
  color: #5D4037;
}

.join-form input {
  padding: 10px 16px;
  font-size: 16px;
  border: 2px solid #8D6E63;
  border-radius: 8px;
  margin-right: 10px;
  width: 250px;
}

.join-form button {
  padding: 10px 24px;
  font-size: 16px;
  background: #8B4513;
  color: white;
  border: none;
  border-radius: 8px;
  transition: background 0.2s;
}

.join-form button:hover:not(:disabled) {
  background: #A0522D;
}

.join-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.tables-container h2 {
  margin-bottom: 20px;
  color: #5D4037;
}

.lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.logout-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: #EF5350;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: #E53935;
}

.lobby-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.help-section {
  width: 280px;
  flex-shrink: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
  position: sticky;
  top: 20px;
}

.tables-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  cursor: pointer;
  font-weight: bold;
  font-size: 16px;
  color: #5D4037;
  background: #FFF8E1;
  user-select: none;
}

.help-header:hover {
  background: #FFECB3;
}

.arrow {
  font-size: 12px;
  color: #9E9E9E;
}

.help-content {
  padding: 16px 20px;
}

.help-item {
  margin-bottom: 16px;
}

.help-item:last-child {
  margin-bottom: 0;
}

.help-item h3 {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: #5D4037;
}

.help-item p {
  margin: 0;
  font-size: 14px;
  color: #616161;
  line-height: 1.6;
}

.help-item ul {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  color: #616161;
  line-height: 1.8;
}

.help-item b {
  color: #424242;
}
</style>
