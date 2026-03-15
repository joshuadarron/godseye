import { memo } from 'react'
import { useHudStore } from '../../stores/hudStore'

export default memo(function SearchInput() {
  const searchQuery = useHudStore((s) => s.searchQuery)
  const setSearchQuery = useHudStore((s) => s.setSearchQuery)

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search..."
        className="w-80 pl-9 pr-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.08] text-sm text-white placeholder-white/30 outline-none focus:border-white/20 transition-colors"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 cursor-pointer transition-colors text-sm leading-none"
        >
          &times;
        </button>
      )}
    </div>
  )
})
