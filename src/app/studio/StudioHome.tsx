import { useEffect, useState } from 'react';

import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { Locale } from '../i18n';
import { HomeConversationComposer } from './HomeConversationComposer';
import { HomeDesignerRail } from './HomeDesignerRail';
import { HomeProjectPanel } from './HomeProjectPanel';
import { Drawer } from './Drawer';
import { PersonaInspector } from './PersonaInspector';
import type { PersonaProfile } from './personas';
import type { HomeConversationRequest, Project } from './types';
import { t } from './ui';
import './studio-home.css';

type StudioHomeProps = {
  libraryId?: string;
  locale: Locale;
  projects: Project[];
  visibleProjects: Project[];
  profiles: PersonaProfile[];
  filter: 'active' | 'archived' | 'all';
  transitionDirection?: 'forward' | 'backward';
  query: string;
  loadFailed: boolean;
  readOnly: boolean;
  conversationConnected: boolean;
  onFilterChange: (value: 'active' | 'archived' | 'all') => void;
  onQueryChange: (value: string) => void;
  onOpenProject: (project: Project) => void;
  onRetry: () => void;
  onNewProject?: (input: { designerId?: string; generationRatio: HomeConversationRequest['generationRatio'] }) => void;
  onSubmit: (input: HomeConversationRequest) => Promise<boolean>;
  notify: (message: string) => void;
};

const projectFilterOrder: StudioHomeProps['filter'][] = ['active', 'archived', 'all'];

export const StudioHome = ({
  libraryId,
  locale,
  projects,
  visibleProjects,
  profiles,
  filter,
  transitionDirection = 'forward',
  query,
  loadFailed,
  readOnly,
  conversationConnected,
  onFilterChange,
  onQueryChange,
  onOpenProject,
  onRetry,
  onNewProject,
  onSubmit,
  notify,
}: StudioHomeProps) => {
  const [selectedDesignerId, setSelectedDesignerId] = useState('');
  const [inspectedDesignerId, setInspectedDesignerId] = useState<string | null>(null);
  const [projectFilterDirection, setProjectFilterDirection] = useState<'forward' | 'backward' | null>(null);
  useEffect(() => setSelectedDesignerId(''), [libraryId]);
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
  const inspectedDesigner = profiles.find((profile) => profile.id === inspectedDesignerId && profile.status !== 'archived') ?? null;
  const submit = async (input: { message: string; attachments: ConversationImageAttachment[]; generationRatio: HomeConversationRequest['generationRatio'] }): Promise<boolean> => {
    const succeeded = await onSubmit({
      ...input,
      ...(selectedDesignerId ? { designerId: selectedDesignerId } : {}),
    });
    if (succeeded) setSelectedDesignerId('');
    return succeeded;
  };
  const handleFilterChange = (nextFilter: StudioHomeProps['filter']): void => {
    const currentIndex = projectFilterOrder.indexOf(filter);
    const nextIndex = projectFilterOrder.indexOf(nextFilter);
    setProjectFilterDirection(nextIndex >= currentIndex ? 'forward' : 'backward');
    onFilterChange(nextFilter);
  };

  return (
    <main className={`studio-home studio-view-enter studio-view-enter-${transitionDirection}${showProjectPanel ? '' : ' studio-home--empty'}`}>
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
          transitionDirection={projectFilterDirection}
          query={query}
          loadFailed={loadFailed}
          onFilterChange={handleFilterChange}
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
          designerOptions={profiles}
          onDesignerChange={setSelectedDesignerId}
          onNewProject={(input) => onNewProject?.({ ...input, ...(selectedDesignerId ? { designerId: selectedDesignerId } : {}) })}
          onSubmit={submit}
          notify={notify}
        />
        {hasDesigners ? (
          <HomeDesignerRail
            locale={locale}
            profiles={profiles}
            selectedId={selectedDesignerId}
            onInspect={(profile) => setInspectedDesignerId(profile.id)}
          />
        ) : null}
      </section>
      <Drawer
        open={Boolean(inspectedDesigner)}
        title={t(locale, '设计师信息', 'Designer profile')}
        locale={locale}
        onClose={() => setInspectedDesignerId(null)}
      >
        <PersonaInspector
          locale={locale}
          profile={inspectedDesigner ?? undefined}
          libraryId={libraryId}
          readOnly={readOnly}
          showActions={false}
        />
      </Drawer>
    </main>
  );
};
