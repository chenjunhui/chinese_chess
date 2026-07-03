import { createRouter, createWebHistory } from 'vue-router'
import LobbyView from '../views/LobbyView.vue'
import GameView from '../views/GameView.vue'
import { useGameStore } from '../stores/game.js'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'lobby', component: LobbyView },
    { path: '/game', name: 'game', component: GameView }
  ]
})

router.beforeEach((to) => {
  if (to.name === 'game') {
    const game = useGameStore()
    if (!game.board) {
      return { name: 'lobby' }
    }
  }
})

export default router
