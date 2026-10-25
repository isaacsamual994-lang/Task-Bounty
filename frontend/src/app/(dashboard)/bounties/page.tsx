"use client";

import React from "react";
import { BountyFilters } from "@/components/BountyFilters";
import { BountyList } from "@/components/BountyList";
import { useBountyDiscovery } from "@/hooks/useBountyDiscovery";

export default function BountiesPage() {
  const { tasks, pagination, isLoading, error, filters, setFilters, resetFilters, setPage, retry } =
    useBountyDiscovery();

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 w-full max-w-full">
      <h1 className="text-3xl font-bold text-white">Discover Bounties</h1>

      <BountyFilters filters={filters} onFilterChange={setFilters} onReset={resetFilters} />

      <BountyList
        tasks={tasks}
        pagination={pagination}
        isLoading={isLoading}
        error={error}
        onPageChange={setPage}
        onRetry={retry}
      />
    </div>
  );
}
