import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { MSG, TABLE_COUNT } from './protocol.js'
import { getTables, getTableById, sitDown, leaveSeat, removeUser, addSpectator, removeSpectator } from './rooms.js'
import { GameState } from './gameState.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({
  server,
  verifyClient: (info, callback) => {
    callback(true)
  }
})

app.use(express.static(join(__dirname, '..', 'dist')))

const clients = new Map()
const games = new Map()

function broadcast(type, payload, exclude = null) {
  const msg = JSON.stringify({ type, payload })
  for (const [ws] of clients) {
    if (ws !== exclude && ws.readyState === 1) {
      ws.send(msg)
    }
  }
}

function send(ws, type, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }))
  }
}

function startGameForTable(tableId, gameMode, aiDepth) {
  const table = getTableById(tableId)
  if (!table || !table.seats[0] || !table.seats[1]) return

  const mode = gameMode || table.gameMode || (table.seats[0].userId === table.seats[1].userId ? 'single' : 'multiplayer')
  table.gameMode = mode
  table.aiDepth = aiDepth || 2
  table.isPlaying = true
  const seat0 = table.seats[0]
  const seat1 = table.seats[1]

  const gameState = new GameState(
    { userId: seat0.userId, playerName: seat0.playerName },
    { userId: seat1.userId, playerName: seat1.playerName }
  )
  games.set(tableId, gameState)

  for (const [clientWs, clientInfo] of clients) {
    if (clientInfo.tableId === tableId) {
      if (clientInfo.isSpectator) {
        send(clientWs, MSG.GAME_START, {
          tableId,
          board: gameState.board,
          yourColor: null,
          opponentName: seat0.playerName + ' vs ' + seat1.playerName,
          gameMode: mode,
          isSpectator: true
        })
      } else {
        const myColor = clientInfo.userId === seat0.userId ? 'red' : 'black'
        const opponentName = myColor === 'red' ? seat1.playerName : seat0.playerName
        send(clientWs, MSG.GAME_START, {
          tableId,
          board: gameState.board,
          yourColor: myColor,
          opponentName,
          gameMode: mode,
          aiDepth: aiDepth || 2
        })
      }
    }
  }

  broadcast(MSG.LOBBY_UPDATE, {
    tableId, seatIndex: 0,
    player: { id: seat0.userId, name: seat0.playerName },
    action: 'sit', isPlaying: true
  })
  broadcast(MSG.LOBBY_UPDATE, {
    tableId, seatIndex: 1,
    player: { id: seat1.userId, name: seat1.playerName },
    action: 'sit', isPlaying: true
  })
}

wss.on('connection', (ws) => {
  console.log('Client connected')

  clients.set(ws, { userId: null, playerName: null, tableId: null })

  send(ws, MSG.LOBBY_STATE, { tables: getTables() })

  ws.on('message', (data) => {
    try {
      const { type, payload } = JSON.parse(data.toString())
      const client = clients.get(ws)

      switch (type) {
        case MSG.LOBBY_JOIN: {
          client.userId = payload.userId
          client.playerName = payload.playerName
          send(ws, MSG.LOBBY_STATE, { tables: getTables() })
          break
        }

        case MSG.TABLE_SIT: {
          const result = sitDown(payload.tableId, client.userId, client.playerName, payload.seatIndex)
          if (result.error) {
            send(ws, MSG.ERROR, { message: result.error })
            break
          }

          client.tableId = result.tableId

          broadcast(MSG.LOBBY_UPDATE, {
            tableId: result.tableId,
            seatIndex: result.seatIndex,
            player: { id: client.userId, name: client.playerName },
            action: 'sit',
            isPlaying: false
          })

          if (result.startGame) {
            startGameForTable(result.tableId)
          }
          break
        }

        case MSG.TABLE_LEAVE: {
          if (client.isSpectator) {
            removeSpectator(client.tableId, client.userId)
            const table = getTableById(client.tableId)
            if (table) {
              broadcast(MSG.LOBBY_UPDATE, {
                tableId: client.tableId,
                spectatorCount: table.spectators.length
              })
            }
            client.tableId = null
            client.isSpectator = false
            break
          }

          const game = games.get(client.tableId)
          if (game) {
            for (const [clientWs, clientInfo] of clients) {
              if (clientInfo.tableId === client.tableId && clientInfo.userId !== client.userId) {
                send(clientWs, MSG.OPPONENT_LEFT, { reason: 'opponent_left' })
              }
            }
            games.delete(client.tableId)
            const table = getTableById(client.tableId)
            if (table) {
              table.isPlaying = false
              table.gameMode = null
            }
          }

          const table = getTableById(payload.tableId)
          if (table) {
            for (let i = 0; i < 2; i++) {
              if (table.seats[i] && table.seats[i].userId === client.userId) {
                leaveSeat(payload.tableId, client.userId)
                broadcast(MSG.LOBBY_UPDATE, {
                  tableId: payload.tableId,
                  seatIndex: i,
                  player: null,
                  action: 'leave',
                  isPlaying: false
                })
              }
            }
          }

          client.tableId = null
          break
        }

        case MSG.TABLE_WATCH: {
          const table = getTableById(payload.tableId)
          if (!table) {
            send(ws, MSG.ERROR, { message: '桌子不存在' })
            break
          }
          if (!table.isPlaying) {
            send(ws, MSG.ERROR, { message: '该桌没有进行中的对局' })
            break
          }

          const result = addSpectator(payload.tableId, client.userId, client.playerName)
          if (result.error) {
            send(ws, MSG.ERROR, { message: result.error })
            break
          }

          client.tableId = payload.tableId
          client.isSpectator = true

          const game = games.get(payload.tableId)
          if (game) {
            const seat0 = table.seats[0]
            const seat1 = table.seats[1]
            const lastMove = game.moveHistory.length > 0 ? game.moveHistory[game.moveHistory.length - 1] : null
            const lastMoveRed = lastMove && lastMove.fromPlayer === seat0.userId ? { from: lastMove.from, to: lastMove.to } : null
            const lastMoveBlack = lastMove && lastMove.fromPlayer === seat1.userId ? { from: lastMove.from, to: lastMove.to } : null
            send(ws, MSG.GAME_START, {
              tableId: payload.tableId,
              board: game.board,
              yourColor: null,
              opponentName: seat0.playerName + ' vs ' + seat1.playerName,
              gameMode: table.gameMode,
              aiDepth: table.aiDepth || 2,
              isSpectator: true,
              lastMoveRed,
              lastMoveBlack
            })
          }

          broadcast(MSG.LOBBY_UPDATE, {
            tableId: payload.tableId,
            spectatorCount: table.spectators.length
          })
          break
        }

        case MSG.GAME_SELECT_MODE: {
          const table = getTableById(payload.tableId)
          if (!table || table.isPlaying) {
            send(ws, MSG.ERROR, { message: '该桌正在进行对局' })
            break
          }

          const seatIndex = payload.seatIndex
          if (seatIndex < 0 || seatIndex > 1) {
            send(ws, MSG.ERROR, { message: '无效的位置' })
            break
          }

          if (table.seats[seatIndex] !== null) {
            send(ws, MSG.ERROR, { message: '该位置已有人' })
            break
          }

          table.seats[seatIndex] = { userId: client.userId, playerName: client.playerName }

          broadcast(MSG.LOBBY_UPDATE, {
            tableId: payload.tableId,
            seatIndex: seatIndex,
            player: { id: client.userId, name: client.playerName },
            action: 'sit',
            isPlaying: false
          })

          if (table.seats[0] && table.seats[1]) {
            startGameForTable(payload.tableId, payload.mode, payload.depth)
          }
          break
        }

        case MSG.GAME_MOVE: {
          const game = games.get(client.tableId)
          if (!game) break

          const [fromR, fromC] = payload.from
          const [toR, toC] = payload.to
          const result = game.makeMove(client.userId, fromR, fromC, toR, toC)

          if (result.error) {
            send(ws, MSG.ERROR, { message: result.error })
            break
          }

          for (const [clientWs, clientInfo] of clients) {
            if (clientInfo.tableId === client.tableId) {
              send(clientWs, MSG.GAME_MOVED, {
                from: payload.from,
                to: payload.to,
                board: game.board,
                turn: game.currentTurn,
                captured: result.captured
              })
            }
          }

          if (result.gameOver) {
            broadcast(MSG.GAME_OVER, {
              winner: result.winner,
              reason: result.reason || 'captured_king'
            }, null)
            games.delete(client.tableId)
            const table = getTableById(client.tableId)
            if (table) {
              table.isPlaying = false
              table.gameMode = null
            }
          }
          break
        }

        case MSG.GAME_UNDO: {
          const game = games.get(client.tableId)
          if (!game) break

          const result = game.requestUndo(client.userId)
          if (result.error) {
            send(ws, MSG.ERROR, { message: result.error })
            break
          }

          if (game.isSinglePlayer) {
            const newBoard = game.applySinglePlayerUndo()
            if (newBoard) {
              for (const [clientWs, clientInfo] of clients) {
                if (clientInfo.tableId === client.tableId) {
                  send(clientWs, MSG.GAME_UNDO_RESULT, {
                    board: newBoard,
                    turn: game.currentTurn
                  })
                }
              }
            }
          } else {
            for (const [clientWs, clientInfo] of clients) {
              if (clientInfo.tableId === client.tableId && clientInfo.userId !== client.userId) {
                send(clientWs, MSG.GAME_UNDO_REQUEST, {
                  fromPlayer: client.playerName
                })
              }
            }
          }
          break
        }

        case MSG.GAME_UNDO_RESPOND: {
          const game = games.get(client.tableId)
          if (!game) break

          if (payload.accept) {
            const newBoard = game.applyUndo()
            if (newBoard) {
              broadcast(MSG.GAME_UNDO_RESULT, {
                board: newBoard,
                turn: game.currentTurn
              })
            }
          } else {
            for (const [clientWs, clientInfo] of clients) {
              if (clientInfo.tableId === client.tableId && clientInfo.userId !== client.userId) {
                send(clientWs, MSG.ERROR, { message: '对方拒绝了你的悔棋请求' })
              }
            }
          }
          break
        }

        case MSG.GAME_RESTART: {
          const table = getTableById(client.tableId)
          if (!table || !table.seats[0] || !table.seats[1]) break

          if (table.seats[0].userId === table.seats[1].userId) {
            startGameForTable(client.tableId)
          } else {
            for (const [clientWs, clientInfo] of clients) {
              if (clientInfo.tableId === client.tableId && clientInfo.userId !== client.userId) {
                send(clientWs, MSG.GAME_RESTART_REQUEST, {
                  fromPlayer: client.playerName
                })
              }
            }
          }
          break
        }

        case MSG.GAME_RESTART_RESPOND: {
          const table = getTableById(client.tableId)
          if (!table || !table.seats[0] || !table.seats[1]) break

          if (payload.accept) {
            startGameForTable(client.tableId)
          } else {
            for (const [clientWs, clientInfo] of clients) {
              if (clientInfo.tableId === client.tableId && clientInfo.userId !== client.userId) {
                send(clientWs, MSG.ERROR, { message: '对方拒绝了重新开局' })
              }
            }
          }
          break
        }
      }
    } catch (e) {
      console.error('Message handling error:', e)
    }
  })

  ws.on('close', () => {
    const client = clients.get(ws)
    if (client && client.userId) {
      if (client.isSpectator && client.tableId) {
        removeSpectator(client.tableId, client.userId)
        const table = getTableById(client.tableId)
        if (table) {
          broadcast(MSG.LOBBY_UPDATE, {
            tableId: client.tableId,
            spectatorCount: table.spectators.length
          })
        }
      } else if (client.tableId) {
        const game = games.get(client.tableId)
        if (game) {
          for (const [clientWs, clientInfo] of clients) {
            if (clientInfo.tableId === client.tableId && clientInfo.userId !== client.userId) {
              send(clientWs, MSG.OPPONENT_LEFT, { reason: 'opponent_disconnected' })
            }
          }
          games.delete(client.tableId)
          const table = getTableById(client.tableId)
          if (table) {
            table.isPlaying = false
            table.gameMode = null
          }
        }

        const table = getTableById(client.tableId)
        if (table) {
          for (let i = 0; i < 2; i++) {
            if (table.seats[i] && table.seats[i].userId === client.userId) {
              leaveSeat(client.tableId, client.userId)
              broadcast(MSG.LOBBY_UPDATE, {
                tableId: client.tableId,
                seatIndex: i,
                player: null,
                action: 'leave',
                isPlaying: false
              })
            }
          }
        } else {
          removeUser(client.userId)
        }
      }

      client.tableId = null
      client.isSpectator = false
    }
    clients.delete(ws)
    console.log('Client disconnected')
  })
})

const PORT = 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
})
