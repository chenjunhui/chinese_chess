import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wsClient } from '../ws/client.js'
import { MSG } from '../ws/protocol.js'
import { useGameStore } from './game.js'
import router from '../router'

export const useLobbyStore = defineStore('lobby', () => {
  const userId = ref(null)
  const playerName = ref('')
  const tables = ref([])
  const myTableId = ref(null)
  const mySeat = ref(null)
  const watchTableId = ref(null)

  function connect(name) {
    playerName.value = name
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${location.hostname}:3000`

    wsClient.on(MSG.LOBBY_STATE, (payload) => {
      tables.value = payload.tables
    })

    wsClient.on(MSG.LOBBY_UPDATE, (payload) => {
      const table = tables.value.find(t => t.id === payload.tableId)
      if (table) {
        if (payload.spectatorCount !== undefined) {
          table.spectatorCount = payload.spectatorCount
        }
        if (payload.action === 'leave') {
          if (payload.seatIndex !== null) {
            table.seats[payload.seatIndex] = null
          } else {
            const idx = table.seats.findIndex(s => s && s.id === payload.player?.id)
            if (idx !== -1) table.seats[idx] = null
          }
        } else if (payload.seatIndex !== undefined) {
          table.seats[payload.seatIndex] = payload.player
        }
        if (payload.isPlaying !== undefined) {
          table.isPlaying = payload.isPlaying
        }
      }
    })

    wsClient.on(MSG.GAME_START, (payload) => {
      const gameStore = useGameStore()
      gameStore.startGame(payload)
      router.push('/game')
    })

    wsClient.on(MSG.ERROR, (payload) => {
      const gameStore = useGameStore()
      gameStore.showAlert(payload.message)
    })

    wsClient.connect(wsUrl).then(() => {
      userId.value = 'user_' + Math.random().toString(36).substr(2, 9)
      wsClient.send(MSG.LOBBY_JOIN, { playerName: name, userId: userId.value })
    })
  }

  function sit(tableId, seatIndex) {
    wsClient.send(MSG.TABLE_SIT, { tableId, seatIndex })
    myTableId.value = tableId
    mySeat.value = seatIndex
  }

  function selectMode(tableId, seatIndex, mode, depth) {
    wsClient.send(MSG.GAME_SELECT_MODE, { tableId, seatIndex, mode, depth })
  }

  function watch(tableId) {
    wsClient.send(MSG.TABLE_WATCH, { tableId })
    watchTableId.value = tableId
  }

  function leave() {
    if (watchTableId.value) {
      wsClient.send(MSG.TABLE_LEAVE, { tableId: watchTableId.value })
      watchTableId.value = null
    } else if (myTableId.value) {
      wsClient.send(MSG.TABLE_LEAVE, { tableId: myTableId.value })
      myTableId.value = null
      mySeat.value = null
    }
  }

  function disconnect() {
    localStorage.removeItem('chess_playerName')
    wsClient.close()
    userId.value = null
    playerName.value = ''
    tables.value = []
    myTableId.value = null
    mySeat.value = null
    watchTableId.value = null
  }

  return { userId, playerName, tables, myTableId, mySeat, watchTableId, connect, sit, selectMode, watch, leave, disconnect }
})
