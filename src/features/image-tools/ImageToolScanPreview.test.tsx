import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { ImageToolScanPreview } from "./ImageToolScanPreview";

it("renders accepted and rejected scan entries in the current locale", () => {
  render(
    <ImageToolScanPreview
      locale="zh-CN"
      scan={{
        accepted: [{ relativePath: "catalog/hero.png" }],
        rejected: [{
          path: "catalog/notes.txt",
          code: "UNSUPPORTED_FORMAT",
          detail: "不支持的格式",
        }],
      }}
    />,
  );

  expect(screen.getByText("1 个文件可处理")).toBeInTheDocument();
  expect(screen.getByText("catalog/notes.txt: 不支持的格式")).toBeInTheDocument();
  expect(document.querySelector(".image-tools-scan")).toHaveClass("has-rejections");
});

it("does not render a scan region before scanning", () => {
  const { container } = render(<ImageToolScanPreview locale="en" scan={null} />);

  expect(container.querySelector(".image-tools-scan")).toBeNull();
});
