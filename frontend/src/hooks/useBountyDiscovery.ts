"use client";

import { useEffect, useMemo, useState } from "react";
import { withRequestTimeout } from "@/lib/request-timeout";
import type {
  TaskDifficulty,
  TaskRecord,
  TaskSortOrder,
} from "@/types/task-workflow";

export interface BountyFilters {
  search: string;
  minReward: number | "";
  maxReward: number | "";
  difficulty: TaskDifficulty | "";
  technology: string;
  organization: string;
  sort: TaskSortOrder;
}

export const DEFAULT_BOUNTY_FILTERS: BountyFilters = {
  search: "",
  minReward: "",
  maxReward: "",
  difficulty: "",
  technology: "",
  organization: "",
  sort: "newest",
};

export interface BountyPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGINATION: BountyPagination = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
};

export interface UseBountyDiscoveryReturn {
  tasks: TaskRecord[];
  pagination: BountyPagination;
  isLoading: boolean;
  error: string | null;
  filters: BountyFilters;
  /** Merge a partial filter update; resets pagination back to page 1. */
  setFilters: (partial: Partial<BountyFilters>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  /** Re-run the current filter/page query after an error or timeout. */
  retry: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

function buildQueryString(filters: BountyFilters, page: number): string {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.minReward !== "") params.set("minReward", String(filters.minReward));
  if (filters.maxReward !== "") params.set("maxReward", String(filters.maxReward));
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.technology.trim()) params.set("technology", filters.technology.trim());
  if (filters.organization.trim()) params.set("organization", filters.organization.trim());
  if (filters.sort) params.set("sort", filters.sort);
  params.set("page", String(page));

  return params.toString();
}

/**
 * Drives the bounty discovery page: combinable filters, keyword search
 * (debounced so typing doesn't trigger a request per keystroke), sorting,
 * and pagination — all resolved server-side via GET /api/tasks.
 */
export function useBountyDiscovery(): UseBountyDiscoveryReturn {
  const [filters, setFiltersState] = useState<BountyFilters>(DEFAULT_BOUNTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [page, setPageState] = useState(1);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [pagination, setPagination] = useState<BountyPagination>(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Debounce the free-text search field only; other filters (selects, number
  // inputs) apply immediately since they don't fire on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const effectiveFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const queryString = useMemo(
    () => buildQueryString(effectiveFilters, page),
    [effectiveFilters, page],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setIsLoading(true);
      setError(null);

      try {
        const body = await withRequestTimeout(async (signal) => {
          const response = await fetch(`/api/tasks?${queryString}`, { signal });
          const result = await response.json();
          if (!response.ok || !result.ok) {
            throw new Error(result.error ?? "Failed to load bounties.");
          }
          return result;
        }, { signal: controller.signal });

        if (controller.signal.aborted) return;
        setTasks(body.tasks);
        setPagination(body.pagination);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load bounties.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    run();

    return () => controller.abort();
  }, [queryString, retryToken]);

  const setFilters = (partial: Partial<BountyFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
    setPageState(1);
  };

  const resetFilters = () => {
    setFiltersState(DEFAULT_BOUNTY_FILTERS);
    setDebouncedSearch("");
    setPageState(1);
  };

  const setPage = (nextPage: number) => {
    setPageState(Math.max(1, Math.floor(nextPage)));
  };

  const retry = () => setRetryToken((current) => current + 1);

  return {
    tasks,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    resetFilters,
    setPage,
    retry,
  };
}
