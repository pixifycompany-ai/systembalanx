import { useState, useCallback, useMemo } from 'react';

interface UseMultiSelectOptions<T> {
  items: T[];
  getItemId: (item: T) => string;
}

interface UseMultiSelectReturn<T> {
  selectedIds: Set<string>;
  selectedItems: T[];
  isSelected: (id: string) => boolean;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectItems: (ids: string[]) => void;
}

export function useMultiSelect<T>({
  items,
  getItemId,
}: UseMultiSelectOptions<T>): UseMultiSelectReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === items.length) {
        return new Set();
      }
      return new Set(items.map(getItemId));
    });
  }, [items, getItemId]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getItemId)));
  }, [items, getItemId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectItems = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const isAllSelected = useMemo(() => {
    return items.length > 0 && selectedIds.size === items.length;
  }, [items.length, selectedIds.size]);

  const isSomeSelected = useMemo(() => {
    return selectedIds.size > 0 && selectedIds.size < items.length;
  }, [items.length, selectedIds.size]);

  const selectedItems = useMemo(() => {
    return items.filter(item => selectedIds.has(getItemId(item)));
  }, [items, selectedIds, getItemId]);

  return {
    selectedIds,
    selectedItems,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    selectAll,
    clearSelection,
    selectItems,
  };
}
