import { memo } from 'react'
import { useHudStore } from '../../stores/hudStore'

export default memo(function SearchInput() {
  const searchQuery = useHudStore((s) => s.searchQuery)
  const setSearchQuery = useHudStore((s) => s.setSearchQuery)

  return (
    <div className="relative">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search..."
        className="w-56 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/[0.08] text-sm text-white placeholder-white/30 outline-none focus:border-white/20 transition-colors"
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
