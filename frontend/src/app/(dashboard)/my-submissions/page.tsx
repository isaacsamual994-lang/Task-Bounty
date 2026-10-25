"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Clock, FileText, Inbox, Link2, MessageSquare } from "lucide-react";
import { getPublicKey } from "@/hooks/stellar-wallets-kit";
import { withRequestTimeout } from "@/lib/request-timeout";
import type { SubmissionStatus, TaskStatus } from "@/types/task-workflow";

interface SubmissionHistoryRow {
  id: string;
  taskId: string;
  contributor: string;
  workUrl: string;
  description: string;
  submittedAt: string;
  status: SubmissionStatus;
  files: Array<{
    name: string;
    size: number;
    extension: string;
    kind: string;
    detectedMimeType: string;
  }>;
  taskTitle: string;
  taskStatus: TaskStatus;
}

type StatusTab = "all" | SubmissionStatus;

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  approved: "bg-green-500/15 text-green-300 border-green-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
};

const STATUS_TABS: StatusTab[] = ["all", "pending", "approved", "rejected"];

const TAB_LABELS: Record<StatusTab, string> = {
  all: "All",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <Badge className={`self-start border ${STATUS_STYLES[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function SubmissionCard({
  submission,
  isExpanded,
  onToggle,
}: {
  submission: SubmissionHistoryRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={`bg-[#0A0B0F]/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all ${
        isExpanded ? "ring-1 ring-[#5B63D6]/40" : "hover:shadow-3xl"
      }`}
    >
      <CardHeader>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#92F2FF] rounded-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-bold text-white">
                  {submission.taskTitle || `Task #${submission.taskId}`}
                </CardTitle>
                <ChevronDown
                  className={`w-4 h-4 text-[#8B92E8] transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
              <CardDescription className="flex items-center gap-1.5 mt-1">
                <Clock className="w-3.5 h-3.5" />
                Submitted {formatDate(submission.submittedAt)} at{" "}
                {formatTime(submission.submittedAt)}
              </CardDescription>
            </div>
            <StatusBadge status={submission.status} />
          </div>
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{submission.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Task #{submission.taskId}</Badge>
          {submission.workUrl && (
            <a
              href={submission.workUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-[#8B92E8] hover:underline"
            >
              <FileText className="w-3 h-3" />
              View work
            </a>
          )}
          {submission.files.length > 0 && (
            <Badge variant="secondary">
              {submission.files.length} file{submission.files.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {isExpanded && (
          <div className="pt-3 border-t border-white/10 space-y-4">
            {/* Full description */}
            <div>
              <p className="text-xs font-semibold text-[#8B92E8] uppercase tracking-wide mb-1">
                Description
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {submission.description}
              </p>
            </div>

            {/* Work URL */}
            {submission.workUrl && (
              <div>
                <p className="text-xs font-semibold text-[#8B92E8] uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Work URL
                </p>
                <a
                  href={submission.workUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#8B92E8] hover:underline break-all"
                >
                  {submission.workUrl}
                </a>
              </div>
            )}

            {/* Attached files */}
            {submission.files.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#8B92E8] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Attached files
                </p>
                <ul className="space-y-1.5">
                  {submission.files.map((file) => (
                    <li
                      key={file.name}
                      className="flex items-center justify-between gap-3 text-sm bg-white/5 rounded-lg px-3 py-2"
                    >
                      <span className="text-white truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatFileSize(file.size)} • {file.detectedMimeType || file.kind}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata */}
            <div>
              <p className="text-xs font-semibold text-[#8B92E8] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Submission ID</span>
                  <span className="text-white">#{submission.id}</span>
                </div>
                <div className="flex justify-between gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Task status</span>
                  <span className="text-white capitalize">{submission.taskStatus}</span>
                </div>
                <div className="flex justify-between gap-2 bg-white/5 rounded-lg px-3 py-2 sm:col-span-2">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="text-white">
                    {formatDate(submission.submittedAt)} at {formatTime(submission.submittedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Track the connected wallet so the history follows the active account.
  useEffect(() => {
    let cancelled = false;

    async function syncWallet() {
      const key = await getPublicKey();
      if (!cancelled) {
        setWalletAddress(key ?? null);
      }
    }

    syncWallet();
    const interval = setInterval(syncWallet, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setSubmissions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    async function run() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ contributor: walletAddress! });
        const body = await withRequestTimeout(async (signal) => {
          const response = await fetch(`/api/my-submissions?${params.toString()}`, { signal });
          const result = await response.json();
          if (!response.ok || !result.ok) {
            throw new Error(result.error ?? "Failed to load submission history.");
          }
          return result;
        }, { signal: controller.signal });

        if (controller.signal.aborted) return;
        setSubmissions(body.submissions);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load submission history.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    run();

    return () => controller.abort();
  }, [walletAddress, retryToken]);

  const counts = useMemo(() => {
    const byStatus: Record<StatusTab, number> = {
      all: submissions.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const submission of submissions) {
      byStatus[submission.status] += 1;
    }
    return byStatus;
  }, [submissions]);

  const filteredSubmissions = useMemo(
    () =>
      statusTab === "all"
        ? submissions
        : submissions.filter((submission) => submission.status === statusTab),
    [submissions, statusTab],
  );

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 w-full max-w-full">
      <h1 className="text-3xl font-bold text-white">My Submissions</h1>

      {!walletAddress && (
        <Card className="bg-[#0A0B0F]/40 backdrop-blur-xl border border-white/10 shadow-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Inbox className="w-10 h-10 text-[#8B92E8]" />
            <p className="text-white font-semibold">Connect your wallet</p>
            <p className="text-sm text-muted-foreground">
              Your submission history appears here once a Stellar wallet is connected.
            </p>
          </CardContent>
        </Card>
      )}

      {walletAddress && isLoading && (
        <Card className="bg-[#0A0B0F]/40 backdrop-blur-xl border border-white/10 shadow-2xl">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading submission history…
          </CardContent>
        </Card>
      )}

      {walletAddress && !isLoading && error && (
        <Card className="bg-[#0A0B0F]/40 backdrop-blur-xl border border-white/10 shadow-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-red-300">
            <p role="alert">{error}</p>
            <button
              type="button"
              onClick={() => setRetryToken((current) => current + 1)}
              className="rounded-lg border border-white/20 px-4 py-2 text-white hover:bg-white/10"
            >
              Retry loading history
            </button>
          </CardContent>
        </Card>
      )}

      {walletAddress && !isLoading && !error && submissions.length === 0 && (
        <Card className="bg-[#0A0B0F]/40 backdrop-blur-xl border border-white/10 shadow-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Inbox className="w-10 h-10 text-[#8B92E8]" />
            <p className="text-white font-semibold">No submissions yet</p>
            <p className="text-sm text-muted-foreground">
              Submit work on a bounty and it will show up in this history.
            </p>
          </CardContent>
        </Card>
      )}

      {walletAddress && !isLoading && !error && submissions.length > 0 && (
        <>
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  statusTab === tab
                    ? "bg-[#5B63D6] text-white"
                    : "bg-white/5 text-[#dddddd] hover:bg-[#5B63D6]/20"
                }`}
              >
                {TAB_LABELS[tab]}
                <span className="ml-1.5 opacity-70">{counts[tab]}</span>
              </button>
            ))}
          </div>

          {filteredSubmissions.length === 0 ? (
            <Card className="bg-[#0A0B0F]/40 backdrop-blur-xl border border-white/10 shadow-2xl">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <Inbox className="w-10 h-10 text-[#8B92E8]" />
                <p className="text-white font-semibold">No {TAB_LABELS[statusTab].toLowerCase()} submissions</p>
                <p className="text-sm text-muted-foreground">
                  Try a different status filter to see more of your history.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
              {filteredSubmissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  isExpanded={expandedId === submission.id}
                  onToggle={() => toggleExpanded(submission.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
