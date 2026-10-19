import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { AppEntry, getPreviewMode } from '../AppEntry';
import {
  NeuralPresence,
  NeuralPresencePreview,
  createNeuralField,
  getMembraneRotation,
  getNeuralBreathScale,
  getNeuralLayerMotion,
  getThinkingConnections,
} from './AgentConstellationPreview';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), quadraticCurveTo: vi.fn(), save: vi.fn(), arc: vi.fn(), fill: vi.fn(), restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => { vi.restoreAllMocks(); });

it('selects the neural presence preview from the renderer query string', () => {
  expect(getPreviewMode('?preview=neural-presence')).toBe('neural-presence');
  expect(getPreviewMode('?preview=unknown')).toBeNull();

  render(<AppEntry search="?preview=neural-presence" />);
  expect(screen.getByRole('main', { name: '神经簇智体动效预览' })).toBeVisible();
});

it('presents a single idle neural entity without topology labels', () => {
  render(<NeuralPresence mode="idle" />);

  expect(screen.getByRole('img', { name: '待命中的神经簇智体' })).toBeVisible();
  expect(screen.getByText('待命中')).toBeVisible();
  expect(screen.queryByText('协调智体')).toBeNull();
  expect(screen.queryByText('理解上下文')).toBeNull();
});

it('embeds a compact neural presence without visible history chrome', () => {
  render(<NeuralPresence mode="idle" compact />);

  expect(screen.getByRole('img', { name: '待命中的神经簇智体' })).toBeVisible();
  expect(screen.queryByText('待命中')).not.toBeInTheDocument();
  expect(screen.queryByTestId('neural-presence-history-count')).not.toBeInTheDocument();
  expect(screen.queryByTestId('neural-presence-history-ticks')).not.toBeInTheDocument();
  expect(screen.getByTestId('neural-presence')).toHaveAttribute('data-compact', 'true');
});

it('changes size over time with a restrained breathing range', () => {
  const first = getNeuralBreathScale(0);
  const later = getNeuralBreathScale(1_200);

  expect(later).not.toBe(first);
  expect(Math.min(first, later)).toBeGreaterThanOrEqual(0.93);
  expect(Math.max(first, later)).toBeLessThanOrEqual(1.07);
});

it('builds a circular core inside layered membranes without exterior feelers', () => {
  const field = createNeuralField();
  const coreRadii = field.coreBoundary.map((point) => point.radius);

  expect(Math.max(...coreRadii) / Math.min(...coreRadii)).toBeLessThan(1.16);
  expect(field.membranes).toHaveLength(3);
  expect(field.membranes.every((membrane) => membrane.length >= 24)).toBe(true);
  expect(field.energySeeds.length).toBeGreaterThanOrEqual(7);
  expect(field.energySeeds.every((seed) => seed.radius < .27)).toBe(true);
  expect('fringe' in field).toBe(false);
  expect('rays' in field).toBe(false);
});

it('gives each neural layer a distinct continuous irregular motion', () => {
  const layers = ['core', 'membrane', 'energy'] as const;
  const samples = layers.map((layer, index) => getNeuralLayerMotion(layer, index + 3, 2_800, 'idle'));
  const nextFrames = layers.map((layer, index) => getNeuralLayerMotion(layer, index + 3, 2_816, 'idle'));

  expect(new Set(samples.map((sample) => sample.angle.toFixed(4))).size).toBe(3);
  expect(new Set(samples.map((sample) => sample.radius.toFixed(4))).size).toBe(3);
  samples.forEach((sample, index) => {
    expect(nextFrames[index]).not.toEqual(sample);
    expect(Math.abs(nextFrames[index].angle - sample.angle)).toBeLessThan(.02);
    expect(Math.abs(nextFrames[index].radius - sample.radius)).toBeLessThan(.04);
  });
});

it('cycles through bounded random point connections while thinking', () => {
  const first = getThinkingConnections(900);
  const later = getThinkingConnections(2_600);
  const samples = [900, 1_600, 2_600, 3_500].flatMap(getThinkingConnections);
  const firstPairs = first.map((connection) => connection.id).sort();
  const laterPairs = later.map((connection) => connection.id).sort();

  expect(first.length).toBeGreaterThanOrEqual(4);
  expect(laterPairs).not.toEqual(firstPairs);
  expect(new Set(samples.map((connection) => connection.path))).toEqual(new Set(['polyline']));
  expect(new Set(samples.map((connection) => connection.bendOffsets.length)).size).toBeGreaterThan(1);
  expect(samples.some((connection) => connection.startProgress > 0 && connection.endProgress < 1)).toBe(true);
  samples.forEach((connection) => {
    expect(connection.toLayer).not.toBe(connection.fromLayer);
    expect(connection.bendOffsets.length).toBeGreaterThanOrEqual(2);
    expect(connection.bendOffsets.length).toBeLessThanOrEqual(4);
    expect(connection.startProgress).toBeGreaterThanOrEqual(0);
    expect(connection.endProgress).toBeLessThanOrEqual(1);
    expect(connection.endProgress).toBeGreaterThan(connection.startProgress);
    expect(connection.opacity).toBeGreaterThan(0);
    expect(connection.opacity).toBeLessThanOrEqual(1);
  });
});

it('rotates membrane layers continuously in alternating directions and speeds', () => {
  const start = [0, 1, 2].map((layer) => getMembraneRotation(layer, 0, 'idle'));
  const later = [0, 1, 2].map((layer) => getMembraneRotation(layer, 10_000, 'idle'));
  const nextFrame = [0, 1, 2].map((layer) => getMembraneRotation(layer, 10_016, 'idle'));
  const deltas = later.map((angle, layer) => angle - start[layer]);

  expect(deltas[0]).toBeGreaterThan(0);
  expect(deltas[1]).toBeLessThan(0);
  expect(deltas[2]).toBeGreaterThan(0);
  expect(Math.abs(deltas[0])).toBeGreaterThan(Math.abs(deltas[1]));
  expect(Math.abs(deltas[1])).toBeGreaterThan(Math.abs(deltas[2]));
  later.forEach((angle, layer) => {
    expect(Math.abs(nextFrame[layer] - angle)).toBeLessThan(.002);
  });
});

it('accelerates membrane rotation while thinking', () => {
  const idleRotation = Math.abs(getMembraneRotation(0, 8_000, 'idle'));
  const thinkingRotation = Math.abs(getMembraneRotation(0, 8_000, 'thinking'));

  expect(thinkingRotation).toBeGreaterThan(idleRotation * 1.8);
});

it('triggers sensing and switches the standalone preview theme', () => {
  render(<NeuralPresencePreview />);

  const preview = screen.getByRole('main', { name: '神经簇智体动效预览' });
  expect(preview).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByText('待命中')).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: '触发感知' }));
  expect(screen.getByText('感知中')).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: '切换至浅色模式' }));
  expect(preview).toHaveAttribute('data-theme', 'light');
  expect(screen.getByRole('button', { name: '切换至深色模式' })).toBeVisible();
});

it('toggles a persistent thinking state in the standalone preview', () => {
  render(<NeuralPresencePreview />);

  fireEvent.click(screen.getByRole('button', { name: '开始思考' }));
  expect(screen.getByText('思考中')).toBeVisible();
  expect(screen.getAllByText('PROCESSING')[0]).toBeVisible();
  expect(screen.getByRole('button', { name: '停止思考' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: '停止思考' }));
  expect(screen.getByText('待命中')).toBeVisible();
});
