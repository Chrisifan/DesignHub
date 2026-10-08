import { describe, expect, it } from 'vitest';
import {
  buildGenerationVisualManifest,
  buildVisualContextAnalysisInstruction,
  deriveConservativeVisualContextPlan,
  extractAnalysisBrief,
  imageContextLabel,
  isVisualContextPlan,
  mergeVisualContextPlan,
  orderedVisualContextItems,
  parseVisualContextEnvelope,
  type VisualContextPlan,
} from './visual-context';

const plan: VisualContextPlan = {
  version: 1,
  items: [
    { assetId: 'asset-original', roles: ['visual-anchor'], confidence: 0.96 },
    { assetId: 'asset-draft', roles: ['edit-target'], confidence: 0.98 },
  ],
  clarificationRequired: false,
};

describe('visual context envelope', () => {
  it('requires one strict response envelope with explicit release evidence', () => {
    const instruction = buildVisualContextAnalysisInstruction({
      knownAssetIds: ['asset-original', 'asset-draft'],
      previousPlan: {
        version: 1,
        items: [{ assetId: 'asset-original', roles: ['visual-anchor'], confidence: 1 }],
        clarificationRequired: false,
      },
    });

    expect(instruction).toContain('releasedAssetIds');
    expect(instruction).toContain('asset-original');
    expect(instruction).toContain('Return JSON only');
    expect(instruction).toContain('Ask one clarification question');
  });

  it('parses a strict structured conversation response', () => {
    expect(parseVisualContextEnvelope(JSON.stringify({
      brief: '保留原图袖口，修改当前稿背景。',
      visualContext: plan,
      releasedAssetIds: [],
    }))).toEqual({
      brief: '保留原图袖口，修改当前稿背景。',
      visualContextPlan: plan,
      releasedAssetIds: [],
    });
  });

  it('normalizes omitted confidence in a provider response', () => {
    expect(parseVisualContextEnvelope(JSON.stringify({
      brief: '以图一为编辑目标，并参考图二。',
      visualContext: {
        version: 1,
        items: [
          { assetId: 'asset-target', roles: ['edit-target', 'visual-reference'] },
          { assetId: 'asset-reference', roles: ['visual-reference'] },
        ],
        clarificationRequired: false,
      },
      releasedAssetIds: [],
    }))).toMatchObject({
      visualContextPlan: {
        items: [
          { assetId: 'asset-target', confidence: 0 },
          { assetId: 'asset-reference', confidence: 0 },
        ],
      },
    });
  });

  it('normalizes singular role and releasedAssets provider variants', () => {
    expect(parseVisualContextEnvelope(JSON.stringify({
      brief: '抠出人物并输出透明背景。',
      visualContext: {
        version: 1,
        items: [
          { assetId: 'asset-person', role: 'edit-target', confidence: 0.99 },
          { assetId: 'asset-person', role: 'visual-reference', confidence: 0.99 },
        ],
        clarificationRequired: false,
      },
      releasedAssets: [],
    }))).toEqual({
      brief: '抠出人物并输出透明背景。',
      visualContextPlan: {
        version: 1,
        items: [{ assetId: 'asset-person', roles: ['edit-target', 'visual-reference'], confidence: 0.99 }],
        clarificationRequired: false,
      },
      releasedAssetIds: [],
    });
  });

  it('rejects an explicitly invalid confidence even when normalization is available', () => {
    expect(parseVisualContextEnvelope(JSON.stringify({
      brief: '无效置信度',
      visualContext: {
        version: 1,
        items: [{ assetId: 'asset-target', roles: ['edit-target'], confidence: 2 }],
        clarificationRequired: false,
      },
      releasedAssetIds: [],
    }))).toBeNull();
  });

  it('extracts the brief even when the visual context plan is invalid', () => {
    const text = JSON.stringify({
      brief: '将人物抠图置于真实、绚丽的极光夜空前。',
      visualContext: {
        version: 1,
        items: [
          { assetId: 'asset-a', roles: ['edit-target'], confidence: 0.9 },
          { assetId: 'asset-b', roles: ['edit-target'], confidence: 1 },
        ],
        clarificationRequired: false,
      },
      releasedAssets: [],
    });

    expect(parseVisualContextEnvelope(text)).toBeNull();
    expect(extractAnalysisBrief(text)).toBe('将人物抠图置于真实、绚丽的极光夜空前。');
  });

  it('rejects duplicate assets, duplicate roles, unknown roles, and invalid confidence', () => {
    expect(isVisualContextPlan({ ...plan, items: [...plan.items, plan.items[0]] })).toBe(false);
    expect(isVisualContextPlan({ ...plan, items: [{ assetId: 'a', roles: ['visual-anchor', 'visual-anchor'], confidence: 1 }] })).toBe(false);
    expect(isVisualContextPlan({ ...plan, items: [{ assetId: 'a', roles: ['other'], confidence: 1 }] })).toBe(false);
    expect(isVisualContextPlan({ ...plan, items: [{ assetId: 'a', roles: ['visual-anchor'], confidence: 2 }] })).toBe(false);
    expect(isVisualContextPlan({
      ...plan,
      items: [
        { assetId: 'a', roles: ['edit-target'], confidence: 1 },
        { assetId: 'b', roles: ['edit-target'], confidence: 1 },
      ],
    })).toBe(false);
  });

  it('returns null for plain text or a malformed envelope', () => {
    expect(parseVisualContextEnvelope('普通分析文本')).toBeNull();
    expect(parseVisualContextEnvelope('{"brief":"x"}')).toBeNull();
  });
});

describe('visual context continuity', () => {
  it('retains a prior anchor unless release evidence names it', () => {
    const previous: VisualContextPlan = {
      version: 1,
      items: [{ assetId: 'asset-original', roles: ['visual-anchor'], confidence: 0.9 }],
      clarificationRequired: false,
    };
    const proposed: VisualContextPlan = {
      version: 1,
      items: [{ assetId: 'asset-draft', roles: ['edit-target'], confidence: 0.9 }],
      clarificationRequired: false,
    };

    expect(mergeVisualContextPlan({
      previous,
      proposed,
      releasedAssetIds: [],
      requiredAssetIds: ['asset-draft'],
      knownAssetIds: ['asset-original', 'asset-draft'],
    }).items).toEqual([
      { assetId: 'asset-draft', roles: ['edit-target'], confidence: 0.9 },
      { assetId: 'asset-original', roles: ['visual-anchor'], confidence: 0.9 },
    ]);
    expect(mergeVisualContextPlan({
      previous,
      proposed,
      releasedAssetIds: ['asset-original'],
      requiredAssetIds: ['asset-draft'],
      knownAssetIds: ['asset-original', 'asset-draft'],
    }).items).toEqual([{ assetId: 'asset-draft', roles: ['edit-target'], confidence: 0.9 }]);
  });

  it('does not release an anchor that was not present in the previous plan', () => {
    expect(mergeVisualContextPlan({
      previous: plan,
      proposed: plan,
      releasedAssetIds: ['asset-unknown'],
      requiredAssetIds: [],
      knownAssetIds: ['asset-original', 'asset-draft', 'asset-unknown'],
    })).toEqual(plan);
  });

  it('retains an old edit target only as an anchor when a new target is selected', () => {
    expect(mergeVisualContextPlan({
      previous: {
        version: 1,
        items: [{ assetId: 'asset-original', roles: ['edit-target', 'visual-anchor'], confidence: 1 }],
        clarificationRequired: false,
      },
      proposed: {
        version: 1,
        items: [{ assetId: 'asset-draft', roles: ['edit-target'], confidence: 1 }],
        clarificationRequired: false,
      },
      releasedAssetIds: [],
      requiredAssetIds: ['asset-draft'],
      knownAssetIds: ['asset-original', 'asset-draft'],
    }).items).toEqual([
      { assetId: 'asset-draft', roles: ['edit-target'], confidence: 1 },
      { assetId: 'asset-original', roles: ['visual-anchor'], confidence: 1 },
    ]);
  });

  it('derives a conservative ambiguous plan without inventing an edit target', () => {
    expect(deriveConservativeVisualContextPlan({
      previous: undefined,
      initialAttachmentAssetIds: ['asset-a', 'asset-b'],
      currentAssetIds: [],
      canvasAssetIds: [],
    })).toEqual({
      version: 1,
      items: [
        { assetId: 'asset-a', roles: ['visual-anchor', 'visual-reference'], confidence: 0 },
        { assetId: 'asset-b', roles: ['visual-anchor', 'visual-reference'], confidence: 0 },
      ],
      clarificationRequired: true,
    });
  });

  it('allows a text-only generation request without inventing an edit target', () => {
    expect(deriveConservativeVisualContextPlan({
      previous: undefined,
      initialAttachmentAssetIds: [],
      currentAssetIds: [],
      canvasAssetIds: [],
    })).toEqual({ version: 1, items: [], clarificationRequired: false });
  });

  it('uses a single current image as the edit target while retaining original anchors', () => {
    expect(deriveConservativeVisualContextPlan({
      previous: {
        version: 1,
        items: [{ assetId: 'asset-original', roles: ['edit-target', 'visual-anchor'], confidence: 1 }],
        clarificationRequired: false,
      },
      initialAttachmentAssetIds: ['asset-original'],
      currentAssetIds: ['asset-draft'],
      canvasAssetIds: [],
    })).toEqual({
      version: 1,
      items: [
        { assetId: 'asset-original', roles: ['visual-anchor', 'visual-reference'], confidence: 1 },
        { assetId: 'asset-draft', roles: ['edit-target'], confidence: 0 },
      ],
      clarificationRequired: false,
    });
  });

  it('keeps every current candidate and clears a stale edit target when the choice is ambiguous', () => {
    expect(deriveConservativeVisualContextPlan({
      previous: {
        version: 1,
        items: [{ assetId: 'asset-canvas', roles: ['edit-target', 'visual-anchor'], confidence: 1 }],
        clarificationRequired: false,
      },
      initialAttachmentAssetIds: [],
      currentAssetIds: ['asset-a', 'asset-b'],
      canvasAssetIds: ['asset-canvas'],
    })).toEqual({
      version: 1,
      items: [
        { assetId: 'asset-canvas', roles: ['visual-anchor'], confidence: 1 },
        { assetId: 'asset-a', roles: ['visual-reference'], confidence: 0 },
        { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0 },
      ],
      clarificationRequired: true,
    });
  });
});

describe('visual context presentation', () => {
  it('orders one uploaded image once by its highest-priority role', () => {
    const items = orderedVisualContextItems({
      version: 1,
      items: [
        { assetId: 'style', roles: ['visual-reference'], confidence: 1 },
        { assetId: 'target', roles: ['edit-target', 'visual-anchor'], confidence: 1 },
        { assetId: 'source', roles: ['content-source'], confidence: 1 },
      ],
      clarificationRequired: false,
    });

    expect(items.map((item) => item.assetId)).toEqual(['target', 'source', 'style']);
    expect(imageContextLabel(items[0]!, 'generated')).toContain('assetId=target');
    expect(buildGenerationVisualManifest(items)).toContain('Image 1: assetId=target; roles=edit-target,visual-anchor');
  });
});
