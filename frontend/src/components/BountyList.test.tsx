import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BountyList } from "./BountyList";

const defaults = {
  tasks: [],
  pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
  onPageChange: vi.fn(),
  onRetry: vi.fn(),
};

describe("BountyList timeout and retry feedback", () => {
  it("exposes a visible, accessible retry action after a request error", () => {
    const html = renderToStaticMarkup(
      <BountyList {...defaults} isLoading={false} error="Request timed out. Please try again." />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Request timed out");
    expect(html).toContain("Retry loading bounties");
    expect(html).toContain("<button");
  });

  it("shows a named loading status instead of a blank empty grid", () => {
    const html = renderToStaticMarkup(
      <BountyList {...defaults} isLoading={true} error={null} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading bounties");
  });

  it("does not offer retry for a legitimate empty search result", () => {
    const html = renderToStaticMarkup(
      <BountyList {...defaults} isLoading={false} error={null} />,
    );
    expect(html).toContain("No bounties found");
    expect(html).not.toContain("Retry loading bounties");
  });
});
