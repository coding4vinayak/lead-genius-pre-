import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { useCommandPalette } from '../hooks/useCommandPalette';
import CommandPaletteResult from './CommandPaletteResult';

export default function CommandPalette() {
  const {
    isOpen,
    query,
    setQuery,
    selectedIndex,
    displayItems,
    close,
    executeItem,
  } = useCommandPalette();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered before focusing
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Group items by category
  const grouped = displayItems.reduce<Record<string, typeof displayItems>>((acc, match) => {
    const cat = match.item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(match);
    return acc;
  }, {});

  let globalIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50" data-testid="command-palette">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50"
            onClick={close}
            data-testid="command-palette-backdrop"
          />

          {/* Panel */}
          <div className="absolute inset-0 flex items-start justify-center pt-[20vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages, actions..."
                  className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                  data-testid="command-palette-input"
                />
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 rounded border border-gray-200">
                  Esc
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {displayItems.length === 0 && query.trim() && (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                )}

                {displayItems.length === 0 && !query.trim() && (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    Start typing to search...
                  </div>
                )}

                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                      {category}
                    </div>
                    {items.map((match) => {
                      globalIndex++;
                      const idx = globalIndex;
                      return (
                        <CommandPaletteResult
                          key={match.item.id}
                          item={match.item}
                          matchedIndices={match.matchedIndices}
                          isSelected={idx === selectedIndex}
                          onClick={() => executeItem(match.item)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-400">
                  <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-500">↑↓</kbd> navigate
                </span>
                <span className="text-xs text-gray-400">
                  <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-500">↵</kbd> select
                </span>
                <span className="text-xs text-gray-400">
                  <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 text-gray-500">esc</kbd> close
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
