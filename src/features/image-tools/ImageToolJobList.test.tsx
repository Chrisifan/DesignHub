import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ImageToolJobList } from "./ImageToolJobList";

const jobs = [
  {
    job: {
      id: "job-1",
      tool: "upscale" as const,
      params: { scale: 2, preserveDetails: "balanced" as const },
      sourceRoot: "/images/source",
      outputRoot: "/images/output/job-1",
      state: "running" as const,
      itemIds: ["item-1"],
      createdAt: "2026-09-28T10:00:00.000Z",
      updatedAt: "2026-09-28T10:10:00.000Z",
    },
    items: [{
      id: "item-1",
      jobId: "job-1",
      relativePath: "catalog/hero.png",
      state: "running" as const,
      attempt: 1,
      updatedAt: "2026-09-28T10:10:00.000Z",
    }],
  },
];

it("filters jobs and reports the selected job through the extracted list", () => {
  const onFilterChange = vi.fn();
  const onSelect = vi.fn();
  render(
    <ImageToolJobList
      locale="zh-CN"
      jobs={jobs}
      selectedJobId={null}
      filter="all"
      query=""
      onFilterChange={onFilterChange}
      onQueryChange={vi.fn()}
      onSelect={onSelect}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /hero\.png/ }));
  fireEvent.click(screen.getByRole("tab", { name: "活跃" }));

  expect(onSelect).toHaveBeenCalledWith("job-1");
  expect(onFilterChange).toHaveBeenCalledWith("active");
});
