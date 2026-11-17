import { ref } from 'vue'
export const voiceBusy = ref(false)
const owners = new Set()
export function voiceFocus() {
  const owner = Symbol('voice')
  return busy => { if (busy) owners.add(owner); else owners.delete(owner); voiceBusy.value = owners.size > 0 }
}
