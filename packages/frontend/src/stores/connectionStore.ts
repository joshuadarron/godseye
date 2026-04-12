import { create } from 'zustand'
import type { ConnectionStatus } from '../hooks/useWebSocket'

interface ConnectionStoreState {
  status: ConnectionStatus
  setStatus: (status: ConnectionStatus) => void
}

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}))
