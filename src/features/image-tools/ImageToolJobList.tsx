import type { Locale } from "../../app/i18n";
import { Icon, t } from "../../app/studio/ui";
import type { BatchImageTool, ImageToolJob, ImageToolItem } from "./jobs";
import {
  filterImageToolJobs,
  getImageToolJobContentName,
  getImageToolJobProgress,
  type ImageToolJobFilter,
} from "./view-model";
import { icons, stateLabel } from "./image-tools-copy";

type JobFilter = ImageToolJobFilter;

export const ImageToolJobList = ({
  locale,
  jobs,
  selectedJobId,
  filter,
  query,
  onFilterChange,
  onQueryChange,
  onSelect,
}: {
  locale: Locale;
  jobs: ReadonlyArray<{ job: ImageToolJob; items: ImageToolItem[] }>;
  selectedJobId: string | null;
  filter: JobFilter;
  query: string;
  onFilterChange: (filter: JobFilter) => void;
  onQueryChange: (query: string) => void;
  onSelect: (jobId: string) => void;
}) => {
  const queryValue = query.trim().toLowerCase();
  const queriedJobs = queryValue
    ? jobs.filter(({ job }) =>
        `${job.id} ${job.sourceRoot} ${job.outputRoot}`
          .toLowerCase()
          .includes(queryValue),
      )
    : jobs;
  const visibleJobs = filterImageToolJobs(queriedJobs, filter);
  const counts = {
    active: filterImageToolJobs(jobs, "active").length,
    recent: filterImageToolJobs(jobs, "recent").length,
    archived: filterImageToolJobs(jobs, "archived").length,
  };
  const filters: Array<[JobFilter, string, string]> = [
    ["all", "全部", "All"],
    ["active", "活跃", "Active"],
    ["recent", "最近", "Recent"],
    ["archived", "已归档", "Archived"],
  ];
  return (
    <aside
      className="image-tools-job-sidebar"
      aria-label={t(locale, "图像作业", "Image jobs")}
    >
      <div className="image-tools-job-sidebar__heading">
        <div>
          <p className="panel-label">{t(locale, "作业中心", "Job center")}</p>
          <h2>{t(locale, "作业", "Jobs")}</h2>
        </div>
        <span className="image-tools-job-sidebar__count">
          {visibleJobs.length}
        </span>
      </div>
      <label className="image-tools-job-sidebar__search">
        <Icon name="search" size={15} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t(locale, "按批次 ID / 目录搜索…", "Search batch ID / folder…")}
          aria-label={t(locale, "搜索作业", "Search jobs")}
        />
        <kbd>⌘K</kbd>
      </label>
      <div
        className="image-tools-job-sidebar__filters"
        role="tablist"
        aria-label={t(locale, "作业筛选", "Job filters")}
      >
        {filters.map(([value, zh, en]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-label={t(locale, zh, en)}
            aria-selected={filter === value}
            className={filter === value ? "is-active" : ""}
            onClick={() => onFilterChange(value)}
          >
            <span>{t(locale, zh, en)}</span>
            {value !== "all" && <small>{counts[value]}</small>}
          </button>
        ))}
      </div>
      <div className="image-tools-job-list">
        {visibleJobs.length === 0 ? (
          <p className="image-tools-job-list__empty">
            {t(locale, "没有符合条件的作业", "No jobs match this filter")}
          </p>
        ) : (
          visibleJobs.map(({ job, items }) => {
            const progress = getImageToolJobProgress(items);
            const contentName = getImageToolJobContentName(items, job.id);
            const hasAttention = items.some(
              (item) => item.state === "failed" || item.state === "unknown",
            );
            return (
              <button
                key={job.id}
                type="button"
                className={`image-tools-job-row studio-home-project-row ${selectedJobId === job.id ? "is-selected" : ""}`}
                aria-pressed={selectedJobId === job.id}
                onClick={() => onSelect(job.id)}
              >
                <span className="image-tools-job-row__icon studio-home-project-row__cover">
                  <Icon
                    name={icons[job.tool as BatchImageTool] ?? "file-image"}
                    size={16}
                  />
                </span>
                <span className="image-tools-job-row__body studio-home-project-row__copy">
                  <strong title={contentName.full}>{contentName.display}</strong>
                  <span className="image-tools-job-row__output" title={job.outputRoot}>{job.outputRoot}</span>
                  <small>
                    {progress.completed} / {progress.total} ·{" "}
                    {stateLabel(locale, job.state)}
                  </small>
                </span>
                <span className="image-tools-job-row__meta">
                  {hasAttention && (
                    <i aria-label={t(locale, "需要关注", "Needs attention")} />
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
