import type { Locale } from "../../app/i18n";
import { t } from "../../app/studio/ui";
import type { ImageToolScanResult } from "./ImageToolConfigurator";

export type ImageToolScanPreviewProps = {
  locale: Locale;
  scan: ImageToolScanResult | null;
};

export const ImageToolScanPreview = ({ locale, scan }: ImageToolScanPreviewProps) =>
  scan ? (
    <div
      className={`image-tools-scan ${scan.rejected.length ? "has-rejections" : ""}`}
    >
      <strong>
        {t(
          locale,
          `${scan.accepted.length} 个文件可处理`,
          `${scan.accepted.length} files accepted`,
        )}
      </strong>
      {scan.rejected.length > 0 && (
        <ul>
          {scan.rejected.map((item) => (
            <li key={`${item.path}-${item.code}`}>
              {item.path}: {item.detail ?? item.code}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

