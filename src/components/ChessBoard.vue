<template>
  <div class="board-wrapper">
    <div class="board-label top">
      {{ myColor === 'red' ? opponentName : playerName }}
      <span class="color-dot black"></span>
    </div>
    <div class="board">
      <div class="grid" :style="{ width: boardWidth + 'px', height: boardHeight + 'px' }">
        <!-- 横线 -->
        <div v-for="r in ROWS" :key="'h' + r" class="h-line" :style="{ top: (r - 1) * cellSize + 'px' }"></div>
        <!-- 竖线: 两侧贯穿 -->
        <div v-for="c in [0, 8]" :key="'vf' + c" class="v-line" :style="{ left: c * cellSize + 'px', top: 0, height: boardHeight + 'px' }"></div>
        <!-- 竖线: 上半(row 0~4) -->
        <div v-for="c in [1,2,3,4,5,6,7]" :key="'v1' + c" class="v-line" :style="{ left: c * cellSize + 'px', top: 0, height: 4 * cellSize + 'px' }"></div>
        <!-- 竖线: 下半(row 5~9) -->
        <div v-for="c in [1,2,3,4,5,6,7]" :key="'v2' + c" class="v-line" :style="{ left: c * cellSize + 'px', top: 5 * cellSize + 'px', height: 4 * cellSize + 'px' }"></div>
        <!-- 河界文字 -->
        <div class="river-text river-left">楚 河</div>
        <div class="river-text river-right">汉 界</div>
        <!-- 九宫斜线(上) -->
        <div class="palace-line" :style="{ top: 0, left: 3 * cellSize + 'px', width: 2 * cellSize + 'px', height: 2 * cellSize + 'px' }">
          <div class="diag diag-a"></div>
          <div class="diag diag-b"></div>
        </div>
        <!-- 九宫斜线(下) -->
        <div class="palace-line" :style="{ top: 7 * cellSize + 'px', left: 3 * cellSize + 'px', width: 2 * cellSize + 'px', height: 2 * cellSize + 'px' }">
          <div class="diag diag-a"></div>
          <div class="diag diag-b"></div>
        </div>
        <!-- 交叉点 + 棋子 -->
        <template v-for="(r, ri) in displayRows" :key="r.orig">
          <div
            v-for="(c, ci) in displayCols"
            :key="c.orig"
            class="intersection"
            :class="{
              selected: isSelected(r.orig, c.orig),
              valid: isValid(r.orig, c.orig),
              'last-move-red': isLastMove(r.orig, c.orig) === 'red',
              'last-move-black': isLastMove(r.orig, c.orig) === 'black'
            }"
            :style="{ left: ci * cellSize + 'px', top: ri * cellSize + 'px' }"
            @click="onCellClick(r.orig, c.orig)"
          >
            <ChessPiece
              v-if="getPiece(r.orig, c.orig)"
              :type="getPiece(r.orig, c.orig).type"
              :color="getPiece(r.orig, c.orig).color"
              :selected="isSelected(r.orig, c.orig)"
              :valid="isValid(r.orig, c.orig)"
              @click.stop="onCellClick(r.orig, c.orig)"
            />
          </div>
        </template>
        <!-- 星位标记 -->
        <div
          v-for="(m, mi) in starMarks"
          :key="'s' + mi"
          class="star-mark"
          :style="{ left: m.dc * cellSize + 'px', top: m.dr * cellSize + 'px' }"
        >
          <div v-if="m.tl" class="star-tl"></div>
          <div v-if="m.tr" class="star-tr"></div>
          <div v-if="m.bl" class="star-bl"></div>
          <div v-if="m.br" class="star-br"></div>
        </div>
      </div>
    </div>
    <div class="board-label bottom">
      {{ myColor === 'red' ? playerName : opponentName }}
      <span class="color-dot red"></span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ROWS, COLS } from '../game/constants.js'
import ChessPiece from './ChessPiece.vue'

  const props = defineProps({
  board: { type: Array, required: true },
  myColor: { type: String, required: true },
  playerName: { type: String, default: '' },
  opponentName: { type: String, default: '' },
  selectedPiece: { type: Array, default: null },
  validMoves: { type: Array, default: () => [] },
  gameMode: { type: String, default: 'multiplayer' },
  currentTurn: { type: String, default: 'red' },
  lastMoveRed: { type: Object, default: null },
  lastMoveBlack: { type: Object, default: null }
})

const emit = defineEmits(['select', 'move'])

const cellSize = 60
const boardWidth = (COLS - 1) * cellSize
const boardHeight = (ROWS - 1) * cellSize

const flipped = computed(() => props.myColor === 'black')

const displayRows = computed(() => {
  const rows = []
  for (let i = 0; i < ROWS; i++) {
    rows.push({ orig: flipped.value ? 9 - i : i })
  }
  return rows
})

const displayCols = computed(() => {
  const cols = []
  for (let i = 0; i < COLS; i++) {
    cols.push({ orig: flipped.value ? 8 - i : i })
  }
  return cols
})

function getPiece(r, c) {
  return props.board[r]?.[c] || null
}

function isSelected(r, c) {
  return props.selectedPiece && props.selectedPiece[0] === r && props.selectedPiece[1] === c
}

function isValid(r, c) {
  return props.validMoves.some(([vr, vc]) => vr === r && vc === c)
}

function isLastMove(r, c) {
  if (props.lastMoveRed) {
    if ((props.lastMoveRed.from[0] === r && props.lastMoveRed.from[1] === c) ||
        (props.lastMoveRed.to[0] === r && props.lastMoveRed.to[1] === c)) {
      return 'red'
    }
  }
  if (props.lastMoveBlack) {
    if ((props.lastMoveBlack.from[0] === r && props.lastMoveBlack.from[1] === c) ||
        (props.lastMoveBlack.to[0] === r && props.lastMoveBlack.to[1] === c)) {
      return 'black'
    }
  }
  return null
}

function onCellClick(r, c) {
  const piece = getPiece(r, c)
  if (props.selectedPiece && isValid(r, c) && !(piece && piece.color === props.currentTurn)) {
    emit('move', props.selectedPiece[0], props.selectedPiece[1], r, c)
  } else if (piece && piece.color === props.currentTurn) {
    emit('select', r, c)
  } else {
    emit('select', -1, -1)
  }
}

const starPositions = [
  [2, 1], [2, 7], [7, 1], [7, 7],
  [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
  [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]
]

const starMarks = computed(() => {
  return starPositions.map(([r, c]) => {
    const dr = flipped.value ? 9 - r : r
    const dc = flipped.value ? 8 - c : c
    return {
      dr, dc,
      tl: c !== 0,
      tr: c !== 8,
      bl: c !== 0,
      br: c !== 8
    }
  })
})
</script>

<style scoped>
.board-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.board-label {
  padding: 8px 16px;
  font-size: 16px;
  font-weight: bold;
  color: #5D4037;
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid;
}

.color-dot.red {
  background: #FFF8E1;
  border-color: #D32F2F;
}

.color-dot.black {
  background: #ECEFF1;
  border-color: #37474F;
}

.board {
  background:
    repeating-linear-gradient(
      95deg,
      rgba(160,100,30,0.08) 0px,
      transparent 1px,
      transparent 4px,
      rgba(120,70,15,0.05) 5px,
      transparent 6px,
      transparent 14px
    ),
    repeating-linear-gradient(
      87deg,
      rgba(180,120,40,0.06) 0px,
      transparent 2px,
      transparent 18px
    ),
    repeating-linear-gradient(
      0deg,
      rgba(139,69,19,0.03) 0px,
      transparent 1px,
      transparent 10px
    ),
    #D4A862;
  border-radius: 8px;
  box-shadow:
    inset 0 1px 4px rgba(255,230,160,0.4),
    inset 0 -2px 6px rgba(80,40,10,0.2),
    inset 2px 0 4px rgba(80,40,10,0.08),
    inset -2px 0 4px rgba(80,40,10,0.08),
    0 4px 20px rgba(0,0,0,0.35);
  border: 3px solid #6B3010;
  padding: 30px;
}

.grid {
  position: relative;
}

.h-line {
  position: absolute;
  left: 0;
  width: 100%;
  height: 1px;
  background: #5D4037;
}

.v-line {
  position: absolute;
  width: 1px;
  background: #5D4037;
}

.palace-line {
  position: absolute;
  pointer-events: none;
}

.diag {
  position: absolute;
  width: 141.4%;
  height: 1px;
  background: #5D4037;
  top: 50%;
  left: 50%;
}

.diag-a {
  transform: translate(-50%, -50%) rotate(45deg);
}

.diag-b {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.river-text {
  position: absolute;
  top: 270px;
  font-size: 24px;
  font-weight: bold;
  color: #5D4037;
  letter-spacing: 6px;
  transform: translateY(-50%);
}

.river-left {
  left: 102px;
}

.river-right {
  right: 102px;
}

.intersection {
  position: absolute;
  width: 48px;
  height: 48px;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 1;
}

.dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #5D4037;
  z-index: 0;
}

.intersection.selected {
  background: rgba(255, 193, 7, 0.35);
  border-radius: 50%;
}

.intersection.valid {
  background: rgba(76, 175, 80, 0.35);
  border-radius: 50%;
}

.intersection.last-move-red {
  background: rgba(211, 47, 47, 0.5);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(211, 47, 47, 0.6);
}

.intersection.last-move-black {
  background: rgba(55, 71, 79, 0.5);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(55, 71, 79, 0.6);
}

.star-mark {
  position: absolute;
  width: 0;
  height: 0;
  z-index: 0;
}

.star-tl, .star-tr, .star-bl, .star-br {
  position: absolute;
  width: 8px;
  height: 8px;
}

.star-tl {
  top: -10px;
  left: -10px;
  border-bottom: 1px solid #5D4037;
  border-right: 1px solid #5D4037;
}

.star-tr {
  top: -10px;
  right: -10px;
  border-bottom: 1px solid #5D4037;
  border-left: 1px solid #5D4037;
}

.star-bl {
  bottom: -10px;
  left: -10px;
  border-top: 1px solid #5D4037;
  border-right: 1px solid #5D4037;
}

.star-br {
  bottom: -10px;
  right: -10px;
  border-top: 1px solid #5D4037;
  border-left: 1px solid #5D4037;
}
</style>
