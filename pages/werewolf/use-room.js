import { useGameRoom } from '@/common/use-game-room.js'
import * as api from './api.js'

export const useRoom = (code, onUpdate) => useGameRoom(code, api, onUpdate, { pollMs: 1000 })
