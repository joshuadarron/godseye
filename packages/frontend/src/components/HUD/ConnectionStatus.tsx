import { useConnectionStore } from '../../stores/connectionStore'

const STATUS_CONFIG = {
  connected: { color: 'bg-green-500', label: 'Connected' },
  connecting: { color: 'bg-yellow-500', label: 'Connecting...' },
  disconnected: { color: 'bg-red-500', label: 'Disconnected' },
} as const

export default function ConnectionStatus() {
  const status = useConnectionStore((s) => s.status)
  const config = STATUS_CONFIG[status]

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40">
      <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/40 px-3 py-1.5 backdrop-blur-md">
        <span className={`h-2 w-2 rounded-full ${config.color}`} />
        <span className="text-xs text-white/50">{config.label}</span>
      </div>
    </div>
  )
}
