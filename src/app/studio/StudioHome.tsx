import { useEffect, useState } from 'react';

import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { Locale } from '../i18n';
import { HomeConversationComposer } from './HomeConversationComposer';
import { HomeDesignerRail } from './HomeDesignerRail';
import { HomeProjectPanel } from './HomeProjectPanel';
import type { PersonaProfile } from './personas';
import type { HomeConversationRequest, Project } from './types';
import { t } from './ui';
import './studio-home.css';

type StudioHomeProps = {
  workspaceId?: string;
  locale: Locale;
  projects: Project[];
  visibleProjects: Project[];
  profiles: PersonaProfile[];
  filter: 'active' | 'archived' | 'all';
  query: string;
  loadFailed: boolean;
  readOnly: boolean;
  conversationConnected: boolean;
  onFilterChange: (value: 'active' | 'archived' | 'all') => void;
  onQueryChange: (value: string) => void;
  onOpenProject: (project: Project) => void;
  onRetry: () => void;
  onViewAllDesigners: () => void;
  onNewProject?: () => void;
  onSubmit: (input: HomeConversationRequest) => Promise<boolean>;
  notify: (message: string) => void;
};

export const StudioHome = ({
  workspaceId,
  locale,
  projects,
  visibleProjects,
  profiles,
  filter,
  query,
  loadFailed,
  readOnly,
  conversationConnected,
  onFilterChange,
  onQueryChange,
  onOpenProject,
  onRetry,
  onViewAllDesigners,
  onNewProject,
  onSubmit,
  notify,
}: StudioHomeProps) => {
  const [selectedDesignerId, setSelectedDesignerId] = useState('');
  useEffect(() => setSelectedDesignerId(''), [workspaceId]);
  useEffect(() => {
    if (selectedDesignerId && !profiles.some((profile) => profile.id === selectedDesignerId && profile.status !== 'archived')) {
      setSelectedDesignerId('');
    }
  }, [profiles, selectedDesignerId]);
  const selectedDesigner = profiles.find(
    (profile) => profile.id === selectedDesignerId && profile.status !== 'archived',
  ) ?? null;
  const hasProjects = projects.length > 0;
  const showProjectPanel = hasProjects || loadFailed;
  const hasDesigners = profiles.some((profile) => profile.status !== 'archived');
  const submit = async (input: { message: string; attachments: ConversationImageAttachment[]; generationRatio: HomeConversationRequest['generationRatio'] }): Promise<boolean> => {
    const succeeded = await onSubmit({
      ...input,
      ...(selectedDesignerId ? { designerId: selectedDesignerId } : {}),
    });
    if (succeeded) setSelectedDesignerId('');
    return succeeded;
  };

  return (
    <main className={`studio-home${showProjectPanel ? '' : ' studio-home--empty'}`}>
      <div className="studio-home__brand" aria-label="Design Hub">
        <picture>
          <img className="studio-home__brand-mark studio-home__brand-mark--light" src="./designhub-logo-light.png" alt="Design Hub" />
          <img className="studio-home__brand-mark studio-home__brand-mark--dark" src="./designhub-logo-dark.png" alt="" aria-hidden="true" />
        </picture>
        <strong>Design Hub</strong>
      </div>
      {showProjectPanel ? (
        <HomeProjectPanel
          locale={locale}
          allProjects={projects}
          projects={visibleProjects}
          filter={filter}
          query={query}
          loadFailed={loadFailed}
          onFilterChange={onFilterChange}
          onQueryChange={onQueryChange}
          onOpenProject={onOpenProject}
          onRetry={onRetry}
        />
      ) : null}
      <section className="studio-home-create" aria-label={t(locale, '创建项目', 'Create project')}>
        <header className="studio-home-create__hero">
          <h1>{t(locale, '欢迎使用 Design Hub', 'Welcome to Design Hub')}</h1>
        </header>
        <HomeConversationComposer
          locale={locale}
          readOnly={readOnly}
          conversationConnected={conversationConnected}
          designer={selectedDesigner}
          onNewProject={onNewProject}
          onSubmit={submit}
          notify={notify}
        />
        {hasDesigners ? (
          <HomeDesignerRail
            locale={locale}
            profiles={profiles}
            selectedId={selectedDesignerId}
            onChange={setSelectedDesignerId}
            onViewAll={onViewAllDesigners}
          />
        ) : null}
      </section>
    </main>
  );
};
