import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';

import { personaProfiles } from '../../../tests/fixtures/personas';
import { DesignerDossier, DesignerProfileCard } from './DesignerProfileCard';
import { localize, type LocalizedText, type PersonaProfile } from './personas';

const profile: PersonaProfile = {
  ...personaProfiles[0]!,
  styleDna: {
    ...personaProfiles[0]!.styleDna,
    signals: {
      contrast: 68,
      darkAiriness: 82,
      whitespace: 38,
      grain: 15,
      diffuseLight: 92,
      typeFamily: { zh: '宋体倾向', en: 'Serif tendency' },
      typeWeight: { zh: '半粗体', en: 'Semibold' },
      tracking: { zh: '紧凑', en: 'Compact' },
      compositionTopology: { zh: '非对称垂直流', en: 'Asymmetric vertical flow' },
      rendering: { zh: '纸张漫反射', en: 'Paper diffusion' },
    },
  },
};

const extraTags: LocalizedText[] = [
  { zh: '标签一', en: 'Tag one' },
  { zh: '标签二', en: 'Tag two' },
  { zh: '标签三', en: 'Tag three' },
  { zh: '标签四', en: 'Tag four' },
];

it('renders the full review dossier from profile data', () => {
  render(<DesignerProfileCard locale="zh-CN" profile={profile} mode="review" />);

  const dossier = screen.getByRole('region', { name: '纸感排版设计师档案' });
  expect(within(dossier).getByRole('img', { name: /纸感排版/ })).toBeInTheDocument();
  expect(within(dossier).getByRole('heading', { name: '纸感排版' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: '核心指标' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: 'Style DNA' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: '否定规则' })).toBeInTheDocument();
  expect(within(dossier).getByRole('progressbar', { name: '留白占比' })).toHaveAttribute('aria-valuenow', '38');
  expect(within(dossier).getByText('#F4EFE7')).toBeInTheDocument();
});

it('exposes the full dossier independently of its review facade', () => {
  const { rerender } = render(<DesignerDossier locale="zh-CN" profile={profile} />);
  const directOrder = [...screen.getByRole('region', { name: '纸感排版设计师档案' }).children]
    .map((element) => element.className);

  rerender(<DesignerProfileCard locale="zh-CN" profile={profile} mode="review" />);
  const reviewOrder = [...screen.getByRole('region', { name: '纸感排版设计师档案' }).children]
    .map((element) => element.className);

  expect(reviewOrder).toEqual(directOrder);
  expect(directOrder).toEqual([
    'designer-profile-card__review-head',
    'designer-profile-card__signals',
    'designer-profile-card__dna',
    'designer-profile-card__rules',
  ]);
});

it('shows a localized empty state when the dossier has no negative rules', () => {
  render(<DesignerDossier locale="zh-CN" profile={{ ...profile, negativeRules: [] }} />);
  expect(screen.getByRole('region', { name: '否定规则' })).toHaveTextContent('未提取否定规则');
});

it('keeps dossier rules on one line and exposes full text with the shared tooltip', () => {
  const rule = '避免使用会破坏安全边距、信息层级与主体识别度的复杂背景纹理';
  render(<DesignerDossier locale="zh-CN" profile={{
    ...profile,
    negativeRules: [{ zh: rule, en: 'Avoid complex backgrounds that harm hierarchy' }],
  }} />);

  const trigger = screen.getByText(rule);
  expect(trigger).toHaveClass('designer-profile-rule__text');
  expect(trigger).not.toHaveAttribute('title');
  fireEvent.mouseEnter(trigger);
  expect(screen.getByRole('tooltip')).toHaveTextContent(rule);
});

it('renders missing signals without fabricating percentages', () => {
  render(
    <DesignerProfileCard
      locale="en"
      profile={{ ...profile, styleDna: { ...profile.styleDna, signals: undefined } }}
      mode="review"
    />,
  );

  expect(screen.getAllByText('--')).toHaveLength(5);
  expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
  expect(screen.getAllByRole('progressbar').every((metric) => !metric.hasAttribute('aria-valuenow'))).toBe(true);
});

it('limits compact tags and reports the hidden count', () => {
  render(
    <DesignerProfileCard
      locale="en"
      profile={{ ...profile, tags: extraTags }}
      mode="library"
      isDefault
    />,
  );

  expect(screen.getByText('Default')).toBeInTheDocument();
  expect(screen.getByText('+2')).toBeInTheDocument();
  expect(screen.queryByText(localize('en', extraTags[2]!))).not.toBeInTheDocument();
});

it('replaces a failed managed Avatar with an accessible fallback', () => {
  render(
    <DesignerProfileCard
      locale="en"
      profile={{ ...profile, artworkUrl: 'designhub-artwork://missing' }}
      mode="review"
    />,
  );

  fireEvent.error(screen.getByRole('img', { name: /Paper & Type/ }));
  expect(screen.getByRole('img', { name: 'Designer Avatar unavailable' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Paper & Type/ })).not.toBeInTheDocument();
});

it('keeps library mode compact', () => {
  render(<DesignerProfileCard locale="en" profile={profile} mode="library" />);

  expect(screen.getByText('Whitespace')).toBeInTheDocument();
  expect(screen.getByText('Diffuse light')).toBeInTheDocument();
  expect(screen.queryByText(localize('en', profile.styleDna.typography))).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Negative rules' })).not.toBeInTheDocument();
});
