import { memo } from 'react'
import { useHudStore } from '../../stores/hudStore'

export default memo(function SearchInput() {
  const searchQuery = useHudStore((s) => s.searchQuery)
  const setSearchQuery = useHudStore((s) => s.setSearchQuery)

  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-white/30"
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
        className="w-80 rounded-full border border-white/[0.08] bg-black/40 py-3 pr-4 pl-9 text-sm text-white placeholder-white/30 backdrop-blur-md transition-colors outline-none focus:border-white/20"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute top-1/2 right-4 flex h-6 w-6 -translate-y-[55%] cursor-pointer items-center justify-center text-2xl leading-none text-white/30 transition-colors hover:text-white/60"
        >
          &times;
        </button>
      )}
    </div>
  )
})
