import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { BrandEditor } from './BrandEditor';
import type { Brand } from './constraints';

const brand: Brand = {
  id: 'spring',
  version: 'v1',
  logo: 'spring-mark',
  colorPalette: ['black'],
  fonts: ['Geist'],
  tone: 'Relaxed',
  fixedCopy: 'Bring spring home',
  sizes: ['1080x1440'],
};

it('renders all editor controls with Chinese and English locale labels', () => {
  const { rerender } = render(<BrandEditor brand={brand} locale="zh-CN" onSave={vi.fn()} />);
  expect(screen.getByRole('form', { name: '品牌编辑' })).toBeInTheDocument();
  ['标志', '色板', '字体', '语气', '固定文案', '尺寸'].forEach((label) => expect(screen.getByLabelText(label)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();

  rerender(<BrandEditor brand={brand} locale="en" onSave={vi.fn()} />);
  expect(screen.getByRole('form', { name: 'Brand editor' })).toBeInTheDocument();
  ['Logo', 'Color palette', 'Fonts', 'Tone', 'Fixed copy', 'Sizes'].forEach((label) => expect(screen.getByLabelText(label)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});

it('synchronizes its draft when the selected brand changes before saving', () => {
  const onSave = vi.fn();
  const { rerender } = render(<BrandEditor brand={brand} locale="en" onSave={onSave} />);
  fireEvent.change(screen.getByLabelText('Tone'), { target: { value: 'Edited old brand' } });
  const next = { ...brand, id: 'objects', logo: 'object-mark', tone: 'Calm' };
  rerender(<BrandEditor brand={next} locale="en" onSave={onSave} />);
  fireEvent.submit(screen.getByRole('form', { name: 'Brand editor' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'objects', logo: 'object-mark', tone: 'Calm' }));
});

it('keeps comma-delimited list text editable until it is saved', () => {
  const onSave = vi.fn();
  render(<BrandEditor brand={brand} locale="en" onSave={onSave} />);
  const palette = screen.getByLabelText('Color palette') as HTMLInputElement;
  fireEvent.change(palette, { target: { value: 'red,' } });
  expect(palette.value).toBe('red,');
  fireEvent.change(palette, { target: { value: 'red, blue' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Brand editor' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ colorPalette: ['red', 'blue'] }));
});
