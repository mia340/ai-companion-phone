import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const unlocked = ref(false)
  const currentWorldId = ref('world-default')
  const unlock = () => { unlocked.value = true }
  const lock = () => { unlocked.value = false }
  return { unlocked, currentWorldId, unlock, lock }
})
