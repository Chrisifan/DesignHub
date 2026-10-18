import type { ReactElement } from 'react';

import { App } from './App';
import { NeuralPresencePreview } from './previews/AgentConstellationPreview';

export type PreviewMode = 'neural-presence';

export const getPreviewMode = (search: string): PreviewMode | null => {
  const preview = new URLSearchParams(search).get('preview');
  return preview === 'neural-presence' ? preview : null;
};

export const AppEntry = ({ search = window.location.search }: { search?: string }): ReactElement => (
  getPreviewMode(search) === 'neural-presence' ? <NeuralPresencePreview /> : <App />
);
