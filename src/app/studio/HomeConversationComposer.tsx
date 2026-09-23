import { useState } from 'react';

import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { ProjectGenerationRatio } from '../../features/projects/size';
import type { Locale } from '../i18n';
import { ConversationDock, type ConversationDockAttachment } from './ConversationDock';
import type { PersonaProfile } from './personas';
import { Icon, t } from './ui';

type HomeConversationComposerProps = {
  locale: Locale;
  readOnly: boolean;
  conversationConnected: boolean;
  designer: PersonaProfile | null;
  designerOptions?: PersonaProfile[];
  onDesignerChange?: (designerId: string) => void;
  onNewProject?: (input: { designerId?: string; generationRatio: ProjectGenerationRatio }) => void;
  onSubmit: (input: { message: string; attachments: ConversationImageAttachment[]; generationRatio: ProjectGenerationRatio }) => Promise<boolean>;
  notify: (message: string) => void;
};

export const HomeConversationComposer = ({
  locale,
  readOnly,
  conversationConnected,
  designer,
  designerOptions = [],
  onDesignerChange = () => undefined,
  onNewProject,
  onSubmit,
  notify,
}: HomeConversationComposerProps) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ConversationDockAttachment[]>([]);
  const [generationRatio, setGenerationRatio] = useState<ProjectGenerationRatio>('3:4');
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    const trimmed = message.trim();
    if (!trimmed) {
      notify(t(locale, '请输入设计需求。', 'Describe the design you want.'));
      return;
    }
    if (readOnly) {
      notify(t(locale, '当前工作区为只读模式。', 'The current workspace is read-only.'));
      return;
    }
    if (!conversationConnected) {
      notify(t(locale, '请先连接对话模型。', 'Connect a conversation model first.'));
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const plainAttachments = attachments.map(({ name, mimeType, bytes }) => ({ name, mimeType, bytes }));
      const succeeded = await onSubmit({ message: trimmed, attachments: plainAttachments, generationRatio });
      if (succeeded) {
        setAttachments([]);
        setMessage('');
      }
    } catch {
      notify(t(locale, '无法读取图片或创建项目。', 'The image could not be read or the project could not be created.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home-conversation-composer">
      {onNewProject ? (
        <button
          type="button"
          className="home-conversation-composer__new-project"
          onClick={() => onNewProject?.({ generationRatio, ...(designer ? { designerId: designer.id } : {}) })}
          disabled={readOnly}
        >
          <Icon name="plus" size={14} />
          <span>{t(locale, '新建项目', 'New project')}</span>
        </button>
      ) : null}
      <ConversationDock
        variant="expanded"
        locale={locale}
        value={message}
        attachments={attachments}
        readOnly={readOnly}
        busy={busy}
        conversationConnected={conversationConnected}
        designer={designer}
        designerOptions={designerOptions}
        onDesignerChange={onDesignerChange}
        generationRatio={generationRatio}
        onGenerationRatioChange={setGenerationRatio}
        textareaLabel={t(locale, '设计需求', 'Design request')}
        placeholder={t(locale, '说说你想做什么。可以描述内容、用途和感觉…', 'Describe the content, purpose, and feeling you want…')}
        submitLabel={t(locale, '发送并创建项目', 'Send and create project')}
        busyLabel={t(locale, '创建中', 'Creating')}
        onValueChange={setMessage}
        onAttachmentsChange={setAttachments}
        onSubmit={() => { void submit(); }}
        notify={notify}
      />
    </div>
  );
};
