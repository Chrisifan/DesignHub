import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import type { Locale } from "../i18n";
import { PersonaArtwork } from "./PersonaArtwork";
import { PersonaInspector } from "./PersonaInspector";
import {
  PersonaRepository,
  type PersonaStatusFilter,
} from "./PersonaRepository";
import {
  localize,
  personaProfiles,
  type LocalizedText,
  type PersonaProfile,
} from "./personas";
import { Button, Field, Icon, Modal, PageHeader, t } from "./ui";
import { getDesktopApi } from "../../platform/runtime";
import type { PortfolioInspection, PortfolioInspectionRequest } from "../../platform/contracts";
import type { DesignerDraftState } from "../../features/designers/persistence";
import {
  parsePortfolioCandidates,
} from "../../features/agent/analyze-portfolio";
import type { TaskRecord } from "../../features/tasks/state";

type DesignerDraft = {
  name: string;
  signature: string;
  summary: string;
  principle: string;
  personaCode: string;
  version: string;
  tags: string;
  palette: string;
  typography: string;
  composition: string;
  texture: string;
  negativeRules: string;
};

const emptyDraft: DesignerDraft = {
  name: "",
  signature: "",
  summary: "",
  principle: "",
  personaCode: "CUSTOM-A",
  version: "v0.1",
  tags: "",
  palette: "#E8E4DC, #252525, #6C7A70",
  typography: "",
  composition: "",
  texture: "",
  negativeRules: "",
};

const profileToDraft = (
  profile: PersonaProfile,
  locale: Locale,
): DesignerDraft => ({
  name: localize(locale, profile.name),
  signature: localize(locale, profile.signature),
  summary: localize(locale, profile.summary),
  principle: localize(locale, profile.principle),
  personaCode: profile.personaCode,
  version: profile.version,
  tags: profile.tags.map((tag) => localize(locale, tag)).join(", "),
  palette: profile.styleDna.palette.join(", "),
  typography: localize(locale, profile.styleDna.typography),
  composition: localize(locale, profile.styleDna.composition),
  texture: localize(locale, profile.styleDna.texture),
  negativeRules: profile.negativeRules
    .map((rule) => localize(locale, rule))
    .join("\n"),
});

const localized = (value: string): LocalizedText => ({ zh: value, en: value });

const designerArtworkPrompt = (profile: PersonaProfile): string => [
  "Create one original, stylized character portrait for a graphic designer profile.",
  `Persona name: ${profile.name.en}.`,
  `Style summary: ${profile.summary.en}.`,
  `Creative principle: ${profile.principle.en}.`,
  `Palette: ${profile.styleDna.palette.join(", ") || "not specified"}.`,
  "Use an editorial illustration rather than a real-person likeness. Do not depict a public figure, existing fictional character, logo, or readable text.",
  "Output a single square portrait with a clear subject and an uncluttered background.",
].join("\n");

type DesignerLibraryProps = {
  locale: Locale;
  notify: (message: string) => void;
  onUseForNew?: (personaId: string) => void;
  workspaceId?: string;
  readOnly?: boolean;
};

const mergeProfiles = (
  persisted: PersonaProfile[] | undefined,
): PersonaProfile[] => {
  const persistedById = new Map(
    (persisted ?? []).map((profile) => [profile.id, profile]),
  );
  const builtins = personaProfiles.map((builtin) => {
    const stored = persistedById.get(builtin.id);
    return stored && stored.status === "archived"
      ? { ...builtin, status: "archived" as const }
      : builtin;
  });
  const custom = (persisted ?? []).filter(
    (profile) => !personaProfiles.some((builtin) => builtin.id === profile.id),
  );
  return [...builtins, ...custom];
};

const canBeDefault = (profile: PersonaProfile | undefined): boolean =>
  profile?.status === "built-in" || profile?.status === "published";

export const DesignerLibrary = ({
  locale,
  notify,
  onUseForNew,
  workspaceId,
  readOnly = false,
}: DesignerLibraryProps) => {
  const [profiles, setProfiles] = useState(personaProfiles);
  const [selectedId, setSelectedId] = useState(personaProfiles[0].id);
  const [defaultId, setDefaultId] = useState(personaProfiles[0].id);
  const isHydrating = useRef(Boolean(workspaceId));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PersonaStatusFilter>("all");
  const [editor, setEditor] = useState<
    { mode: "new" } | { mode: "edit"; profileId: string } | null
  >(null);
  const [creationSource, setCreationSource] = useState<
    "description" | "portfolio"
  >("description");
  const [candidatePhase, setCandidatePhase] = useState<"form" | "review">(
    "form",
  );
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [portfolioInspection, setPortfolioInspection] = useState<PortfolioInspection | null>(null);
  const [selectedPortfolioSourceIds, setSelectedPortfolioSourceIds] = useState<string[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>();
  const [candidateProfiles, setCandidateProfiles] = useState<PersonaProfile[]>(
    [],
  );
  const [analysisTaskId, setAnalysisTaskId] = useState<string>();
  const [artworkTask, setArtworkTask] = useState<
    { taskId: string; candidateId: string } | undefined
  >();
  const [publishedInSession, setPublishedInSession] = useState(false);
  const [creationError, setCreationError] = useState("");
  const [newDraft, setNewDraft] = useState<DesignerDraft>(emptyDraft);
  const [editDrafts, setEditDrafts] = useState<Record<string, DesignerDraft>>(
    {},
  );
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [loadFailed, setLoadFailed] = useState(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const discardPortfolioInspection = useCallback(() => {
    if (workspaceId && portfolioInspection) {
      void getDesktopApi().discardPortfolioInspection?.({ workspaceId, inspectionId: portfolioInspection.id });
    }
    setPortfolioInspection(null);
    setSelectedPortfolioSourceIds([]);
  }, [portfolioInspection, workspaceId]);
  useEffect(() => {
    let cancelled = false;
    isHydrating.current = Boolean(workspaceId);
    setLoading(Boolean(workspaceId));
    setLoadFailed(false);
    const hydrate = async () => {
      if (!workspaceId) {
        if (!cancelled) {
          setProfiles(personaProfiles);
          setSelectedId(personaProfiles[0].id);
          setDefaultId(personaProfiles[0].id);
          setNewDraft(emptyDraft);
          setEditDrafts({});
          isHydrating.current = false;
        }
        return;
      }
      let next = null;
      try {
        next = (await getDesktopApi().loadDesignerState?.(workspaceId)) ?? null;
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
          setLoading(false);
        }
        return;
      }
      if (cancelled) return;
      const nextProfiles = mergeProfiles(next?.profiles);
      const nextDefaultId =
        next?.defaultId &&
        nextProfiles.some((profile) => profile.id === next.defaultId)
          ? next.defaultId
          : personaProfiles[0].id;
      setProfiles(nextProfiles);
      setSelectedId(nextProfiles[0]?.id ?? personaProfiles[0].id);
      setDefaultId(nextDefaultId);
      setNewDraft(
        next?.drafts?.newDraft
          ? { ...emptyDraft, ...next.drafts.newDraft }
          : emptyDraft,
      );
      setEditDrafts(
        Object.fromEntries(
          Object.entries(next?.drafts?.editDrafts ?? {}).map(([id, draft]) => [
            id,
            { ...emptyDraft, ...draft },
          ]),
        ),
      );
      isHydrating.current = false;
      setLoading(false);
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);
  useEffect(() => {
    if (!workspaceId || isHydrating.current || readOnly) return;
    const state = {
      profiles,
      defaultId,
      drafts: {
        newDraft: newDraft as DesignerDraftState,
        editDrafts: editDrafts as Record<string, DesignerDraftState>,
      },
    };
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await getDesktopApi().saveDesignerState?.(workspaceId, state);
      })
      .catch(() => undefined);
  }, [defaultId, editDrafts, newDraft, profiles, readOnly, workspaceId]);
  const selected = profiles.find((profile) => profile.id === selectedId);
  const activeDraft =
    editor?.mode === "edit"
      ? (editDrafts[editor.profileId] ??
        (selected ? profileToDraft(selected, locale) : emptyDraft))
      : newDraft;
  const setActiveDraft = (draft: DesignerDraft) => {
    if (editor?.mode === "edit")
      setEditDrafts((previous) => ({ ...previous, [editor.profileId]: draft }));
    else setNewDraft(draft);
  };
  const adoptArtworkTask = useCallback(
    async (candidateId: string, task: TaskRecord): Promise<boolean> => {
      if (!workspaceId || task.state !== "completed") return false;
      const artworkId = task.result?.assetIds?.[0];
      if (!artworkId) return false;
      const artwork = await getDesktopApi().readDesignerArtwork?.({
        workspaceId,
        artworkId,
      });
      if (!artwork) return false;
      setCandidateProfiles((previous) =>
        previous.map((profile) =>
          profile.id === candidateId
            ? {
                ...profile,
                artworkAssetId: artwork.artworkId,
                artworkUrl: `designhub-artwork://${artwork.artworkId}`,
              }
            : profile,
        ),
      );
      return true;
    },
    [workspaceId],
  );
  const openCreate = () => {
    if (readOnly || loading || loadFailed) return;
    setCreationSource("description");
    setCandidatePhase("form");
    setRightsConfirmed(false);
    setPortfolioUrl("");
    discardPortfolioInspection();
    setSelectedCandidateId(undefined);
    setCandidateProfiles([]);
    setAnalysisTaskId(undefined);
    setArtworkTask(undefined);
    setPublishedInSession(false);
    setCreationError("");
    setEditor({ mode: "new" });
  };
  const openEdit = () => {
    if (readOnly || loading || loadFailed) return;
    if (!selected) return;
    setEditDrafts((previous) =>
      previous[selected.id]
        ? previous
        : { ...previous, [selected.id]: profileToDraft(selected, locale) },
    );
    setEditor({ mode: "edit", profileId: selected.id });
  };
  const saveDraft = () => {
    if (!activeDraft.name.trim()) return;
    const tags = activeDraft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map(localized);
    const negativeRules = activeDraft.negativeRules
      .split("\n")
      .map((rule) => rule.trim())
      .filter(Boolean)
      .map(localized);
    const palette = activeDraft.palette
      .split(",")
      .map((color) => color.trim())
      .filter(Boolean);
    if (editor?.mode === "edit") {
      const edited = profiles.find(
        (profile) => profile.id === editor.profileId,
      );
      if (!edited) return;
      if (edited.status === "built-in") {
        setEditDrafts((previous) => ({
          ...previous,
          [edited.id]: activeDraft,
        }));
        setEditor(null);
        notify(t(locale, "已保留为草稿", "Kept as a draft"));
        return;
      }
      const nextProfile: PersonaProfile = {
        ...edited,
        id:
          edited.status === "published"
            ? `custom-${crypto.randomUUID()}`
            : edited.id,
        name: localized(activeDraft.name),
        signature: localized(activeDraft.signature),
        summary: localized(activeDraft.summary),
        principle: localized(activeDraft.principle),
        personaCode: activeDraft.personaCode,
        version: activeDraft.version,
        status: edited.status === "published" ? "draft" : edited.status,
        tags,
        styleDna: {
          palette,
          typography: localized(activeDraft.typography),
          composition: localized(activeDraft.composition),
          texture: localized(activeDraft.texture),
        },
        negativeRules,
      };
      setProfiles((previous) =>
        edited.status === "published"
          ? [nextProfile, ...previous]
          : previous.map((profile) =>
              profile.id === editor.profileId ? nextProfile : profile,
            ),
      );
      if (edited.status === "published") setSelectedId(nextProfile.id);
      notify(t(locale, "档案草稿已更新", "Profile draft updated"));
    } else {
      const id = `custom-${crypto.randomUUID()}`;
      const profile: PersonaProfile = {
        id,
        name: localized(activeDraft.name),
        signature: localized(activeDraft.signature),
        summary: localized(activeDraft.summary),
        principle: localized(activeDraft.principle),
        personaCode: activeDraft.personaCode || "CUSTOM-A",
        version: activeDraft.version || "v0.1",
        status: "draft",
        artworkUrl: `/personas/${id}.png`,
        artworkAlt: localized(activeDraft.name),
        tags,
        referenceCount: 0,
        styleDna: {
          palette,
          typography: localized(activeDraft.typography),
          composition: localized(activeDraft.composition),
          texture: localized(activeDraft.texture),
        },
        negativeRules,
        portfolioSheets: [],
      };
      setProfiles((previous) => [profile, ...previous]);
      setSelectedId(id);
      notify(t(locale, "新档案已保留", "New profile kept"));
    }
    setEditor(null);
  };
  const requestCandidates = async () => {
    if (creationSource === "portfolio" && !rightsConfirmed) {
      setCreationError(
        t(
          locale,
          "请先确认拥有分析这些来源的权利。",
          "Confirm rights before analysing these sources.",
        ),
      );
      return;
    }
    if (creationSource === "portfolio" && (!portfolioInspection || selectedPortfolioSourceIds.length === 0)) {
      setCreationError(
        t(
          locale,
          "请先检查并勾选至少一个作品集来源。",
          "Inspect and select at least one portfolio source first.",
        ),
      );
      return;
    }
    setCreationError("");
    setCandidateProfiles([]);
    setAnalysisTaskId(undefined);
    setCandidatePhase("review");
    if (creationSource === "portfolio" && !workspaceId) {
      setCandidatePhase("form");
      setCreationError(
        t(
          locale,
          "当前工作区未连接模型，无法分析作品集。",
          "No connected model is available for portfolio analysis.",
        ),
      );
      return;
    }
    if (workspaceId) {
      const draftId = `designer-${crypto.randomUUID()}`;
      const api = getDesktopApi();
      let request: Promise<TaskRecord | null> | undefined;
      try {
        if (creationSource === "portfolio") {
          request = api.submitPortfolioSelection?.({
            workspaceId,
            source: { kind: "designer-draft", id: draftId },
            connectionId: "openai-compatible",
            inspectionId: portfolioInspection!.id,
            sourceIds: selectedPortfolioSourceIds,
            rightsConfirmed: true,
          });
        } else {
          request = api.submitConversation?.({
            workspaceId,
            source: { kind: "designer-draft", id: draftId },
            connectionId: "openai-compatible",
            message: `Create a designer persona from this style description.\nStyle summary: ${activeDraft.summary.trim()}\nCreative principle: ${activeDraft.principle.trim()}`,
          });
        }
      } catch {
        setCandidatePhase("form");
        setCreationError(
          t(
            locale,
            "作品集来源提交失败，请重新检查来源。",
            "Portfolio sources could not be submitted; inspect them again.",
          ),
        );
        return;
      }
      if (!request) {
        setCandidatePhase("form");
        setCreationError(
          t(
            locale,
            "当前工作区未连接模型，无法分析作品集。",
            "No connected model is available for portfolio analysis.",
          ),
        );
        return;
      }
      const consumeCompletedTask = (candidateTask: TaskRecord): boolean => {
        if (candidateTask.state === "completed" && candidateTask.result?.text) {
          setCandidateProfiles(parsePortfolioCandidates(candidateTask.result.text));
          setCreationError("");
          notify(
            t(
              locale,
              creationSource === "portfolio"
                ? "作品集分析已完成，请审核候选。"
                : "风格描述分析已完成，请审核候选。",
              creationSource === "portfolio"
                ? "Portfolio analysis completed; review the candidates."
                : "Style description analysis completed; review the candidates.",
            ),
          );
          return true;
        }
        return false;
      };
      void request
        .then(async (task) => {
          if (!task) throw new Error("ANALYSIS_UNAVAILABLE");
          if (creationSource === "portfolio") {
            setPortfolioInspection(null);
            setSelectedPortfolioSourceIds([]);
          }
          if (consumeCompletedTask(task)) return;
          const tasks = (await api.listTasks?.(workspaceId)) ?? [];
          const completed = tasks.find((item) => item.id === task.id);
          if (completed && consumeCompletedTask(completed)) return;
          if (completed?.state === "failed") throw new Error("ANALYSIS_FAILED");
          setAnalysisTaskId(task.id);
          setCreationError(
            t(
              locale,
              creationSource === "portfolio"
                ? "作品集分析任务仍在处理中，请稍后重试查看。"
                : "风格描述任务仍在处理中，请稍后重试查看。",
              creationSource === "portfolio"
                ? "Portfolio analysis is still running; check again shortly."
                : "Style description analysis is still running; check again shortly.",
            ),
          );
        })
        .catch(() => {
          if (creationSource === "portfolio") setCandidatePhase("form");
          setCandidateProfiles([]);
          setCreationError(
            t(
              locale,
              "作品集分析失败，未生成候选。",
              "Portfolio analysis failed; no candidates were generated.",
            ),
          );
        });
    }
  };
  const inspectPortfolioSources = async (request: PortfolioInspectionRequest) => {
    if (!workspaceId) {
      setCreationError(t(locale, "当前工作区未连接模型，无法检查作品集。", "No connected workspace is available to inspect portfolio sources."));
      return;
    }
    if ((request.kind === "remote-image" || request.kind === "remote-page") && !request.url?.trim()) {
      setCreationError(t(locale, "请输入 HTTPS 作品集链接。", "Enter an HTTPS portfolio URL."));
      return;
    }
    setCreationError("");
    try {
      const next = await getDesktopApi().inspectPortfolioSources?.({ workspaceId, request });
      if (!next) throw new Error("PORTFOLIO_INSPECTION_UNAVAILABLE");
      discardPortfolioInspection();
      setPortfolioInspection(next);
      setSelectedPortfolioSourceIds([]);
    } catch {
      setCreationError(t(locale, "作品集来源无法检查，请使用公开 HTTPS 图片、页面或本地文件。", "Portfolio sources could not be inspected. Use a public HTTPS image, page, or local file."));
    }
  };
  const togglePortfolioSource = (sourceId: string, selected: boolean) => {
    setSelectedPortfolioSourceIds((previous) => selected
      ? [...previous, sourceId].slice(0, 8)
      : previous.filter((id) => id !== sourceId));
  };
  useEffect(() => {
    if (!analysisTaskId || !workspaceId || !editor) return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const poll = async (): Promise<void> => {
      if (cancelled) return;
      attempts += 1;
      try {
        const listTasks = getDesktopApi().listTasks;
        if (!listTasks) throw new Error("TASK_LIST_UNAVAILABLE");
        const tasks = (await listTasks(workspaceId)) ?? [];
        if (cancelled) return;
        const task = tasks.find((item) => item.id === analysisTaskId);
        if (task?.state === "completed" && task.result?.text) {
          setCandidateProfiles(parsePortfolioCandidates(task.result.text));
          setAnalysisTaskId(undefined);
          setCreationError("");
          return;
        }
        if (task?.state === "failed" || attempts >= 12) {
          setAnalysisTaskId(undefined);
          setCandidateProfiles([]);
          setCreationError(
            t(
              locale,
              "分析失败，未生成候选。",
              "Analysis failed; no candidates were generated.",
            ),
          );
          return;
        }
        timer = window.setTimeout(() => {
          void poll();
        }, 500);
      } catch {
        if (cancelled) return;
        setAnalysisTaskId(undefined);
        setCandidateProfiles([]);
        setCreationError(
          t(
            locale,
            "分析失败，未生成候选。",
            "Analysis failed; no candidates were generated.",
          ),
        );
      }
    };
    timer = window.setTimeout(() => {
      void poll();
    }, 500);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [analysisTaskId, editor, locale, workspaceId]);
  const requestCandidateArtwork = async () => {
    if (!workspaceId || readOnly || !selectedCandidateId) return;
    const candidate = candidateProfiles.find(
      (profile) => profile.id === selectedCandidateId,
    );
    if (!candidate) {
      setCreationError(
        t(
          locale,
          "候选结果已不可用，请重新分析。",
          "This candidate is no longer available; analyse again.",
        ),
      );
      return;
    }
    const submit = getDesktopApi().submitDesignerArtworkGeneration;
    if (!submit) {
      setCreationError(
        t(
          locale,
          "当前工作区未连接模型，无法生成形象。",
          "No connected model is available to generate artwork.",
        ),
      );
      return;
    }
    setCreationError("");
    try {
      const task = await submit({
        workspaceId,
        source: { kind: "designer-draft", id: candidate.id },
        connectionId: "openai-compatible",
        prompt: designerArtworkPrompt(candidate),
        size: "1024x1024",
        count: 1,
      });
      if (!task) throw new Error("DESIGNER_ARTWORK_UNAVAILABLE");
      if (await adoptArtworkTask(candidate.id, task)) {
        notify(t(locale, "人物形象已生成", "Character artwork generated"));
        return;
      }
      if (task.state === "failed" || task.state === "cancelled") {
        throw new Error("DESIGNER_ARTWORK_FAILED");
      }
      setArtworkTask({ taskId: task.id, candidateId: candidate.id });
      setCreationError(
        t(
          locale,
          "人物形象正在生成，请稍后查看。",
          "Character artwork is generating; check again shortly.",
        ),
      );
    } catch {
      setArtworkTask(undefined);
      setCreationError(
        t(
          locale,
          "人物形象生成失败，请重试。",
          "Character artwork generation failed; try again.",
        ),
      );
    }
  };
  useEffect(() => {
    if (!artworkTask || !workspaceId || !editor) return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const poll = async (): Promise<void> => {
      if (cancelled) return;
      attempts += 1;
      try {
        const listTasks = getDesktopApi().listTasks;
        if (!listTasks) throw new Error("TASK_LIST_UNAVAILABLE");
        const tasks = (await listTasks(workspaceId)) ?? [];
        if (cancelled) return;
        const task = tasks.find((item) => item.id === artworkTask.taskId);
        if (task?.state === "completed") {
          const adopted = await adoptArtworkTask(artworkTask.candidateId, task);
          if (cancelled) return;
          setArtworkTask(undefined);
          if (adopted) {
            setCreationError("");
            notify(t(locale, "人物形象已生成", "Character artwork generated"));
          } else {
            setCreationError(
              t(
                locale,
                "人物形象无法读取，请重试。",
                "Character artwork could not be read; try again.",
              ),
            );
          }
          return;
        }
        if (task?.state === "failed" || task?.state === "cancelled" || attempts >= 12) {
          setArtworkTask(undefined);
          setCreationError(
            t(
              locale,
              "人物形象生成失败，请重试。",
              "Character artwork generation failed; try again.",
            ),
          );
          return;
        }
        timer = window.setTimeout(() => {
          void poll();
        }, 500);
      } catch {
        if (cancelled) return;
        setArtworkTask(undefined);
        setCreationError(
          t(
            locale,
            "人物形象生成失败，请重试。",
            "Character artwork generation failed; try again.",
          ),
        );
      }
    };
    timer = window.setTimeout(() => {
      void poll();
    }, 500);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [adoptArtworkTask, artworkTask, editor, locale, notify, workspaceId]);
  const publishPreview = () => {
    if (!selectedCandidateId) {
      setCreationError(
        t(locale, "请先选用一个候选。", "Select a candidate first."),
      );
      return;
    }
    const candidate =
      candidateProfiles.find((profile) => profile.id === selectedCandidateId) ??
      personaProfiles.find((profile) => profile.id === selectedCandidateId);
    if (!candidate) {
      setCreationError(
        t(
          locale,
          "候选结果已不可用，请重新分析。",
          "This candidate is no longer available; analyse again.",
        ),
      );
      return;
    }
    const published: PersonaProfile = {
      ...candidate,
      id: `custom-${crypto.randomUUID()}`,
      status: "published",
      referenceCount: 0,
    };
    setProfiles((previous) => [
      published,
      ...previous.filter((profile) => profile.id !== candidate.id),
    ]);
    setSelectedId(published.id);
    setCreationError("");
    setPublishedInSession(true);
    notify(
      workspaceId
        ? t(
            locale,
            "设计师已发布并保存到当前工作区。",
            "Designer published and saved to the current workspace.",
          )
        : t(
            locale,
            "已在本次示例会话中发布，不会写入磁盘。",
            "Published in this example session only; nothing was written to disk.",
          ),
    );
  };
  const deleteSelected = () => {
    if (readOnly || loading || loadFailed) return;
    if (!selected || selected.status === "built-in") return;
    if (selected.referenceCount > 0) {
      setProfiles((previous) =>
        previous.map((profile) =>
          profile.id === selected.id
            ? { ...profile, status: "archived" }
            : profile,
        ),
      );
      notify(t(locale, "档案已归档", "Profile archived"));
      return;
    }
    setProfiles((previous) =>
      previous.filter((profile) => profile.id !== selected.id),
    );
    setSelectedId(
      defaultId === selected.id
        ? (profiles.find((profile) => profile.id !== selected.id)?.id ?? "")
        : selectedId,
    );
    notify(t(locale, "档案已移除", "Profile removed"));
  };
  const duplicateSelected = () => {
    if (readOnly || loading || loadFailed) return;
    if (!selected) return;
    const id = `derived-${crypto.randomUUID()}`;
    const profile: PersonaProfile = {
      ...selected,
      id,
      name: localized(
        `${localize(locale, selected.name)} ${t(locale, "派生版", "Derived")}`,
      ),
      status: "draft",
      version: "v0.1",
      referenceCount: 0,
      artworkUrl: `/personas/${id}.png`,
      artworkAlt: localized(
        `${localize(locale, selected.name)} ${t(locale, "派生版", "Derived")}`,
      ),
    };
    setProfiles((previous) => [profile, ...previous]);
    setSelectedId(id);
    notify(t(locale, "已创建派生档案", "Derived profile created"));
  };
  return (
    <section className="page-content library-page designer-library-page">
      <PageHeader
        title={t(locale, "设计师", "Designers")}
        eyebrow={t(locale, "创作档案", "Creative profiles")}
        description={t(
          locale,
          "管理设计风格、人物形象与创作规则。",
          "Manage style, character artwork and creative rules.",
        )}
      />
      <div className="library-split library-split--designer">
        <PersonaRepository
          locale={locale}
          profiles={profiles}
          selectedId={selectedId}
          query={query}
          statusFilter={statusFilter}
          defaultId={defaultId}
          onQueryChange={setQuery}
          onStatusFilterChange={setStatusFilter}
          onSelect={setSelectedId}
          onCreate={readOnly || loading || loadFailed ? undefined : openCreate}
        />
        <PersonaInspector
          locale={locale}
          profile={selected}
          workspaceId={workspaceId}
          isDefault={selectedId === defaultId}
          readOnly={readOnly || loading || loadFailed}
          canSetDefault={canBeDefault(selected)}
          canUseForNew={!loading && !loadFailed}
          onEdit={openEdit}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onRestore={() => {
            if (!selected || readOnly || loading || loadFailed) return;
            setProfiles((previous) =>
              previous.map((profile) =>
                profile.id === selected.id
                  ? { ...profile, status: "published" }
                  : profile,
              ),
            );
            notify(t(locale, "档案已恢复", "Profile restored"));
          }}
          onSetDefault={() => {
            if (readOnly || loading || loadFailed || !canBeDefault(selected))
              return;
            setDefaultId(selectedId);
            notify(t(locale, "已设为会话默认", "Set as session default"));
          }}
          onUseForNew={() => {
            if (loading || loadFailed) return;
            if (onUseForNew && selected) onUseForNew(selected.id);
            else
              notify(
                t(locale, "请从项目库新建", "Start a new design from Projects"),
              );
          }}
        />
      </div>
      {(loadFailed || readOnly || !workspaceId) && <p className="page-footnote">
        <Icon name="circle-help" size={14} />
        {loadFailed ? (
          <>
            <span>
              {t(
                locale,
                "设计师档案读取失败。",
                "Designer profiles could not be loaded.",
              )}
            </span>
            <button type="button" onClick={() => window.location.reload()}>
              {t(locale, "重试", "Retry")}
            </button>
          </>
        ) : readOnly ? (
          t(
            locale,
            "当前工作区只读，设计师档案不可修改。",
            "This workspace is read-only; designer profiles cannot be changed.",
          )
        ) : !workspaceId ? (
          t(
            locale,
            "人物位图尚未生成时会显示待生成；档案和草稿会保存到当前工作区。",
            "When character bitmaps are unavailable, profiles and drafts are saved to the current workspace.",
          )
        ) : null}
      </p>}
      {editor && (
        <DesignerEditorModal
          locale={locale}
          draft={activeDraft}
          mode={editor.mode}
          source={creationSource}
          candidates={candidateProfiles}
          candidatePhase={candidatePhase}
          allowExampleCandidates={Boolean(!workspaceId)}
          rightsConfirmed={rightsConfirmed}
          portfolioUrl={portfolioUrl}
          portfolioInspection={portfolioInspection}
          selectedPortfolioSourceIds={selectedPortfolioSourceIds}
          selectedCandidateId={selectedCandidateId}
          publishedInSession={publishedInSession}
          error={creationError}
          onSourceChange={(source) => {
            if (source !== "portfolio") discardPortfolioInspection();
            setCreationSource(source);
          }}
          onRightsConfirmed={setRightsConfirmed}
          onPortfolioUrlChange={setPortfolioUrl}
          onInspectPortfolioSources={inspectPortfolioSources}
          onPortfolioSourceToggle={togglePortfolioSource}
          onCandidatePhaseChange={setCandidatePhase}
          onCandidateSelect={setSelectedCandidateId}
          onRequestCandidates={requestCandidates}
          onGenerateArtwork={requestCandidateArtwork}
          artworkBusy={Boolean(artworkTask)}
          canGenerateArtwork={Boolean(workspaceId) && !readOnly}
          onPublish={publishPreview}
          onDraftChange={setActiveDraft}
          onClose={() => {
            discardPortfolioInspection();
            setEditor(null);
          }}
          onSubmit={saveDraft}
        />
      )}
    </section>
  );
};

const DesignerEditorModal = ({
  locale,
  draft,
  mode,
  source,
  candidates,
  candidatePhase,
  allowExampleCandidates,
  rightsConfirmed,
  portfolioUrl,
  portfolioInspection,
  selectedPortfolioSourceIds,
  selectedCandidateId,
  publishedInSession,
  error,
  onSourceChange,
  onRightsConfirmed,
  onPortfolioUrlChange,
  onInspectPortfolioSources,
  onPortfolioSourceToggle,
  onCandidatePhaseChange,
  onCandidateSelect,
  onRequestCandidates,
  onGenerateArtwork,
  artworkBusy,
  canGenerateArtwork,
  onPublish,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  locale: Locale;
  draft: DesignerDraft;
  mode: "new" | "edit";
  source: "description" | "portfolio";
  candidates: PersonaProfile[];
  candidatePhase: "form" | "review";
  allowExampleCandidates: boolean;
  rightsConfirmed: boolean;
  portfolioUrl: string;
  portfolioInspection: PortfolioInspection | null;
  selectedPortfolioSourceIds: string[];
  selectedCandidateId?: string;
  publishedInSession: boolean;
  error: string;
  onSourceChange: (source: "description" | "portfolio") => void;
  onRightsConfirmed: (value: boolean) => void;
  onPortfolioUrlChange: (value: string) => void;
  onInspectPortfolioSources: (request: PortfolioInspectionRequest) => void;
  onPortfolioSourceToggle: (sourceId: string, selected: boolean) => void;
  onCandidatePhaseChange: (phase: "form" | "review") => void;
  onCandidateSelect: (id: string) => void;
  onRequestCandidates: () => void;
  onGenerateArtwork: () => void;
  artworkBusy: boolean;
  canGenerateArtwork: boolean;
  onPublish: () => void;
  onDraftChange: (draft: DesignerDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const setField =
    (field: keyof DesignerDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onDraftChange({ ...draft, [field]: event.target.value });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <Modal
      title={
        mode === "new"
          ? t(locale, "创建设计师", "Create designer")
          : t(locale, "编辑设计师", "Edit designer")
      }
      locale={locale}
      onClose={onClose}
      wide
    >
      <div
        className="designer-source-tabs"
        role="group"
        aria-label={t(locale, "来源方式", "Source mode")}
      >
        <button
          type="button"
          aria-pressed={source === "description"}
          className={source === "description" ? "is-active" : ""}
          onClick={() => {
            onSourceChange("description");
            onCandidatePhaseChange("form");
          }}
        >
          {t(locale, "描述", "Description")}
        </button>
        <button
          type="button"
          aria-pressed={source === "portfolio"}
          className={source === "portfolio" ? "is-active" : ""}
          onClick={() => {
            onSourceChange("portfolio");
            onCandidatePhaseChange("form");
          }}
        >
          {t(locale, "作品集", "Portfolio")}
        </button>
      </div>
      {mode === "new" && candidatePhase === "review" ? (
        <CandidateReview
          locale={locale}
          candidates={candidates}
          allowExamples={source === "description" && allowExampleCandidates}
          selectedCandidateId={selectedCandidateId}
          publishedInSession={publishedInSession}
          error={error}
          onSelect={onCandidateSelect}
          onGenerateArtwork={onGenerateArtwork}
          artworkBusy={artworkBusy}
          canGenerateArtwork={canGenerateArtwork}
          onPublish={onPublish}
        />
      ) : (
        <form className="designer-editor" onSubmit={submit}>
          <div className="designer-form">
            <p className="panel-label">
              {t(locale, "档案草稿", "Profile draft")}
            </p>
            <Field label={t(locale, "名称", "Name")}>
              <input required value={draft.name} onChange={setField("name")} />
            </Field>
            <Field label={t(locale, "署名", "Signature")}>
              <input value={draft.signature} onChange={setField("signature")} />
            </Field>
            <Field
              label={
                mode === "new" && source === "description"
                  ? t(locale, "风格描述", "Style description")
                  : t(locale, "风格说明", "Style summary")
              }
            >
              <textarea
                rows={3}
                value={draft.summary}
                onChange={setField("summary")}
              />
            </Field>
            <Field label={t(locale, "创作原则", "Creative principle")}>
              <textarea
                rows={3}
                value={draft.principle}
                onChange={setField("principle")}
              />
            </Field>
            {mode === "new" && source === "portfolio" && (
              <>
                <Field label={t(locale, "作品集链接", "Portfolio URL")}>
                  <textarea
                    rows={3}
                    value={portfolioUrl}
                    onChange={(event) => onPortfolioUrlChange(event.target.value)}
                  />
                </Field>
                <div className="designer-portfolio-actions" role="group" aria-label={t(locale, "检查作品集来源", "Inspect portfolio sources")}>
                  <Button type="button" variant="secondary" onClick={() => onInspectPortfolioSources({ kind: "remote-page", url: portfolioUrl })}>{t(locale, "检查页面", "Inspect page")}</Button>
                  <Button type="button" variant="secondary" onClick={() => onInspectPortfolioSources({ kind: "remote-image", url: portfolioUrl })}>{t(locale, "检查图片", "Inspect image")}</Button>
                  <Button type="button" variant="secondary" onClick={() => onInspectPortfolioSources({ kind: "local-images" })}>{t(locale, "选择图片", "Choose images")}</Button>
                  <Button type="button" variant="secondary" onClick={() => onInspectPortfolioSources({ kind: "local-zip" })}>{t(locale, "选择 ZIP", "Choose ZIP")}</Button>
                </div>
                {portfolioInspection && (
                  <div className="designer-portfolio-candidates" role="group" aria-label={t(locale, "作品集候选", "Portfolio candidates")}>
                    {portfolioInspection.candidates.map((candidate) => (
                      <label key={candidate.id} className="designer-portfolio-candidate">
                        <input
                          type="checkbox"
                          aria-label={candidate.label}
                          checked={selectedPortfolioSourceIds.includes(candidate.id)}
                          onChange={(event) => onPortfolioSourceToggle(candidate.id, event.target.checked)}
                        />
                        {candidate.previewUrl && <img src={candidate.previewUrl} alt="" />}
                        <span>{candidate.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={(event) =>
                      onRightsConfirmed(event.target.checked)
                    }
                  />
                  {t(
                    locale,
                    "我确认拥有分析这些来源的权利",
                    "I confirm I have rights to analyse these sources",
                  )}
                </label>
              </>
            )}
            {mode === "new" && (
              <>
                <p className="form-error" role="alert">
                  {error}
                </p>
                <Button
                  type="button"
                  variant="ai"
                  icon="sparkles"
                  onClick={onRequestCandidates}
                >
                  {t(locale, "生成", "Generate")}
                </Button>
              </>
            )}
          </div>
          <aside
            className="designer-draft-preview"
            aria-label={t(locale, "档案预览", "Profile preview")}
          >
            <span className="profile-mark">
              <Icon name="sparkles" size={22} />
            </span>
            <p className="section-kicker">
              {t(locale, "会话草稿", "Session draft")}
            </p>
            <h3>{draft.name || t(locale, "未命名档案", "Untitled profile")}</h3>
            <p>
              {draft.summary ||
                t(
                  locale,
                  "填写风格说明查看预览。",
                  "Add a style summary to preview it.",
                )}
            </p>
            <div className="draft-rule">
              <span>{t(locale, "规则", "Rules")}</span>
              {draft.negativeRules || t(locale, "尚未填写", "Not provided")}
            </div>
            <small>
              {t(
                locale,
                "关闭后草稿仍保留在本次示例会话中。",
                "Closing keeps this draft in the example session.",
              )}
            </small>
          </aside>
          <div className="dialog-actions designer-editor-actions">
            <Button variant="ghost" onClick={onClose}>
              {t(locale, "关闭", "Close")}
            </Button>
            <Button variant="primary" icon="check" type="submit">
              {t(locale, "保留", "Keep")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

const CandidateReview = ({
  locale,
  candidates,
  allowExamples,
  selectedCandidateId,
  publishedInSession,
  error,
  onSelect,
  onGenerateArtwork,
  artworkBusy,
  canGenerateArtwork,
  onPublish,
}: {
  locale: Locale;
  candidates: PersonaProfile[];
  allowExamples: boolean;
  selectedCandidateId?: string;
  publishedInSession: boolean;
  error: string;
  onSelect: (candidateId: string) => void;
  onGenerateArtwork: () => void;
  artworkBusy: boolean;
  canGenerateArtwork: boolean;
  onPublish: () => void;
}) => {
  const visibleCandidates =
    candidates.length > 0
      ? candidates
      : allowExamples
        ? personaProfiles.filter((profile) =>
            ["paper-type", "clear-commerce", "natural-story"].includes(
              profile.id,
            ),
          )
        : [];
  return (
    <section
      className="candidate-review"
      aria-labelledby="candidate-review-title"
    >
      <p className="section-kicker">
        {allowExamples
          ? t(locale, "示例候选", "Example candidates")
          : t(locale, "分析候选", "Analysis candidates")}
      </p>
      <h2 id="candidate-review-title">
        {t(locale, "选择人物形象", "Choose a persona")}
      </h2>
      {visibleCandidates.length > 0 ? (
        <div
          className="persona-candidate-grid"
          role="group"
          aria-label={t(locale, "人物候选", "Persona candidates")}
        >
          {visibleCandidates.map((profile, index) => (
            <button
              type="button"
              key={profile.id}
              className={`persona-candidate ${selectedCandidateId === profile.id ? "is-selected" : ""}`}
              aria-label={`${t(locale, "候选", "Candidate")} ${index + 1} · ${localize(locale, profile.name)}`}
              aria-pressed={selectedCandidateId === profile.id}
              onClick={() => onSelect(profile.id)}
            >
              <span className="persona-candidate__art">
                <PersonaArtwork
                  personaId={profile.id}
                  profile={profile}
                  crop="full"
                />
              </span>
              <strong>
                {t(locale, `候选 ${index + 1}`, `Candidate ${index + 1}`)}
              </strong>
              <span>{localize(locale, profile.name)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="panel-note">
          {t(
            locale,
            "没有可审核的分析候选。",
            "No analysis candidates are available to review.",
          )}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="ai"
        icon="sparkles"
        disabled={!canGenerateArtwork || !selectedCandidateId || artworkBusy || visibleCandidates.length === 0}
        onClick={onGenerateArtwork}
      >
        {t(locale, "生成形象", "Generate art")}
      </Button>
      <Button
        type="button"
        variant="primary"
        icon="check"
        disabled={
          !selectedCandidateId ||
          publishedInSession ||
          visibleCandidates.length === 0
        }
        onClick={onPublish}
      >
        {t(locale, "发布预览", "Publish preview")}
      </Button>
      {publishedInSession && (
        <p className="panel-note">
          {t(
            locale,
            "已在本次示例会话中发布，不会写入磁盘。",
            "Published in this example session only; nothing is written to disk.",
          )}
        </p>
      )}
    </section>
  );
};
