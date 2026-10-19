import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react';

import '../styles/tokens.css';
import './agent-constellation-preview.css';

export type PresenceMode = 'idle' | 'sensing' | 'thinking' | 'working' | 'success' | 'failure';
export type TerminalPresenceMode = 'success' | 'failure';
export type TerminalFeedbackProfile = { intensity: number; distortion: number; tint: number };
type NeuralTone = 0 | 1 | 2 | 3 | 4;
type MotionLayer = 'core' | 'energy' | 'membrane';

type NeuralLayerMotion = {
  angle: number;
  radius: number;
  x: number;
  y: number;
};

type FieldPoint = {
  angle: number;
  radius: number;
  phase: number;
  speed: number;
  drift: number;
  size: number;
  tone: NeuralTone;
};

type NeuralField = {
  coreBoundary: FieldPoint[];
  membranes: FieldPoint[][];
  energySeeds: FieldPoint[];
};

type ThinkingConnection = {
  id: string;
  path: 'polyline';
  bendOffsets: number[];
  fromLayer: number;
  fromIndex: number;
  toLayer: number;
  toIndex: number;
  startProgress: number;
  endProgress: number;
  opacity: number;
  tone: NeuralTone;
};

type RenderPoint = FieldPoint & { px: number; py: number };

const createRandom = (seed: number): (() => number) => () => {
  seed |= 0;
  seed = seed + 0x6d2b79f5 | 0;
  let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
  value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
};

const createLoop = (
  count: number,
  baseRadius: number,
  irregularity: number,
  random: () => number,
  phaseOffset = 0,
): FieldPoint[] => Array.from({ length: count }, (_, index) => {
  const angle = index / count * Math.PI * 2;
  const harmonic = Math.sin(angle * 3 + phaseOffset) * irregularity * .45
    + Math.sin(angle * 7 - phaseOffset * .7) * irregularity * .24;
  return {
    angle,
    radius: baseRadius * (1 + harmonic + (random() - .5) * irregularity * .44),
    phase: random() * Math.PI * 2,
    speed: .32 + random() * .48,
    drift: 1.2 + random() * 3.8,
    size: 1 + random() * 1.8,
    tone: index % 13 === 0 ? 3 : index % 8 === 0 ? 2 : index % 5 === 0 ? 1 : 0,
  };
});

export const createNeuralField = (): NeuralField => {
  const random = createRandom(0xdecafbad);
  const coreBoundary = createLoop(40, .27, .055, random, .8);
  const membranes = [
    createLoop(28, .43, .09, random, .2),
    createLoop(36, .64, .15, random, 1.4),
    createLoop(44, .86, .22, random, 2.2),
  ];
  const energySeeds = Array.from({ length: 12 }, (_, index): FieldPoint => ({
    angle: random() * Math.PI * 2,
    radius: .055 + random() * .2,
    phase: random() * Math.PI * 2,
    speed: .62 + random() * 1.1,
    drift: 1.5 + random() * 3.5,
    size: 2 + random() * 3.2,
    tone: index % 3 === 0 ? 4 : index % 4 === 0 ? 3 : index % 5 === 0 ? 2 : 0,
  }));
  return { coreBoundary, membranes, energySeeds };
};

const neuralField = createNeuralField();

export const getThinkingConnections = (elapsedMs: number): ThinkingConnection[] => {
  const epochDuration = 1_200;
  const currentEpoch = Math.floor(elapsedMs / epochDuration);
  const membraneSizes = [28, 36, 44];
  const connections: ThinkingConnection[] = [];

  for (let epoch = currentEpoch - 1; epoch <= currentEpoch; epoch += 1) {
    const random = createRandom(0x51f15e + epoch * 8_191);
    for (let slot = 0; slot < 8; slot += 1) {
      const startedAt = epoch * epochDuration + slot * 74;
      const fromLayer = Math.floor(random() * 3);
      const toLayer = (fromLayer + 1 + Math.floor(random() * 2)) % 3;
      const fromIndex = Math.floor(random() * membraneSizes[fromLayer]);
      const toIndex = Math.floor(random() * membraneSizes[toLayer]);
      const bendCount = 2 + Math.floor(random() * 3);
      const bendOffsets = Array.from({ length: bendCount }, (_, bendIndex) => {
        const direction = (bendIndex + slot) % 2 === 0 ? 1 : -1;
        return direction * (.08 + random() * .2);
      });
      const toneRoll = random();
      const tone = toneRoll > .48 ? 4 as const : toneRoll > .24 ? 1 as const : 0 as const;
      const duration = 1_280 + random() * 720;
      const growthEnd = .28 + random() * .17;
      const collapseStart = .68 + random() * .12;
      const intensity = .68 + random() * .32;
      const life = (elapsedMs - startedAt) / duration;
      if (life <= 0 || life >= 1) continue;
      const growth = Math.min(1, life / growthEnd);
      const grown = growth * growth * (3 - 2 * growth);
      const collapse = Math.max(0, (life - collapseStart) / (1 - collapseStart));
      const collapsed = collapse * collapse * (3 - 2 * collapse) * .5;
      const fadeIn = Math.min(1, life / .12);
      const fadeOut = Math.min(1, (1 - life) / .18);
      connections.push({
        id: `${epoch}-${slot}-${fromLayer}-${fromIndex}-${toLayer}-${toIndex}`,
        path: 'polyline',
        bendOffsets,
        fromLayer,
        fromIndex,
        toLayer,
        toIndex,
        startProgress: collapsed,
        endProgress: Math.max(collapsed + .001, grown - collapsed),
        opacity: Math.min(fadeIn, fadeOut) * intensity,
        tone,
      });
    }
  }
  return connections;
};

const presenceCopy: Record<PresenceMode, { label: string; detail: string; awareness: string; footer: string }> = {
  idle: { label: '待命中', detail: 'IDLE PRESENCE', awareness: 'PASSIVE', footer: 'READY' },
  sensing: { label: '感知中', detail: 'SENSING INPUT', awareness: 'ACTIVE', footer: 'RECEIVING' },
  thinking: { label: '思考中', detail: 'PROCESSING', awareness: 'COMPUTING', footer: 'PROCESSING' },
  working: { label: '设计运算中', detail: 'DESIGN COMPUTATION', awareness: 'EXECUTING', footer: 'WORKING' },
  success: { label: '任务已收敛', detail: 'RESOLVED', awareness: 'STABLE', footer: 'RESOLVED' },
  failure: { label: '结构重整中', detail: 'RECALIBRATING', awareness: 'RECOVERING', footer: 'RECALIBRATING' },
};

export const getTerminalFeedbackProfile = (
  mode: TerminalPresenceMode,
  elapsedMs: number,
): TerminalFeedbackProfile => {
  const progress = Math.max(0, Math.min(1, elapsedMs / 1_200));
  const envelope = progress === 0 || progress === 1 ? 0 : Math.sin(Math.PI * progress);
  return {
    intensity: envelope,
    distortion: mode === 'failure' ? envelope : 0,
    tint: envelope,
  };
};

export const getNeuralBreathScale = (elapsedMs: number): number => {
  const seconds = elapsedMs / 1_000;
  return 1 + Math.sin(seconds * .82) * .032 + Math.sin(seconds * .31 + 1.7) * .018;
};

export const getNeuralLayerMotion = (
  layer: MotionLayer,
  index: number,
  elapsedMs: number,
  mode: PresenceMode,
): NeuralLayerMotion => {
  const seconds = elapsedMs / 1_000;
  const layerCode = { core: 1.7, energy: 3.1, membrane: 5.3 }[layer];
  const seed = layerCode * 4.71 + (index + 1) * 1.61803398875;
  const modeSpeed = mode === 'thinking' ? 2.35 : mode === 'working' ? 1.82 : mode === 'sensing' ? 1.72 : 1;
  const speed = { core: .24, energy: .47, membrane: .16 }[layer] * modeSpeed;
  const first = Math.sin(seconds * speed + seed);
  const second = Math.sin(seconds * (speed * .43 + .027) - seed * 1.73);
  const third = Math.sin(seconds * (speed * 1.81 + .019) + seed * .37);
  const noise = first * .5 + second * .32 + third * .18;
  const amplitude = mode === 'thinking' ? 1.48 : mode === 'working' ? 1.3 : mode === 'sensing' ? 1.2 : 1;
  const angleRange = { core: .022, energy: .16, membrane: .052 }[layer];
  const radiusRange = { core: .045, energy: .2, membrane: .105 }[layer];
  const driftRange = { core: 2.8, energy: 4.5, membrane: 3.4 }[layer];
  return {
    angle: noise * angleRange * amplitude,
    radius: 1 + (second * .58 + third * .42) * radiusRange * amplitude,
    x: Math.sin(seconds * speed * .61 + seed * .83) * driftRange * amplitude,
    y: Math.sin(seconds * speed * .47 - seed * 1.12) * driftRange * .78 * amplitude,
  };
};

export const getMembraneRotation = (
  layerIndex: number,
  elapsedMs: number,
  mode: PresenceMode,
): number => {
  const seconds = elapsedMs / 1_000;
  const tracks = [
    { direction: 1, speed: .025, wobble: .004, phase: .7 },
    { direction: -1, speed: .014, wobble: .003, phase: 2.3 },
    { direction: 1, speed: .008, wobble: .002, phase: 4.1 },
  ];
  const track = tracks[layerIndex % tracks.length];
  const speedBoost = mode === 'thinking' ? 2.25 : mode === 'working' ? 1.65 : mode === 'sensing' ? 1.58 : 1;
  const wobble = (
    Math.sin(seconds * .11 * speedBoost + track.phase) - Math.sin(track.phase)
  ) * track.wobble;
  return seconds * track.speed * track.direction * speedBoost + wobble;
};

const readPalette = (element: HTMLElement): string[] => {
  const styles = getComputedStyle(element);
  return ['--neural-cyan', '--neural-violet', '--neural-green', '--neural-coral', '--neural-amber']
    .map((name) => styles.getPropertyValue(name).trim());
};

const hexToRgb = (color: string): [number, number, number] => {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) return [85, 216, 239];
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [number, number, number];
};

const rgba = (color: string, alpha: number): string => {
  const [red, green, blue] = hexToRgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const positionPoint = (
  point: FieldPoint,
  fieldRadius: number,
  centerX: number,
  centerY: number,
  seconds: number,
  breath: number,
  pointer: { x: number; y: number },
  layerInfluence: number,
  motion: NeuralLayerMotion,
): RenderPoint => {
  const angle = point.angle + Math.sin(seconds * point.speed + point.phase) * .012 * layerInfluence + motion.angle;
  const radialDrift = Math.sin(seconds * point.speed * .71 + point.phase) * point.drift;
  const radius = point.radius * fieldRadius * breath * motion.radius + radialDrift * layerInfluence;
  return {
    ...point,
    px: centerX + Math.cos(angle) * radius + pointer.x * 10 * layerInfluence + motion.x,
    py: centerY + Math.sin(angle) * radius * .96 + pointer.y * 8 * layerInfluence + motion.y,
  };
};

const traceLoop = (context: CanvasRenderingContext2D, points: RenderPoint[]): void => {
  if (points.length < 2) return;
  const last = points[points.length - 1];
  const first = points[0];
  context.beginPath();
  context.moveTo((last.px + first.px) / 2, (last.py + first.py) / 2);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    context.quadraticCurveTo(point.px, point.py, (point.px + next.px) / 2, (point.py + next.py) / 2);
  });
};

const tracePolygon = (context: CanvasRenderingContext2D, points: RenderPoint[]): void => {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].px, points[0].py);
  points.slice(1).forEach((point) => context.lineTo(point.px, point.py));
  context.lineTo(points[0].px, points[0].py);
};

const drawPresence = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
  mode: PresenceMode,
  palette: string[],
  pointer: { x: number; y: number },
): void => {
  context.clearRect(0, 0, width, height);
  const seconds = elapsedMs / 1_000;
  const isThinking = mode === 'thinking';
  const isWorking = mode === 'working';
  const terminalMode = mode === 'success' || mode === 'failure' ? mode : null;
  const terminalFeedback = terminalMode
    ? getTerminalFeedbackProfile(terminalMode, elapsedMs)
    : { intensity: 0, distortion: 0, tint: 0 };
  const isSuccess = terminalMode === 'success';
  const feedbackPalette = terminalMode === 'success' ? palette[2] : palette[3];
  const breath = getNeuralBreathScale(elapsedMs);
  const radius = Math.min(width, height) * .285;
  const centerX = width / 2 + pointer.x * width * .016;
  const centerY = height / 2 + pointer.y * height * .014;
  const coreBreath = 1 + (breath - 1) * .48;
  const coreCenterMotion = getNeuralLayerMotion('core', 997, elapsedMs, mode);
  const coreCenterX = centerX + coreCenterMotion.x * 1.4;
  const coreCenterY = centerY + coreCenterMotion.y * 1.4;
  const core = neuralField.coreBoundary.map((point, index) => {
    const motion = getNeuralLayerMotion('core', index, elapsedMs, mode);
    const positioned = positionPoint(point, radius, coreCenterX, coreCenterY, seconds, coreBreath, pointer, .16, motion);
    const failureOffset = terminalFeedback.distortion * Math.sin(index * 1.7 + seconds * 19) * radius * .045;
    return {
      ...positioned,
      px: coreCenterX + (positioned.px - coreCenterX) * (1 - terminalFeedback.intensity * .14) + failureOffset,
      py: coreCenterY + (positioned.py - coreCenterY) * (1 - terminalFeedback.intensity * .14) - failureOffset * .6,
    };
  });
  const membranes = neuralField.membranes.map((membrane, layerIndex) => membrane.map((point, index) => {
    const layerBreath = 1 + (breath - 1) * (1 + layerIndex * .23)
      + Math.sin(seconds * (.24 + layerIndex * .07) + layerIndex) * .006;
    const localMotion = getNeuralLayerMotion('membrane', layerIndex * 101 + index, elapsedMs, mode);
    const layerMotion = getNeuralLayerMotion('membrane', 701 + layerIndex, elapsedMs, mode);
    const motion = {
      ...localMotion,
      angle: localMotion.angle + layerMotion.angle * .72 + getMembraneRotation(layerIndex, elapsedMs, mode),
      radius: localMotion.radius * (1 + (layerMotion.radius - 1) * .6),
      x: localMotion.x + layerMotion.x,
      y: localMotion.y + layerMotion.y,
    };
    const positioned = positionPoint(point, radius, centerX, centerY, seconds, layerBreath, pointer, .4 + layerIndex * .2, motion);
    const failureOffset = terminalFeedback.distortion * Math.sin(index * 2.1 + layerIndex * 3 + seconds * 14) * radius * (.035 + layerIndex * .008);
    return {
      ...positioned,
      px: centerX + (positioned.px - centerX) * (1 + (isSuccess ? terminalFeedback.intensity * .11 : 0)) + failureOffset,
      py: centerY + (positioned.py - centerY) * (1 + (isSuccess ? terminalFeedback.intensity * .11 : 0)) - failureOffset * .75,
    };
  }));
  const energySeeds = neuralField.energySeeds.map((point, index) => {
    const motion = getNeuralLayerMotion('energy', index, elapsedMs, mode);
    return positionPoint(point, radius, coreCenterX, coreCenterY, seconds * 1.35, coreBreath, pointer, .12, motion);
  });

  // Layered low-opacity halos give the shell volume without turning it into a solid orb.
  [0.76, 0.58, 0.4].forEach((scale, index) => {
    context.save();
    context.shadowColor = terminalMode ? rgba(feedbackPalette, .3 + terminalFeedback.tint * .55) : rgba(palette[index === 2 ? 4 : 0], .18);
    context.shadowBlur = 34 - index * 6 + terminalFeedback.intensity * (isSuccess ? 28 : 10);
    context.beginPath();
    const haloScale = scale * (1 + terminalFeedback.intensity * (isSuccess ? .2 : -.08));
    context.arc(centerX, centerY, radius * haloScale * coreBreath, 0, Math.PI * 2);
    context.fillStyle = terminalMode ? rgba(feedbackPalette, .012 + terminalFeedback.tint * .05) : rgba(palette[index === 2 ? 4 : 1], .008 + index * .006);
    context.fill();
    context.restore();
  });

  // The core stays legible as one circular intelligence while its boundary remains alive.
  context.save();
  context.shadowColor = terminalMode ? rgba(feedbackPalette, .45 + terminalFeedback.tint * .5) : rgba(palette[4], isThinking ? .72 : isWorking ? .58 : mode === 'sensing' ? .55 : .28);
  context.shadowBlur = (isThinking ? 54 : isWorking ? 50 : 42) + Math.sin(seconds * (isThinking ? 1.65 : isWorking ? 1.28 : .72)) * 9 + terminalFeedback.intensity * 24;
  context.beginPath();
  const coreScale = 1 - terminalFeedback.intensity * (isSuccess ? .2 : .12);
  context.arc(coreCenterX, coreCenterY, radius * .31 * coreBreath * coreCenterMotion.radius * coreScale, 0, Math.PI * 2);
  context.fillStyle = terminalMode ? rgba(feedbackPalette, .1 + terminalFeedback.tint * .2) : rgba(palette[0], isThinking ? .17 : isWorking ? .15 : mode === 'sensing' ? .13 : .075);
  context.fill();
  context.restore();

  traceLoop(context, core);
  context.fillStyle = terminalMode ? rgba(feedbackPalette, .08 + terminalFeedback.tint * .18) : rgba(palette[1], isThinking ? .16 : isWorking ? .14 : mode === 'sensing' ? .12 : .07);
  context.fill();
  context.lineWidth = .85;
  context.strokeStyle = terminalMode ? rgba(feedbackPalette, .45 + terminalFeedback.tint * .5) : rgba(palette[0], isThinking ? .82 : isWorking ? .76 : mode === 'sensing' ? .68 : .46);
  context.stroke();

  core.forEach((point, index) => {
    if (index % 2 !== 0) return;
    const across = core[(index + 11 + index % 5) % core.length];
    context.beginPath();
    context.moveTo(point.px, point.py);
    context.lineTo(across.px, across.py);
    context.lineWidth = .38;
    context.strokeStyle = rgba(palette[index % 8 === 0 ? 4 : 0], .08);
    context.stroke();
  });

  // Interlaced loops and cross-links read as one translucent wireframe cocoon.
  membranes.forEach((membrane, layerIndex) => {
    tracePolygon(context, membrane);
    context.fillStyle = rgba(palette[layerIndex === 1 ? 1 : 0], .012 + layerIndex * .006);
    context.fill();
    context.lineWidth = .38 + layerIndex * .1;
    context.strokeStyle = terminalMode ? rgba(feedbackPalette, .24 + terminalFeedback.tint * .5) : rgba(palette[layerIndex === 2 ? 1 : 0], .1 + layerIndex * .035);
    context.stroke();

    membrane.forEach((point, index) => {
      const previousLayer = layerIndex === 0 ? core : membranes[layerIndex - 1];
      if (index % 2 === 0) {
        const anchor = previousLayer[Math.round(index / membrane.length * previousLayer.length) % previousLayer.length];
        context.beginPath();
        context.moveTo(anchor.px, anchor.py);
        context.quadraticCurveTo(
          (anchor.px + point.px) / 2 + Math.sin(point.phase) * 6,
          (anchor.py + point.py) / 2 + Math.cos(point.phase) * 6,
          point.px,
          point.py,
        );
        context.lineWidth = .34;
        context.strokeStyle = rgba(palette[point.tone], .075);
        context.stroke();
      }

      const chord = membrane[(index + 4 + layerIndex * 2) % membrane.length];
      if (index % 2 === layerIndex % 2) {
        context.beginPath();
        context.moveTo(point.px, point.py);
        context.lineTo(chord.px, chord.py);
        context.lineWidth = .3;
        context.strokeStyle = rgba(palette[index % 9 === 0 ? 4 : 0], .095);
        context.stroke();
      }

      if (index % 3 === 0) {
        const next = membrane[(index + 3) % membrane.length];
        const anchor = previousLayer[Math.round((index + 1) / membrane.length * previousLayer.length) % previousLayer.length];
        context.beginPath();
        context.moveTo(point.px, point.py);
        context.lineTo(next.px, next.py);
        context.lineTo(anchor.px, anchor.py);
        context.lineTo(point.px, point.py);
        context.fillStyle = rgba(palette[index % 6 === 0 ? 1 : 0], .012 + layerIndex * .006);
        context.fill();
      }

      if (index % 4 === 0) {
        context.beginPath();
        context.arc(point.px, point.py, point.size * .55, 0, Math.PI * 2);
        context.fillStyle = rgba(palette[point.tone], .32);
        context.fill();
      }
    });
  });

  if (isThinking) {
    getThinkingConnections(elapsedMs).forEach((connection) => {
      const fromLayer = membranes[connection.fromLayer];
      const toLayer = membranes[connection.toLayer];
      const from = fromLayer[connection.fromIndex % fromLayer.length];
      const to = toLayer[connection.toIndex % toLayer.length];
      const deltaX = to.px - from.px;
      const deltaY = to.py - from.py;
      const color = palette[connection.tone];
      const route = [
        { x: from.px, y: from.py },
        ...connection.bendOffsets.map((offset, index) => {
          const progress = (index + 1) / (connection.bendOffsets.length + 1);
          const taper = Math.sin(Math.PI * progress);
          return {
            x: from.px + deltaX * progress - deltaY * offset * taper,
            y: from.py + deltaY * progress + deltaX * offset * taper,
          };
        }),
        { x: to.px, y: to.py },
      ];
      const segmentCount = route.length - 1;
      const pointAt = (progress: number): { x: number; y: number } => {
        const scaled = Math.min(progress, .999999) * segmentCount;
        const segment = Math.min(Math.floor(scaled), segmentCount - 1);
        const localProgress = scaled - segment;
        const start = route[segment];
        const end = route[segment + 1];
        return {
          x: start.x + (end.x - start.x) * localProgress,
          y: start.y + (end.y - start.y) * localProgress,
        };
      };
      const segmentStart = pointAt(connection.startProgress);
      const segmentEnd = pointAt(connection.endProgress);

      context.save();
      context.shadowColor = rgba(color, .84 * connection.opacity);
      context.shadowBlur = 7 + connection.opacity * 9;
      context.beginPath();
      context.moveTo(segmentStart.x, segmentStart.y);
      const firstWaypoint = Math.floor(connection.startProgress * segmentCount) + 1;
      const lastWaypoint = Math.floor(connection.endProgress * segmentCount);
      for (let waypoint = firstWaypoint; waypoint <= lastWaypoint; waypoint += 1) {
        context.lineTo(route[waypoint].x, route[waypoint].y);
      }
      context.lineTo(segmentEnd.x, segmentEnd.y);
      context.lineWidth = .56 + connection.opacity * .75;
      context.strokeStyle = rgba(color, (.16 + connection.opacity * .68) * connection.opacity);
      context.stroke();

      context.fillStyle = rgba(color, (.3 + connection.opacity * .65) * connection.opacity);
      [
        { ...segmentStart, size: .8 + connection.opacity * 1.4 },
        { ...segmentEnd, size: 1 + connection.opacity * 1.8 },
      ].forEach((endpoint) => {
        context.beginPath();
        context.arc(endpoint.x, endpoint.y, endpoint.size, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
    });
  }

  // Small warm energy fragments orbit within the round core and briefly cohere when sensing.
  const energyGain = isThinking ? 1.28 : isWorking ? 1.42 : mode === 'sensing' ? 1 : terminalMode ? .58 + terminalFeedback.intensity * .8 : .58;
  energySeeds.forEach((point, index) => {
    const next = energySeeds[(index + 1) % energySeeds.length];
    const cross = energySeeds[(index + 3) % energySeeds.length];
    context.beginPath();
    context.moveTo(point.px, point.py);
    context.lineTo(index % 2 === 0 ? cross.px : next.px, index % 2 === 0 ? cross.py : next.py);
    context.lineWidth = .55 + energyGain * .35;
    context.strokeStyle = rgba(palette[point.tone], .19 * energyGain);
    context.stroke();

    if (index % 3 === 0) {
      const third = energySeeds[(index + 2) % energySeeds.length];
      context.save();
      context.shadowColor = rgba(palette[4], .8);
      context.shadowBlur = 10 + energyGain * 8;
      context.beginPath();
      context.moveTo(point.px, point.py);
      context.lineTo(next.px, next.py);
      context.lineTo(third.px, third.py);
      context.lineTo(point.px, point.py);
      context.fillStyle = rgba(palette[4], .12 * energyGain);
      context.fill();
      context.restore();
    }

    const spark = .62 + Math.sin(seconds * point.speed * (isThinking ? 2.4 : isWorking ? 2 : 1) + point.phase) * .28;
    context.save();
    context.shadowColor = terminalMode ? rgba(feedbackPalette, .7 + terminalFeedback.tint * .3) : rgba(palette[point.tone], .92);
    context.shadowBlur = 7 + spark * 10 + energyGain * 7;
    context.beginPath();
    context.arc(point.px, point.py, point.size * (spark + energyGain * .18), 0, Math.PI * 2);
    context.fillStyle = terminalMode ? rgba(feedbackPalette, (.46 + spark * .34) * energyGain) : rgba(palette[point.tone], (.56 + spark * .34) * energyGain);
    context.fill();
    context.restore();
  });

};

type NeuralPresenceProps = {
  mode: PresenceMode;
  compact?: boolean;
};

export const NeuralPresence = ({ mode, compact = false }: NeuralPresenceProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerTarget = useRef({ x: 0, y: 0, active: false });
  const copy = presenceCopy[mode];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let context: CanvasRenderingContext2D | null = null;
    try { context = canvas.getContext('2d'); } catch { return; }
    if (!context) return;

    let frame = 0;
    let startedAt = 0;
    let pointer = { x: 0, y: 0 };
    let width = 480;
    let height = 480;
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = (): void => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(320, Math.round(bounds.width || 480));
      height = Math.max(320, Math.round(bounds.height || 480));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const render = (time: number): void => {
      if (!startedAt) startedAt = time;
      const target = pointerTarget.current.active ? pointerTarget.current : { x: 0, y: 0 };
      pointer = {
        x: pointer.x + (target.x - pointer.x) * .045,
        y: pointer.y + (target.y - pointer.y) * .045,
      };
      drawPresence(context, width, height, time - startedAt, mode, readPalette(canvas), pointer);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };

    resize();
    render(0);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);

  const trackPointer = (event: PointerEvent<HTMLCanvasElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerTarget.current = {
      x: ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - .5) * 2,
      y: ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - .5) * 2,
      active: true,
    };
  };

  return (
    <section className="neural-presence" data-mode={mode} data-compact={compact ? 'true' : undefined} data-testid="neural-presence">
      <canvas
        ref={canvasRef}
        className="neural-presence__canvas"
        role="img"
        aria-label={`${copy.label}的神经簇智体`}
        onPointerMove={trackPointer}
        onPointerLeave={() => { pointerTarget.current.active = false; }}
      />
      {!compact && <p className="neural-presence__status" aria-live="polite">
        <i aria-hidden="true" />
        <span>{copy.label}</span>
        <small>{copy.detail}</small>
      </p>}
    </section>
  );
};

export const NeuralPresencePreview = (): ReactElement => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mode, setMode] = useState<PresenceMode>('idle');

  useEffect(() => {
    if (mode !== 'sensing') return;
    const timer = window.setTimeout(() => setMode('idle'), 1_800);
    return () => window.clearTimeout(timer);
  }, [mode]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const copy = presenceCopy[mode];
  const isThinking = mode === 'thinking';
  return (
    <main className="neural-preview" aria-label="神经簇智体动效预览" data-theme={theme} data-mode={mode}>
      <header className="neural-preview__header">
        <div className="neural-preview__identity">
          <span className="neural-preview__mark" aria-hidden="true">D</span>
          <span><strong>DesignHub</strong><small>NEURAL PRESENCE / STUDY 02</small></span>
        </div>
        <div className="neural-preview__actions">
          <button type="button" onClick={() => setTheme(nextTheme)} aria-label={`切换至${nextTheme === 'light' ? '浅色' : '深色'}模式`}>
            {theme === 'dark' ? 'LIGHT' : 'DARK'}
          </button>
          <button
            type="button"
            aria-label={isThinking ? '停止思考' : '开始思考'}
            aria-pressed={isThinking}
            onClick={() => setMode(isThinking ? 'idle' : 'thinking')}
          >
            {isThinking ? 'STOP' : 'THINK'}
          </button>
          <button type="button" onClick={() => setMode('sensing')} aria-label="触发感知">
            SENSE
          </button>
        </div>
      </header>

      <section className="neural-preview__stage" aria-labelledby="neural-preview-title">
        <div className="neural-preview__title">
          <p>LOCAL INTELLIGENCE / ONLINE</p>
          <h1 id="neural-preview-title">智体</h1>
        </div>
        <NeuralPresence mode={mode} />
        <span className="neural-preview__coordinate neural-preview__coordinate--top">PRESENCE FIELD / 01</span>
        <span className="neural-preview__coordinate neural-preview__coordinate--bottom">AWARENESS: {copy.awareness}</span>
      </section>

      <footer className="neural-preview__footer">
        <span>DESIGNHUB LOCAL INTELLIGENCE</span>
        <span>{copy.footer}</span>
      </footer>
    </main>
  );
};
