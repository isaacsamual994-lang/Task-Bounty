"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BountyPagination } from "@/hooks/useBountyDiscovery";
import type { TaskRecord } from "@/types/task-workflow";

const DIFFICULTY_LABELS: Record<TaskRecord["difficulty"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function formatReward(stroops: number): string {
  return `${(stroops / 10_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} XLM`;
}

function formatDeadline(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString();
}

interface BountyListProps {
  tasks: TaskRecord[];
  pagination: BountyPagination;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

export function BountyList({ tasks, pagination, isLoading, error, onPageChange, onRetry }: BountyListProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-xl font-semibold text-white mb-2">Couldn&apos;t load bounties</h3>
        <p className="text-muted-foreground" role="alert">{error}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
          Retry loading bounties
        </Button>
      </div>
    );
  }

  if (isLoading && tasks.length === 0) {
    return (
      <div role="status" aria-live="polite" className="py-20 text-center text-muted-foreground">
        Loading bounties…
      </div>
    );
  }

  if (!isLoading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-xl font-semibold text-white mb-2">No bounties found</h3>
        <p className="text-muted-foreground">Try adjusting your filters to see more results</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full" aria-busy={isLoading}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 w-full">
        {tasks.map((task) => (
          <Card
            key={task.id}
            className="bg-[#0A0B0F]/40 backdrop-blur-xl border border-white/10 shadow-2xl hover:shadow-3xl transition-all"
          >
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-bold text-white">{task.title}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {task.organizationId ? `Org ${task.organizationId} • ` : ""}
                    Deadline {formatDeadline(task.deadline)}
                  </CardDescription>
                </div>
                <Badge className="self-start">{formatReward(task.reward)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{task.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{DIFFICULTY_LABELS[task.difficulty]}</Badge>
                {task.technologies.map((tech) => (
                  <Badge key={tech} variant="outline">
                    {tech}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <nav
          aria-label="Bounty results pages"
          className="flex items-center justify-center gap-4"
        >
          <Button
            type="button"
            variant="outline"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
