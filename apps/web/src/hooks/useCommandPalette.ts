import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { allItems, type CommandPaletteItem } from '../lib/commandPaletteItems';

const RECENT_KEY = 'command-palette-recent';
const MAX_RECENT = 5;

export interface FuzzyMatch {
  item: CommandPaletteItem;
  matchedIndices: number[];
  score: number;
}

function fuzzyMatch(query: string, label: string): { matched: boolean; indices: number[]; score: number } {
  const lowerQuery = query.toLowerCase();
  const lowerLabel = label.toLowerCase();

  // Check if all query chars appear in order
  const indices: number[] = [];
  let qi = 0;
  for (let li = 0; li < lowerLabel.length && qi < lowerQuery.length; li++) {
    if (lowerLabel[li] === lowerQuery[qi]) {
      indices.push(li);
      qi++;
    }
  }

  if (qi !== lowerQuery.length) {
    return { matched: false, indices: [], score: 0 };
  }

  // Scoring: exact prefix > word start > fuzzy
  let score = 0;
  if (lowerLabel.startsWith(lowerQuery)) {
    score = 3;
  } else {
    // Check word-start match
    const words = lowerLabel.split(/\s+/);
    const isWordStart = words.some((w) => w.startsWith(lowerQuery));
    if (isWordStart) {
      score = 2;
    } else {
      score = 1;
    }
  }

  return { matched: true, indices, score };
}

function getRecentIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

function saveRecentId(id: string): void {
  try {
    const current = getRecentIds();
    const updated = [id, ...current.filter((i) => i !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function getRecentItems(): CommandPaletteItem[] {
  const ids = getRecentIds();
  return ids
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is CommandPaletteItem => item !== undefined)
    .map((item) => ({ ...item, category: 'Recent' as const }));
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const results: FuzzyMatch[] = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    const matches: FuzzyMatch[] = [];
    for (const item of allItems) {
      const result = fuzzyMatch(query, item.label);
      if (result.matched) {
        matches.push({ item, matchedIndices: result.indices, score: result.score });
      }
    }
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }, [query]);

  const recentItems = useMemo(() => {
    if (query.trim()) return [];
    return getRecentItems();
  }, [query, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayItems = useMemo(() => {
    if (query.trim()) {
      return results;
    }
    return recentItems.map((item) => ({ item, matchedIndices: [], score: 0 }));
  }, [query, results, recentItems]);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, close, open]);

  const executeItem = useCallback(
    (item: CommandPaletteItem) => {
      saveRecentId(item.id);
      close();
      if (item.action.type === 'navigate') {
        navigate(item.action.path);
      } else {
        item.action.fn();
      }
    },
    [close, navigate],
  );

  const executeSelected = useCallback(() => {
    if (displayItems.length > 0 && selectedIndex < displayItems.length) {
      executeItem(displayItems[selectedIndex].item);
    }
  }, [displayItems, selectedIndex, executeItem]);

  // Store latest values in refs so the keyboard handler stays stable
  const displayItemsRef = useRef(displayItems);
  displayItemsRef.current = displayItems;

  const executeSelectedRef = useRef(executeSelected);
  executeSelectedRef.current = executeSelected;

  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;

  const closeRef = useRef(close);
  closeRef.current = close;

  // Global keyboard handler - only re-registers when isOpen changes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleRef.current();
        return;
      }

      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < displayItemsRef.current.length - 1 ? prev + 1 : 0,
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : displayItemsRef.current.length - 1,
        );
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        executeSelectedRef.current();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return {
    isOpen,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    displayItems,
    open,
    close,
    toggle,
    executeItem,
    executeSelected,
  };
}
