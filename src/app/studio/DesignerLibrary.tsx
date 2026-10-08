import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import type { Locale } from "../i18n";
import { Drawer } from "./Drawer";
import { DesignerProfileCard } from "./DesignerProfileCard";
import { PersonaInspector } from "./PersonaInspector";
import { PortfolioUploader } from "./PortfolioUploader";
import { Tooltip } from "./Tooltip";
import {
  PersonaRepository,
  type PersonaStatusFilter,
} from "./PersonaRepository";
import {
  localize,
  type LocalizedText,
  type PersonaProfile,
} from "./personas";
import { Button, Field, Icon, Modal, PageHeader, t } from "./ui";
import { getDesktopApi } from "../../platform/runtime";
import type { PortfolioInspection, PortfolioInspectionRequest } from "../../platform/contracts";
import type { DesignerDraftState } from "../../features/designers/persistence";
import { legacySeededDesignerIds } from "../../features/designers/persistence";
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
  contrast: string;
  darkAiriness: string;
  whitespace: string;
  grain: string;
  diffuseLight: string;
  typeFamily: string;
  typeWeight: string;
  tracking: string;
  compositionTopology: string;
  rendering: string;
};

type PortfolioWizardPhase = "import" | "analyse" | "avatar" | "review";
type ArtworkOption = { assetId: string; artworkUrl: string };

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
  contrast: "",
  darkAiriness: "",
  whitespace: "",
  grain: "",
  diffuseLight: "",
  typeFamily: "",
  typeWeight: "",
  tracking: "",
  compositionTopology: "",
  rendering: "",
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
  contrast: profile.styleDna.signals?.contrast.toString() ?? "",
  darkAiriness: profile.styleDna.signals?.darkAiriness.toString() ?? "",
  whitespace: profile.styleDna.signals?.whitespace.toString() ?? "",
  grain: profile.styleDna.signals?.grain.toString() ?? "",
  diffuseLight: profile.styleDna.signals?.diffuseLight.toString() ?? "",
  typeFamily: profile.styleDna.signals ? localize(locale, profile.styleDna.signals.typeFamily) : "",
  typeWeight: profile.styleDna.signals ? localize(locale, profile.styleDna.signals.typeWeight) : "",
  tracking: profile.styleDna.signals ? localize(locale, profile.styleDna.signals.tracking) : "",
  compositionTopology: profile.styleDna.signals ? localize(locale, profile.styleDna.signals.compositionTopology) : "",
  rendering: profile.styleDna.signals ? localize(locale, profile.styleDna.signals.rendering) : "",
});

const localized = (value: string): LocalizedText => ({ zh: value, en: value });

const updateLocalized = (base: LocalizedText, locale: Locale, value: string): LocalizedText => locale === "zh-CN"
  ? { ...base, zh: value }
  : { ...base, en: value };

const percentageFromDraft = (value: string, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : fallback;
};

const profileFromDraft = (draft: DesignerDraft, base: PersonaProfile, locale: Locale): PersonaProfile => {
  const tags = draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const negativeRules = draft.negativeRules.split("\n").map((rule) => rule.trim()).filter(Boolean);
  const hasSignals = Boolean(base.styleDna.signals) || [draft.contrast, draft.darkAiriness, draft.whitespace, draft.grain, draft.diffuseLight,
    draft.typeFamily, draft.typeWeight, draft.tracking, draft.compositionTopology, draft.rendering].some((value) => value.trim());
  const previousSignals = base.styleDna.signals;
  return {
    ...base,
    name: updateLocalized(base.name, locale, draft.name.trim()),
    signature: updateLocalized(base.signature, locale, draft.signature.trim()),
    summary: updateLocalized(base.summary, locale, draft.summary.trim()),
    principle: updateLocalized(base.principle, locale, draft.principle.trim()),
    personaCode: draft.personaCode.trim(),
    version: draft.version.trim(),
    tags: tags.map((tag, index) => updateLocalized(base.tags[index] ?? localized(tag), locale, tag)),
    styleDna: {
      palette: draft.palette.split(",").map((color) => color.trim()).filter(Boolean),
      typography: updateLocalized(base.styleDna.typography, locale, draft.typography.trim()),
      composition: updateLocalized(base.styleDna.composition, locale, draft.composition.trim()),
      texture: updateLocalized(base.styleDna.texture, locale, draft.texture.trim()),
      ...(hasSignals ? { signals: {
        contrast: percentageFromDraft(draft.contrast, previousSignals?.contrast),
        darkAiriness: percentageFromDraft(draft.darkAiriness, previousSignals?.darkAiriness),
        whitespace: percentageFromDraft(draft.whitespace, previousSignals?.whitespace),
        grain: percentageFromDraft(draft.grain, previousSignals?.grain),
        diffuseLight: percentageFromDraft(draft.diffuseLight, previousSignals?.diffuseLight),
        typeFamily: updateLocalized(previousSignals?.typeFamily ?? localized(""), locale, draft.typeFamily.trim()),
        typeWeight: updateLocalized(previousSignals?.typeWeight ?? localized(""), locale, draft.typeWeight.trim()),
        tracking: updateLocalized(previousSignals?.tracking ?? localized(""), locale, draft.tracking.trim()),
        compositionTopology: updateLocalized(previousSignals?.compositionTopology ?? localized(""), locale, draft.compositionTopology.trim()),
        rendering: updateLocalized(previousSignals?.rendering ?? localized(""), locale, draft.rendering.trim()),
      } } : {}),
    },
    negativeRules: negativeRules.map((rule, index) => updateLocalized(base.negativeRules[index] ?? localized(rule), locale, rule)),
    artworkAssetId: undefined,
    artworkUrl: "",
  };
};

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
  libraryId?: string;
  preview?: boolean;
  initialProfiles?: PersonaProfile[];
  readOnly?: boolean;
  toolbarActive?: boolean;
  createRequestId?: number;
  onProfilesChange?: (profiles: PersonaProfile[]) => void;
  onCreateUnavailable?: (reason: "read-only" | "load-failed") => void;
  showLibrary?: boolean;
};

const mergeProfiles = (persisted: PersonaProfile[] | undefined): PersonaProfile[] =>
  (persisted ?? [])
    .filter((profile) => !legacySeededDesignerIds.has(profile.id))
    .map((profile) => profile.status === "built-in"
    ? { ...profile, status: "published" as const }
    : profile);

const canBeDefault = (profile: PersonaProfile | undefined): boolean =>
  profile?.status === "published";

const emptyProfiles: PersonaProfile[] = [];

export const DesignerLibrary = ({
  locale,
  notify,
  onUseForNew,
  libraryId,
  preview = false,
  initialProfiles = emptyProfiles,
  readOnly = false,
  toolbarActive = true,
  createRequestId = 0,
  onProfilesChange,
  onCreateUnavailable,
  showLibrary = true,
}: DesignerLibraryProps) => {
  const [profiles, setProfiles] = useState<PersonaProfile[]>(() => libraryId || !preview ? [] : initialProfiles);
  const [selectedId, setSelectedId] = useState(() => libraryId || !preview ? '' : initialProfiles[0]?.id ?? '');
  const [defaultId, setDefaultId] = useState(() => libraryId || !preview ? '' : initialProfiles[0]?.id ?? '');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const isHydrating = useRef(Boolean(libraryId));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PersonaStatusFilter>("all");
  const [editor, setEditor] = useState<
    { mode: "new" } | { mode: "edit"; profileId: string } | null
  >(null);
  const [wizardPhase, setWizardPhase] = useState<PortfolioWizardPhase>("import");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [portfolioInspection, setPortfolioInspection] = useState<PortfolioInspection | null>(null);
  const [selectedPortfolioSourceIds, setSelectedPortfolioSourceIds] = useState<string[]>([]);
  const [portfolioInspecting, setPortfolioInspecting] = useState(false);
  const [analysisProfile, setAnalysisProfile] = useState<PersonaProfile>();
  const [analysisDraft, setAnalysisDraft] = useState<DesignerDraft>();
  const [analysisTaskId, setAnalysisTaskId] = useState<string>();
  const [artwork, setArtwork] = useState<ArtworkOption>();
  const [artworkTaskId, setArtworkTaskId] = useState<string>();
  const [artworkSubmitting, setArtworkSubmitting] = useState(false);
  const [publishedInSession, setPublishedInSession] = useState(false);
  const [creationError, setCreationError] = useState("");
  const [newDraft, setNewDraft] = useState<DesignerDraft>(emptyDraft);
  const [editDrafts, setEditDrafts] = useState<Record<string, DesignerDraft>>(
    {},
  );
  const [loading, setLoading] = useState(Boolean(libraryId));
  const [loadFailed, setLoadFailed] = useState(false);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const lastCreateRequestId = useRef(0);
  const skipNextPersistence = useRef(false);
  const discardPortfolioInspection = useCallback(() => {
    if (libraryId && portfolioInspection) void getDesktopApi().discardPortfolioInspection?.({ libraryId, inspectionId: portfolioInspection.id });
    setPortfolioInspection(null);
    setSelectedPortfolioSourceIds([]);
  }, [portfolioInspection, libraryId]);
  useEffect(() => {
    let cancelled = false;
    isHydrating.current = Boolean(libraryId);
    setLoading(Boolean(libraryId));
    setLoadFailed(false);
    if (libraryId) {
      setProfiles([]);
      setSelectedId('');
      setDefaultId('');
      setNewDraft(emptyDraft);
      setEditDrafts({});
    }
    const hydrate = async () => {
      if (!libraryId) {
        if (!cancelled) {
          setProfiles(preview ? initialProfiles : []);
          setSelectedId(preview ? initialProfiles[0]?.id ?? '' : '');
          setDefaultId(preview ? initialProfiles[0]?.id ?? '' : '');
          setNewDraft(emptyDraft);
          setEditDrafts({});
          isHydrating.current = false;
        }
        return;
      }
      let next = null;
      try {
        next = (await getDesktopApi().loadDesignerState?.(libraryId)) ?? null;
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
        next?.defaultId && nextProfiles.some((profile) => profile.id === next.defaultId)
          ? next.defaultId
          : '';
      setProfiles(nextProfiles);
      setSelectedId(nextProfiles[0]?.id ?? '');
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
  }, [preview, libraryId, initialProfiles]);
  useEffect(() => {
    if (!libraryId || isHydrating.current || readOnly) return;
    if (skipNextPersistence.current) {
      skipNextPersistence.current = false;
      return;
    }
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
        await getDesktopApi().saveDesignerState?.(libraryId, state);
      })
      .catch(() => undefined);
  }, [defaultId, editDrafts, newDraft, profiles, readOnly, libraryId]);
  const selected = profiles.find((profile) => profile.id === selectedId);
  const selectProfile = (id: string): void => {
    setSelectedId(id);
    setInspectorOpen(true);
  };
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
  const openCreate = useCallback(() => {
    if (readOnly || loading || loadFailed) return;
    setWizardPhase("import");
    setRightsConfirmed(false);
    discardPortfolioInspection();
    setPortfolioInspecting(false);
    setAnalysisProfile(undefined);
    setAnalysisDraft(undefined);
    setAnalysisTaskId(undefined);
    setArtwork(undefined);
    setArtworkTaskId(undefined);
    setArtworkSubmitting(false);
    setPublishedInSession(false);
    setCreationError("");
    setEditor({ mode: "new" });
  }, [discardPortfolioInspection, loadFailed, loading, readOnly]);
  useEffect(() => {
    if (!createRequestId || createRequestId === lastCreateRequestId.current || loading) return;
    lastCreateRequestId.current = createRequestId;
    if (loadFailed) {
      onCreateUnavailable?.("load-failed");
      return;
    }
    if (readOnly) {
      onCreateUnavailable?.("read-only");
      return;
    }
    openCreate();
  }, [createRequestId, loadFailed, loading, onCreateUnavailable, openCreate, readOnly]);
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
    if (editor?.mode !== "edit" || !activeDraft.name.trim()) return;
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
    const edited = profiles.find((profile) => profile.id === editor.profileId);
    if (!edited) return;
    const isPublished = edited.status === "published";
    const nextProfile: PersonaProfile = {
      ...edited,
      id: isPublished ? `custom-${crypto.randomUUID()}` : edited.id,
      name: localized(activeDraft.name),
      signature: localized(activeDraft.signature),
      summary: localized(activeDraft.summary),
      principle: localized(activeDraft.principle),
      personaCode: activeDraft.personaCode,
      version: activeDraft.version,
      status: isPublished ? "draft" : edited.status,
      tags,
      styleDna: {
        palette,
        typography: localized(activeDraft.typography),
        composition: localized(activeDraft.composition),
        texture: localized(activeDraft.texture),
      },
      negativeRules,
    };
    const nextProfiles = isPublished
      ? [nextProfile, ...profiles]
      : profiles.map((profile) => profile.id === editor.profileId ? nextProfile : profile);
    setProfiles(nextProfiles);
    onProfilesChange?.(nextProfiles);
    if (isPublished) setSelectedId(nextProfile.id);
    notify(t(locale, "档案草稿已更新", "Profile draft updated"));
    setEditor(null);
  };
  const acceptAnalysis = (task: TaskRecord): boolean => {
    if (task.state !== "completed" || !task.result?.text) return false;
    const [profile] = parsePortfolioCandidates(task.result.text);
    if (!profile) throw new Error("ANALYSIS_RESULT_EMPTY");
    setAnalysisProfile(profile);
    setAnalysisDraft(profileToDraft(profile, locale));
    setArtwork(undefined);
    setAnalysisTaskId(undefined);
    setWizardPhase("analyse");
    setCreationError("");
    notify(t(locale, "作品集分析已完成，已生成视觉 DNA 报告。", "Portfolio analysis completed; the visual DNA report is ready."));
    return true;
  };
  const analysisFailure = (returnPhase: PortfolioWizardPhase) => {
    setAnalysisTaskId(undefined);
    setWizardPhase(returnPhase);
    setCreationError(t(locale, "作品集分析失败，请重试。", "Portfolio analysis failed; try again."));
  };
  const requestCandidates = async () => {
    if (!rightsConfirmed) {
      setCreationError(t(locale, "请先确认拥有分析这些来源的权利。", "Confirm rights before analysing these sources."));
      return;
    }
    if (!portfolioInspection || selectedPortfolioSourceIds.length === 0) {
      setCreationError(t(locale, "请先检查并勾选至少一个作品集来源。", "Inspect and select at least one portfolio source first."));
      return;
    }
    if (!libraryId) {
      setCreationError(t(locale, "当前工作区未连接模型，无法分析作品集。", "No connected model is available for portfolio analysis."));
      return;
    }
    const returnPhase = analysisProfile ? "analyse" : "import";
    setCreationError("");
    setWizardPhase("analyse");
    try {
      const task = await getDesktopApi().submitPortfolioSelection?.({
        libraryId,
        source: { kind: "designer-draft", id: `designer-${crypto.randomUUID()}` },
        connectionId: "openai-compatible",
        selections: [{ inspectionId: portfolioInspection.id, sourceIds: selectedPortfolioSourceIds }],
        rightsConfirmed: true,
      });
      if (!task) throw new Error("ANALYSIS_UNAVAILABLE");
      if (acceptAnalysis(task)) return;
      if (task.state === "failed" || task.state === "cancelled") throw new Error("ANALYSIS_FAILED");
      const completed = ((await getDesktopApi().listTasks?.(libraryId)) ?? []).find((item) => item.id === task.id);
      if (completed && acceptAnalysis(completed)) return;
      if (completed?.state === "failed" || completed?.state === "cancelled") throw new Error("ANALYSIS_FAILED");
      setAnalysisTaskId(task.id);
    } catch {
      analysisFailure(returnPhase);
    }
  };
  const inspectPortfolioSources = async (request: PortfolioInspectionRequest) => {
    if (!libraryId) {
      setCreationError(t(locale, "当前工作区未连接模型，无法检查作品集。", "No connected workspace is available to inspect portfolio sources."));
      return;
    }
    setPortfolioInspecting(true);
    setCreationError("");
    try {
      const next = await getDesktopApi().inspectPortfolioSources?.({ libraryId, request });
      if (!next) return;
      if (portfolioInspection) void getDesktopApi().discardPortfolioInspection?.({ libraryId, inspectionId: portfolioInspection.id });
      setPortfolioInspection(next);
      setSelectedPortfolioSourceIds(next.candidates.map((candidate) => candidate.id));
    } catch {
      setCreationError(t(locale, "作品集文件无法检查，请选择有效图片或 ZIP 文件。", "Portfolio files could not be inspected. Choose valid images or a ZIP file."));
    } finally {
      setPortfolioInspecting(false);
    }
  };
  const togglePortfolioSource = (sourceId: string, selected: boolean) => {
    setSelectedPortfolioSourceIds((previous) => selected
      ? previous.includes(sourceId) ? previous : [...previous, sourceId].slice(0, 8)
      : previous.filter((id) => id !== sourceId));
  };
  useEffect(() => {
    if (!analysisTaskId || !libraryId || !editor) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const listTasks = getDesktopApi().listTasks;
        if (!listTasks) throw new Error("TASK_LIST_UNAVAILABLE");
        const tasks = (await listTasks(libraryId)) ?? [];
        if (cancelled) return;
        const task = tasks.find((item) => item.id === analysisTaskId);
        if (task?.state === "completed" && acceptAnalysis(task)) return;
        if (task?.state === "failed") {
          analysisFailure(analysisProfile ? "analyse" : "import");
          return;
        }
        timer = window.setTimeout(() => {
          void poll();
        }, 500);
      } catch {
        if (cancelled) return;
        analysisFailure(analysisProfile ? "analyse" : "import");
      }
    };
    timer = window.setTimeout(() => {
      void poll();
    }, 500);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [analysisProfile, analysisTaskId, editor, locale, libraryId]);
  const readArtwork = async (task: TaskRecord): Promise<boolean> => {
    if (!libraryId || task.state !== "completed") return false;
    const artworkId = task.result?.assetIds?.[0];
    if (!artworkId) return false;
    const asset = await getDesktopApi().readDesignerArtwork?.({ libraryId, artworkId });
    if (!asset) return false;
    setArtwork({ assetId: asset.artworkId, artworkUrl: `designhub-artwork://${asset.artworkId}` });
    setArtworkTaskId(undefined);
    setWizardPhase("avatar");
    setCreationError("");
    return true;
  };
  const requestCandidateArtwork = async () => {
    if (!libraryId || readOnly || !analysisProfile || !analysisDraft) return;
    const profile = profileFromDraft(analysisDraft, analysisProfile, locale);
    if (!profile.name.en) {
      setCreationError(t(locale, "请先填写设计师名称。", "Enter a designer name first."));
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
    setWizardPhase("avatar");
    setArtworkSubmitting(true);
    setCreationError("");
    try {
      const task = await submit({
        libraryId,
        source: { kind: "designer-draft", id: profile.id },
        connectionId: "openai-compatible",
        prompt: designerArtworkPrompt(profile),
        size: "1024x1024",
        count: 1,
      });
      if (!task) throw new Error("DESIGNER_ARTWORK_UNAVAILABLE");
      if (await readArtwork(task)) {
        setArtworkSubmitting(false);
        notify(t(locale, "人物形象已生成", "Character artwork generated"));
        return;
      }
      if (task.state === "failed" || task.state === "cancelled") {
        throw new Error("DESIGNER_ARTWORK_FAILED");
      }
      setArtworkTaskId(task.id);
      setArtworkSubmitting(false);
    } catch {
      setArtworkSubmitting(false);
      setArtworkTaskId(undefined);
      setCreationError(
        t(
          locale,
          "人物形象生成失败，请重试。",
          "Character artwork generation failed; try again.",
        ),
      );
    }
  };
  const continueToAvatar = () => {
    if (artwork) {
      setCreationError("");
      setWizardPhase("avatar");
      return;
    }
    void requestCandidateArtwork();
  };
  useEffect(() => {
    if (!artworkTaskId || !libraryId || !editor) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const listTasks = getDesktopApi().listTasks;
        if (!listTasks) throw new Error("TASK_LIST_UNAVAILABLE");
        const tasks = (await listTasks(libraryId)) ?? [];
        if (cancelled) return;
        const task = tasks.find((item) => item.id === artworkTaskId);
        if (task?.state === "completed") {
          const adopted = await readArtwork(task);
          if (cancelled) return;
          setArtworkTaskId(undefined);
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
        if (task?.state === "failed" || task?.state === "cancelled") {
          setArtworkTaskId(undefined);
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
        setArtworkTaskId(undefined);
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
  }, [artworkTaskId, editor, locale, notify, libraryId]);
  const publishPreview = async () => {
    if (!analysisProfile || !analysisDraft || !artwork) return;
    const published: PersonaProfile = {
      ...profileFromDraft(analysisDraft, analysisProfile, locale),
      id: `custom-${crypto.randomUUID()}`,
      status: "published",
      referenceCount: 0,
      artworkAssetId: artwork.assetId,
      artworkUrl: artwork.artworkUrl,
    };
    const nextProfiles = [published, ...profiles];
    try {
      if (libraryId) {
        const saveDesignerState = getDesktopApi().saveDesignerState;
        if (!saveDesignerState) throw new Error("DESIGNER_SAVE_UNAVAILABLE");
        const state = {
          profiles: nextProfiles,
          defaultId,
          drafts: {
            newDraft: newDraft as DesignerDraftState,
            editDrafts: editDrafts as Record<string, DesignerDraftState>,
          },
        };
        const persistence = saveQueue.current
          .catch(() => undefined)
          .then(() => saveDesignerState(libraryId, state));
        saveQueue.current = persistence;
        if (!await persistence) throw new Error("DESIGNER_SAVE_FAILED");
        skipNextPersistence.current = true;
      }
      setProfiles(nextProfiles);
      onProfilesChange?.(nextProfiles);
      setSelectedId(published.id);
      setCreationError("");
      setPublishedInSession(true);
      notify(
        libraryId
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
    } catch {
      setCreationError(t(locale, "设计师发布失败，请重试。", "Designer publishing failed; try again."));
    }
  };
  const deleteSelected = () => {
    if (readOnly || loading || loadFailed) return;
    if (!selected) return;
    if (selected.referenceCount > 0) {
      const nextProfiles = profiles.map((profile) => profile.id === selected.id
        ? { ...profile, status: "archived" as const }
        : profile);
      setProfiles(nextProfiles);
      onProfilesChange?.(nextProfiles);
      notify(t(locale, "档案已归档", "Profile archived"));
      return;
    }
    const nextProfiles = profiles.filter((profile) => profile.id !== selected.id);
    setProfiles(nextProfiles);
    onProfilesChange?.(nextProfiles);
    setSelectedId(
      defaultId === selected.id
        ? (profiles.find((profile) => profile.id !== selected.id)?.id ?? "")
        : selectedId,
    );
    notify(t(locale, "档案已移除", "Profile removed"));
  };
  return (
    <>
      {showLibrary ? <section className="page-content library-page designer-library-page designer-library-page--plain">
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
            onSelect={selectProfile}
            onCreate={readOnly || loading || loadFailed ? undefined : openCreate}
            toolbarActive={toolbarActive}
          />
        </div>
        {(loadFailed || readOnly || (!libraryId && preview)) && <p className="page-footnote">
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
          ) : !libraryId && preview ? (
            t(
              locale,
              "人物位图尚未生成时会显示待生成；档案和草稿会保存到当前工作区。",
              "When character bitmaps are unavailable, profiles and drafts are saved to the current workspace.",
            )
          ) : null}
        </p>}
      </section> : null}
      <Drawer
        open={inspectorOpen && Boolean(selected)}
        title={t(locale, "设计师检查器", "Designer inspector")}
        locale={locale}
        onClose={() => setInspectorOpen(false)}
        footer={selected ? (
          <div className="persona-inspector__actions">
            <Button variant="primary" icon="settings" onClick={openEdit} disabled={readOnly || loading || loadFailed}>{t(locale, "编辑", "Edit")}</Button>
            <Button icon="plus" onClick={() => {
              if (loading || loadFailed) return;
              if (onUseForNew) {
                setInspectorOpen(false);
                onUseForNew(selected.id);
              }
              else notify(t(locale, "请从项目库新建", "Start a new design from Projects"));
            }} disabled={loading || loadFailed}>{t(locale, "用于新建", "Use for new")}</Button>
            <Button icon="star" onClick={() => {
              if (readOnly || loading || loadFailed || !canBeDefault(selected)) return;
              setDefaultId(selectedId);
              notify(t(locale, "已设为会话默认", "Set as session default"));
            }} disabled={readOnly || loading || loadFailed || selectedId === defaultId || !canBeDefault(selected)}>{selectedId === defaultId ? t(locale, "当前默认", "Current default") : t(locale, "设默认", "Set default")}</Button>
            {selected.status === "archived" ? <Button icon="rotate-ccw" onClick={() => {
              if (readOnly || loading || loadFailed) return;
              const nextProfiles = profiles.map((profile) => profile.id === selected.id ? { ...profile, status: "published" as const } : profile);
              setProfiles(nextProfiles);
              onProfilesChange?.(nextProfiles);
              notify(t(locale, "档案已恢复", "Profile restored"));
            }} disabled={readOnly || loading || loadFailed}>{t(locale, "恢复", "Restore")}</Button> : <Button icon="trash-2" onClick={deleteSelected} disabled={readOnly || loading || loadFailed}>{t(locale, "删除", "Delete")}</Button>}
          </div>
        ) : undefined}
      >
        <PersonaInspector
          locale={locale}
          profile={selected}
          libraryId={libraryId}
          isDefault={selectedId === defaultId}
          readOnly={readOnly || loading || loadFailed}
          canSetDefault={canBeDefault(selected)}
          canUseForNew={!loading && !loadFailed}
          showActions={false}
        />
      </Drawer>
      {editor && (
        <DesignerEditorModal
          locale={locale}
          draft={activeDraft}
          mode={editor.mode}
          wizardPhase={wizardPhase}
          analysisBusy={Boolean(analysisTaskId)}
          analysisDraft={analysisDraft}
          analysisProfile={analysisProfile}
          rightsConfirmed={rightsConfirmed}
          portfolioInspection={portfolioInspection}
          selectedPortfolioSourceIds={selectedPortfolioSourceIds}
          selectionCount={selectedPortfolioSourceIds.length}
          portfolioInspecting={portfolioInspecting}
          artwork={artwork}
          publishedInSession={publishedInSession}
          error={creationError}
          onRightsConfirmed={setRightsConfirmed}
          onInspectPortfolioSources={inspectPortfolioSources}
          onPortfolioUploadError={setCreationError}
          onPortfolioSourceToggle={togglePortfolioSource}
          onRequestCandidates={requestCandidates}
          onGenerateArtwork={requestCandidateArtwork}
          onContinueToAvatar={continueToAvatar}
          artworkBusy={artworkSubmitting || Boolean(artworkTaskId)}
          canGenerateArtwork={Boolean(libraryId) && !readOnly}
          onPublish={publishPreview}
          onDraftChange={setActiveDraft}
          onBackToImport={() => setWizardPhase("import")}
          onBackToAnalysis={() => setWizardPhase("analyse")}
          onBackToAvatar={() => setWizardPhase("avatar")}
          onContinueToReview={() => artwork && setWizardPhase("review")}
          onClose={() => {
            discardPortfolioInspection();
            setEditor(null);
          }}
          onSubmit={saveDraft}
        />
      )}
    </>
  );
};

const DesignerEditorModal = ({
  locale,
  draft,
  mode,
  wizardPhase,
  analysisBusy,
  analysisDraft,
  analysisProfile,
  rightsConfirmed,
  portfolioInspection,
  selectedPortfolioSourceIds,
  portfolioInspecting,
  selectionCount,
  artwork,
  publishedInSession,
  error,
  onRightsConfirmed,
  onInspectPortfolioSources,
  onPortfolioUploadError,
  onPortfolioSourceToggle,
  onRequestCandidates,
  onGenerateArtwork,
  onContinueToAvatar,
  artworkBusy,
  canGenerateArtwork,
  onPublish,
  onDraftChange,
  onBackToImport,
  onBackToAnalysis,
  onBackToAvatar,
  onContinueToReview,
  onClose,
  onSubmit,
}: {
  locale: Locale;
  draft: DesignerDraft;
  mode: "new" | "edit";
  wizardPhase: PortfolioWizardPhase;
  analysisBusy: boolean;
  analysisDraft?: DesignerDraft;
  analysisProfile?: PersonaProfile;
  rightsConfirmed: boolean;
  portfolioInspection: PortfolioInspection | null;
  selectedPortfolioSourceIds: string[];
  portfolioInspecting: boolean;
  selectionCount: number;
  artwork?: ArtworkOption;
  publishedInSession: boolean;
  error: string;
  onRightsConfirmed: (value: boolean) => void;
  onInspectPortfolioSources: (request: PortfolioInspectionRequest) => Promise<void>;
  onPortfolioUploadError: (message: string) => void;
  onPortfolioSourceToggle: (sourceId: string, selected: boolean) => void;
  onRequestCandidates: () => void;
  onGenerateArtwork: () => void;
  onContinueToAvatar: () => void;
  artworkBusy: boolean;
  canGenerateArtwork: boolean;
  onPublish: () => void | Promise<void>;
  onDraftChange: (draft: DesignerDraft) => void;
  onBackToImport: () => void;
  onBackToAnalysis: () => void;
  onBackToAvatar: () => void;
  onContinueToReview: () => void;
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
  if (mode === "new") {
    const footer = wizardPhase === "import" ? <div className="portfolio-drawer-actions">
      <Button variant="ghost" onClick={onClose}>{t(locale, "取消", "Cancel")}</Button>
      <Button type="button" variant="ai" icon="sparkles" onClick={onRequestCandidates}>{t(locale, "开始分析", "Start analysis")}</Button>
    </div> : wizardPhase === "analyse" && !analysisBusy ? <div className="portfolio-drawer-actions">
      <Button variant="ghost" onClick={onBackToImport}>{t(locale, "返回导入", "Back to import")}</Button>
      <Button variant="secondary" icon="rotate-ccw" onClick={onRequestCandidates}>{t(locale, "重新解析", "Reanalyse")}</Button>
      <Button variant="ai" icon="sparkles" disabled={!analysisDraft?.name.trim() || !canGenerateArtwork || artworkBusy} onClick={onContinueToAvatar}>{t(locale, "下一步：生成形象", "Next: generate artwork")}</Button>
    </div> : wizardPhase === "avatar" ? <div className="portfolio-drawer-actions">
      <Button variant="ghost" disabled={artworkBusy} onClick={onBackToAnalysis}>{t(locale, "返回分析", "Back to analysis")}</Button>
      <Button variant="secondary" icon="rotate-ccw" disabled={artworkBusy} onClick={onGenerateArtwork}>{t(locale, "重新生成", "Regenerate")}</Button>
      <Button variant="primary" icon="arrow-right" disabled={!artwork || artworkBusy} onClick={onContinueToReview}>{t(locale, "下一步：预览发布", "Next: preview and publish")}</Button>
    </div> : wizardPhase === "review" ? <div className="portfolio-drawer-actions">
      <Button variant="ghost" onClick={onBackToAvatar}>{t(locale, "返回形象", "Back to Avatar")}</Button>
      <Button variant="primary" icon="check" disabled={publishedInSession} onClick={() => void onPublish()}>{t(locale, "发布预览", "Publish preview")}</Button>
    </div> : undefined;
    return (
      <Drawer
        open
        title={t(locale, "导入作品集分析 · 生成 AI 设计师档案", "Portfolio analysis · Create AI designer profile")}
        className="ui-drawer--portfolio"
        contentScrollKey={wizardPhase}
        locale={locale}
        onClose={onClose}
        footer={footer}
      >
        <PortfolioCreationDrawer
          locale={locale}
          phase={wizardPhase}
          analysing={analysisBusy}
          artworkBusy={artworkBusy}
          analysisDraft={analysisDraft}
          analysisProfile={analysisProfile}
          artwork={artwork}
          selectionCount={selectionCount}
          publishedInSession={publishedInSession}
          rightsConfirmed={rightsConfirmed}
          portfolioInspection={portfolioInspection}
          selectedPortfolioSourceIds={selectedPortfolioSourceIds}
          portfolioInspecting={portfolioInspecting}
          error={error}
          onRightsConfirmed={onRightsConfirmed}
          onInspectPortfolioSources={onInspectPortfolioSources}
          onPortfolioUploadError={onPortfolioUploadError}
          onPortfolioSourceToggle={onPortfolioSourceToggle}
        />
      </Drawer>
    );
  }
  return (
    <Modal
      title={t(locale, "编辑设计师", "Edit designer")}
      locale={locale}
      onClose={onClose}
      wide
    >
      <form className="designer-editor" onSubmit={submit}>
          <div className="designer-form">
            {mode === "edit" && <>
            <p className="panel-label">
              {t(locale, "档案草稿", "Profile draft")}
            </p>
            <Field label={t(locale, "名称", "Name")}>
              <input required value={draft.name} onChange={setField("name")} />
            </Field>
            <Field label={t(locale, "署名", "Signature")}>
              <input value={draft.signature} onChange={setField("signature")} />
            </Field>
            <Field label={t(locale, "风格说明", "Style summary")}>
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
            </>}
          </div>
          <>
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
              <span className="draft-rule__label">{t(locale, "规则", "Rules")}</span>
              {draft.negativeRules ? (
                <Tooltip content={draft.negativeRules} className="designer-draft-rule__text">
                  {draft.negativeRules.replace(/\s*\n\s*/gu, " · ")}
                </Tooltip>
              ) : <span className="designer-draft-rule__empty">{t(locale, "尚未填写", "Not provided")}</span>}
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
          </>
        </form>
    </Modal>
  );
};

const AnalysisSection = ({
  id,
  icon,
  title,
  code,
  tone,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  code: string;
  tone?: "color" | "type" | "texture" | "danger";
  children: ReactNode;
}) => <section className={`portfolio-analysis-section${tone ? ` portfolio-analysis-section--${tone}` : ""}`} aria-labelledby={id}>
  <header className="portfolio-analysis-section__header">
    <span className="portfolio-analysis-section__icon"><Icon name={icon} size={15} /></span>
    <h3 id={id}>{title}</h3>
    <span className="portfolio-analysis-section__code">{code}</span>
  </header>
  {children}
</section>;

const AnalysisMetric = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => {
  const hasValue = value.trim() !== "" && Number.isFinite(Number(value));
  const numericValue = percentageFromDraft(value);
  return <div className="portfolio-analysis-metric">
    <span>{label}</span>
    <strong className="portfolio-analysis-metric__value">{hasValue ? `${numericValue}%` : "--"}</strong>
    <span
      className="portfolio-analysis-metric__track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(hasValue ? { "aria-valuenow": numericValue } : {})}
    ><i style={{ width: `${hasValue ? numericValue : 0}%` }} /></span>
  </div>;
};

const analysisValue = (locale: Locale, value: string): string =>
  value.trim() || t(locale, "未提取", "Not extracted");

const AnalysisValue = ({
  label,
  value,
  locale,
}: {
  label: string;
  value: string;
  locale: Locale;
}) => <div className="portfolio-analysis-value">
  <dt>{label}</dt>
  <dd>{analysisValue(locale, value)}</dd>
</div>;

const PortfolioAnalysisReport = ({
  locale,
  draft,
  selectionCount,
  error,
}: {
  locale: Locale;
  draft: DesignerDraft;
  selectionCount: number;
  error: string;
}) => {
  const palette = draft.palette.split(",").map((value) => value.trim()).filter(Boolean);
  const tags = draft.tags.split(",").map((value) => value.trim()).filter(Boolean);
  const negativeRules = draft.negativeRules.split("\n").map((value) => value.trim()).filter(Boolean);

  return <section
    className="portfolio-analysis-report"
    aria-label={t(locale, `${draft.name}的视觉 DNA 分析`, `${draft.name} visual DNA analysis`)}
  >
    <header className="portfolio-analysis-report__intro">
      <div className="portfolio-analysis-report__heading">
        <div>
          <p className="section-kicker">{t(locale, "特征解构", "Feature analysis")}</p>
          <h2>{analysisValue(locale, draft.name)}</h2>
        </div>
        <span>{t(locale, `${selectionCount} 项来源 · AI 推断`, `${selectionCount} sources · AI inferred`)}</span>
      </div>
      <p className="portfolio-analysis-report__summary">{analysisValue(locale, draft.summary)}</p>
      <dl className="portfolio-analysis-report__identity">
        <AnalysisValue locale={locale} label={t(locale, "署名", "Signature")} value={draft.signature} />
        <AnalysisValue locale={locale} label={t(locale, "创作原则", "Creative principle")} value={draft.principle} />
      </dl>
      <ul className="portfolio-analysis-tags" aria-label={t(locale, "风格标签", "Style tags")}>
        {tags.length > 0
          ? tags.map((tag) => <li key={tag}>{tag}</li>)
          : <li>{t(locale, "未提取", "Not extracted")}</li>}
      </ul>
    </header>

    <div className="portfolio-analysis-report__grid">
      <AnalysisSection id="analysis-color" icon="palette" title={t(locale, "色彩倾向与光影分布", "Colour and light distribution")} code="COLOR MATRIX" tone="color">
        <div className="portfolio-analysis-subheading">{t(locale, "主导色板", "Dominant palette")}</div>
        <ul className="portfolio-analysis-palette" aria-label={t(locale, "主导色板", "Dominant palette")}>
          {palette.length > 0
            ? palette.map((color, index) => <li key={`${color}-${index}`}>
              <i style={{ backgroundColor: color }} aria-hidden="true" />
              <span>{color}</span>
            </li>)
            : <li className="is-empty">{t(locale, "未提取色板", "Palette not extracted")}</li>}
        </ul>
        <div className="portfolio-analysis-metrics">
          <AnalysisMetric label={t(locale, "柔和低对比度", "Soft contrast")} value={draft.contrast} />
          <AnalysisMetric label={t(locale, "暗部透气率", "Shadow airiness")} value={draft.darkAiriness} />
        </div>
      </AnalysisSection>

      <AnalysisSection id="analysis-type-composition" icon="type" title={t(locale, "排版韵律与构图骨架", "Typography and composition")} code="TYPE / GRID" tone="type">
        <div className="portfolio-analysis-copy-group">
          <p>{analysisValue(locale, draft.typography)}</p>
          <p>{analysisValue(locale, draft.composition)}</p>
        </div>
        <dl className="portfolio-analysis-values">
          <AnalysisValue locale={locale} label={t(locale, "字体倾向", "Type tendency")} value={draft.typeFamily} />
          <AnalysisValue locale={locale} label={t(locale, "字重偏好", "Weight preference")} value={draft.typeWeight} />
          <AnalysisValue locale={locale} label={t(locale, "字距节奏", "Tracking rhythm")} value={draft.tracking} />
          <AnalysisValue locale={locale} label={t(locale, "构图拓扑", "Composition topology")} value={draft.compositionTopology} />
        </dl>
        <AnalysisMetric label={t(locale, "留白占比", "Whitespace ratio")} value={draft.whitespace} />
      </AnalysisSection>

      <AnalysisSection id="analysis-texture" icon="layers" title={t(locale, "材质肌理与感知参数", "Texture and material perception")} code="TEXTURE / MAT" tone="texture">
        <div className="portfolio-analysis-copy-group">
          <p>{analysisValue(locale, draft.texture)}</p>
        </div>
        <div className="portfolio-analysis-metrics">
          <AnalysisMetric label={t(locale, "纹理颗粒度", "Grain")} value={draft.grain} />
          <AnalysisMetric label={t(locale, "光影漫反射率", "Diffuse light")} value={draft.diffuseLight} />
        </div>
        <dl className="portfolio-analysis-values">
          <AnalysisValue locale={locale} label={t(locale, "着色与材质描述", "Rendering and material")} value={draft.rendering} />
        </dl>
      </AnalysisSection>
    </div>

    <AnalysisSection id="analysis-negative" icon="circle-alert" title={t(locale, "否定规则", "Negative constraints")} code={`${negativeRules.length} RULES`} tone="danger">
      {negativeRules.length > 0
        ? <ul className="portfolio-analysis-rules" aria-label={t(locale, "生效规则", "Active rules")}>
          {negativeRules.map((rule) => <li key={rule}>
            <Icon name="circle-alert" size={13} />
            <Tooltip content={rule} className="portfolio-analysis-rule__text">{rule}</Tooltip>
          </li>)}
        </ul>
        : <p className="portfolio-analysis-empty">{t(locale, "未提取否定规则", "Negative constraints not extracted")}</p>}
    </AnalysisSection>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
};

const PortfolioCreationDrawer = ({
  locale, phase, analysing, artworkBusy, analysisDraft, analysisProfile, artwork, selectionCount, publishedInSession,
  rightsConfirmed, portfolioInspection, selectedPortfolioSourceIds,
  portfolioInspecting, error, onRightsConfirmed,
  onInspectPortfolioSources, onPortfolioUploadError, onPortfolioSourceToggle,
}: {
  locale: Locale;
  phase: PortfolioWizardPhase;
  analysing: boolean;
  artworkBusy: boolean;
  analysisDraft?: DesignerDraft;
  analysisProfile?: PersonaProfile;
  artwork?: ArtworkOption;
  selectionCount: number;
  publishedInSession: boolean;
  rightsConfirmed: boolean;
  portfolioInspection: PortfolioInspection | null;
  selectedPortfolioSourceIds: string[];
  portfolioInspecting: boolean;
  error: string;
  onRightsConfirmed: (value: boolean) => void;
  onInspectPortfolioSources: (request: PortfolioInspectionRequest) => Promise<void>;
  onPortfolioUploadError: (message: string) => void;
  onPortfolioSourceToggle: (sourceId: string, selected: boolean) => void;
}) => {
  const activeStep = phase === "import" ? 0 : phase === "analyse" ? 1 : phase === "avatar" ? 2 : 3;
  const reviewProfile = analysisDraft && analysisProfile && artwork ? {
    ...profileFromDraft(analysisDraft, analysisProfile, locale),
    artworkAssetId: artwork.assetId,
    artworkUrl: artwork.artworkUrl,
  } : undefined;
  return <section className="portfolio-drawer">
    <ol className="portfolio-steps" aria-label={t(locale, "生成流程", "Creation steps")}>
      {[t(locale, "导入作品", "Import"), t(locale, "特征解构", "Analyse"), t(locale, "角色拟合", "Fit"), t(locale, "审阅发布", "Review")].map((label, index) => (
        <li key={label} className={index === activeStep ? "is-active" : index < activeStep ? "is-complete" : ""}>
          <span>{index + 1}</span>{label}
        </li>
      ))}
    </ol>
    {phase === "import" ? (
      <div className="portfolio-import">
        <p className="section-kicker">{t(locale, "作品集来源", "Portfolio sources")}</p>
        <h3>{t(locale, "选择用于提炼风格的作品", "Choose work to extract style")}</h3>
        <PortfolioUploader locale={locale} busy={portfolioInspecting} onInspect={onInspectPortfolioSources} onError={onPortfolioUploadError} />
        {portfolioInspection && <div className="designer-portfolio-candidates" role="group" aria-label={t(locale, "作品集候选", "Portfolio candidates")}>
          {portfolioInspection.candidates.map((candidate) => <label key={candidate.id} className="designer-portfolio-candidate">
            <input type="checkbox" aria-label={candidate.label} checked={selectedPortfolioSourceIds.includes(candidate.id)} onChange={(event) => onPortfolioSourceToggle(candidate.id, event.target.checked)} />
            {candidate.previewUrl && <img src={candidate.previewUrl} alt="" />}
            <span className="designer-portfolio-candidate__name" title={candidate.label}>{candidate.label}</span>
          </label>)}
        </div>}
        <label className="check-row"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => onRightsConfirmed(event.target.checked)} />{t(locale, "我确认拥有分析这些来源的权利", "I confirm I have rights to analyse these sources")}</label>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    ) : (analysing || (phase === "analyse" && !analysisDraft)) ? <PortfolioAnalysisLoading locale={locale} /> : phase === "analyse" && analysisDraft && analysisProfile ? <PortfolioAnalysisReport
      locale={locale}
      draft={analysisDraft}
      selectionCount={selectionCount}
      error={error}
    /> : phase === "avatar" ? artworkBusy ? <PortfolioArtworkLoading locale={locale} /> : <section className="candidate-review"><p className="section-kicker">{t(locale, "形象生成", "Artwork generation")}</p><h2>{t(locale, "设计师形象", "Designer Avatar")}</h2>{artwork && <figure className="portfolio-avatar-preview"><img src={artwork.artworkUrl} alt={t(locale, "生成的设计师 Avatar", "Generated designer Avatar")} /></figure>}{error && <p className="form-error" role="alert">{error}</p>}</section> : <section className="portfolio-review">
      <p className="section-kicker">{t(locale, "预览发布", "Preview and publish")}</p>
      {reviewProfile && <DesignerProfileCard locale={locale} profile={reviewProfile} mode="review" />}
      {publishedInSession && <p className="panel-note portfolio-review__published"><Icon name="check" size={15} />{t(locale, "已发布。", "Published.")}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>}
  </section>;
};

const PortfolioAnalysisLoading = ({ locale }: { locale: Locale }) => (
  <section className="portfolio-analysis-loading" aria-live="polite">
    <p className="section-kicker">{t(locale, "视觉 DNA 提取", "Visual DNA extraction")}</p>
    <h3>{t(locale, "正在提炼视觉 DNA", "Extracting visual DNA")}</h3>
    <p>{t(locale, "正在分析色彩、排版、材质与构图特征。", "Analysing colour, typography, texture and composition.")}</p>
    <div className="portfolio-analysis-progress"><span /><small>{t(locale, "特征解构中", "Deconstructing features")}</small></div>
    <div className="portfolio-analysis-skeleton" data-testid="portfolio-analysis-skeleton" aria-hidden="true">
      <i /><i /><i /><i /><i /><i />
    </div>
  </section>
);

const PortfolioArtworkLoading = ({ locale }: { locale: Locale }) => (
  <section className="portfolio-artwork-loading" aria-live="polite">
    <p className="section-kicker">{t(locale, "角色拟合", "Character fitting")}</p>
    <h2>{t(locale, "正在生成设计师形象", "Generating designer artwork")}</h2>
    <p>{t(locale, "正在根据视觉 DNA 生成设计师形象。", "Generating a designer Avatar from the visual DNA.")}</p>
    <div className="portfolio-analysis-progress"><span /><small>{t(locale, "形象生成中", "Generating artwork")}</small></div>
    <div className="portfolio-artwork-skeleton" data-testid="portfolio-artwork-skeleton" aria-hidden="true">
      <i />
    </div>
  </section>
);
