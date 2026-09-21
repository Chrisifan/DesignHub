import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import type { Locale } from '../i18n';
import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { TaskRecord } from '../../features/tasks/state';
import { Button, Icon, IconButton } from './ui';

export type AnalysisPanelAttachment = ConversationImageAttachment & {
  assetId?: string;
  previewUrl: string;
};

export type AnalysisPanelRequest = {
  message: string;
  attachments: AnalysisPanelAttachment[];
};

export type AnalysisPanelProps = {
  locale: Locale;
  message: string;
  attachments: AnalysisPanelAttachment[];
  task?: TaskRecord;
  canGenerate: boolean;
  collapsed?: boolean;
  onGenerate: () => void;
  onRetry?: () => void;
  onCopyRequest?: (request: AnalysisPanelRequest) => void;
  onCollapse?: () => void;
  onExpand?: () => void;
};

type AnalysisBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'rule' }
  | { type: 'code'; language?: string; text: string };

const isRule = (line: string): boolean => /^\s*(?:---+|\*\s*\*\s*\*|___+)\s*$/u.test(line);

const parseAnalysisMarkdown = (value: string): AnalysisBlock[] => {
  const sourceLines = value.replace(/\r\n?/gu, '\n').split('\n');
  const blocks: AnalysisBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let codeLanguage: string | null = null;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join('\n').trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ type: 'list', items: list });
      list = [];
    }
  };

  sourceLines.forEach((line) => {
    const trimmed = line.trim();
    if (codeLanguage !== null) {
      if (/^```\s*$/u.test(trimmed)) {
        blocks.push({ type: 'code', language: codeLanguage || undefined, text: codeLines.join('\n') });
        codeLanguage = null;
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      return;
    }

    const codeFence = /^```(?:\s*(\S+))?\s*$/u.exec(trimmed);
    if (codeFence) {
      flushParagraph();
      flushList();
      codeLanguage = codeFence[1] ?? '';
      codeLines = [];
      return;
    }

    const heading = /^(#{1,6})\s+(.+)$/u.exec(trimmed);
    const listItem = /^(?:[-*+]|\d+[.)])\s+(.+)$/u.exec(trimmed);

    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6, text: heading[2] });
    } else if (isRule(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'rule' });
    } else if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  });

  flushParagraph();
  flushList();
  if (codeLanguage !== null) {
    blocks.push({ type: 'code', language: codeLanguage || undefined, text: codeLines.join('\n') });
  }
  return blocks;
};

const renderInlineMarkdown = (value: string): ReactNode[] => {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/gu);
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/u.test(part)) {
      return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/u.test(part)) {
      return <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>;
    }
    return <span key={`${index}-${part}`}>{part}</span>;
  });
};

const renderAnalysisBlock = (block: AnalysisBlock, index: number): ReactNode => {
  if (block.type === 'heading') {
    const Heading = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return <Heading key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</Heading>;
  }
  if (block.type === 'list') {
    return <ul key={`${block.type}-${index}`}>{block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{renderInlineMarkdown(item)}</li>)}</ul>;
  }
  if (block.type === 'rule') {
    return <hr key={`${block.type}-${index}`} role="separator" />;
  }
  if (block.type === 'code') {
    return <pre key={`${block.type}-${index}`} data-language={block.language}><code>{block.text}</code></pre>;
  }
  return <p key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</p>;
};

export const AnalysisPanel = ({ locale, message, attachments, task, canGenerate, collapsed = false, onGenerate, onRetry, onCopyRequest, onCollapse, onExpand }: AnalysisPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [requestExpanded, setRequestExpanded] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const progress = task?.progressText || task?.result?.text || '';
  const [visibleProgress, setVisibleProgress] = useState(progress);
  const failed = task?.state === 'failed';
  const running = task?.state === 'queued' || task?.state === 'running';
  const smoothing = visibleProgress !== progress;
  const enhancedRequest = Boolean(onCopyRequest || onCollapse);
  const requestSummary = message.replace(/\s+/gu, ' ').trim();

  useEffect(() => setRequestExpanded(false), [task?.id]);

  useEffect(() => {
    if (visibleProgress === progress) return undefined;
    if (!progress.startsWith(visibleProgress)) {
      setVisibleProgress(progress);
      return undefined;
    }
    let timer = 0;
    timer = window.setInterval(() => {
      setVisibleProgress((current) => {
        if (current === progress) {
          window.clearInterval(timer);
          return current;
        }
        if (!progress.startsWith(current)) {
          window.clearInterval(timer);
          return progress;
        }
        const remaining = progress.length - current.length;
        const step = Math.max(1, Math.min(12, Math.ceil(remaining / 4)));
        const next = progress.slice(0, current.length + step);
        if (next === progress) window.clearInterval(timer);
        return next;
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [progress]);

  useLayoutEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
    const bottom = bottomRef.current;
    if (bottom && typeof bottom.scrollIntoView === 'function') {
      bottom.scrollIntoView({ block: 'end' });
    }
  }, [expanded, progress, requestExpanded, visibleProgress, task?.state]);

  const blocks = visibleProgress ? parseAnalysisMarkdown(visibleProgress) : [];
  const streaming = running || smoothing;
  if (collapsed) {
    return (
      <aside className="workbench-analysis-panel workbench-analysis-panel--collapsed" aria-label={locale === 'zh-CN' ? '本轮分析已收起' : 'Current analysis collapsed'}>
        <span className="workbench-analysis-panel__streaming" data-testid="collapsed-analysis-dots" aria-hidden="true"><span /><span /><span /></span>
        <IconButton name="chevron-down" label={locale === 'zh-CN' ? '展开本轮分析' : 'Expand current analysis'} onClick={onExpand} />
      </aside>
    );
  }
  return (
    <aside className="workbench-analysis-panel" aria-label={locale === 'zh-CN' ? '设计分析' : 'Design analysis'}>
      {enhancedRequest ? <>
        <div className="workbench-analysis-panel__header">
          <div className="workbench-analysis-panel__request">
            <p>{locale === 'zh-CN' ? '本轮分析' : 'Current analysis'}</p>
            <strong className="workbench-analysis-panel__request-line" title={message}>{requestSummary || (locale === 'zh-CN' ? '等待输入' : 'Waiting for input')}</strong>
          </div>
          {onCopyRequest && <IconButton name="copy" label={locale === 'zh-CN' ? '复制到对话框' : 'Copy to conversation'} onClick={() => onCopyRequest({ message, attachments })} />}
          <IconButton
            name="chevron-down"
            className={`workbench-analysis-panel__request-toggle${requestExpanded ? ' is-expanded' : ''}`}
            label={locale === 'zh-CN' ? (requestExpanded ? '收起本轮输入' : '展开本轮输入') : (requestExpanded ? 'Collapse current request' : 'Expand current request')}
            aria-expanded={requestExpanded}
            onClick={() => setRequestExpanded((value) => !value)}
          />
          {onCollapse && <IconButton className="workbench-analysis-panel__collapse" name="chevron-down" label={locale === 'zh-CN' ? '收起本轮分析' : 'Collapse current analysis'} onClick={onCollapse} />}
        </div>
        {requestExpanded && <div className="workbench-analysis-panel__request-details" data-testid="analysis-request-details">
          <p>{message}</p>
          {attachments.length > 0 && <div className="workbench-analysis-panel__attachments">{attachments.map((attachment) => <img key={attachment.assetId ?? attachment.previewUrl} src={attachment.previewUrl} alt={attachment.name} />)}</div>}
        </div>}
      </> : <>
        <div className="workbench-analysis-panel__header">
          <div>
            <p>{locale === 'zh-CN' ? '本轮分析' : 'Current analysis'}</p>
            <strong title={message}>{message || (locale === 'zh-CN' ? '等待输入' : 'Waiting for input')}</strong>
          </div>
          {attachments.length > 0 && <IconButton name={expanded ? 'chevron-up' : 'chevron-down'} label={locale === 'zh-CN' ? '展开参考图' : 'Toggle reference images'} onClick={() => setExpanded((value) => !value)} />}
        </div>
      </>}
      {!enhancedRequest && expanded && attachments.length > 0 && (
        <div className="workbench-analysis-panel__attachments">
          {attachments.map((attachment) => <img key={attachment.previewUrl} src={attachment.previewUrl} alt={attachment.name} />)}
        </div>
      )}
      <div ref={bodyRef} className="workbench-analysis-panel__body" aria-live="polite" aria-busy={streaming}>
        {task?.state === 'completed' && <p className="workbench-analysis-panel__state" role="status">{locale === 'zh-CN' ? '对话理解完成，可以生成设计稿。' : 'Conversation analysis complete. The design draft is ready to generate.'}</p>}
        {running && !visibleProgress && <div className="workbench-analysis-panel__streaming"><span /><span /><span /></div>}
        {visibleProgress ? <div className="workbench-analysis-panel__markdown">{blocks.map(renderAnalysisBlock)}{streaming && <span className="workbench-analysis-panel__streaming-caret" aria-hidden="true">▍</span>}</div> : !running && <p className="workbench-analysis-panel__empty">{locale === 'zh-CN' ? '发送需求后，这里会显示设计分析。' : 'Send a request to see the design analysis here.'}</p>}
        {failed && <div className="workbench-analysis-panel__error"><Icon name="circle-alert" size={15} /><span>{locale === 'zh-CN' ? '分析失败，当前线程仍可重试。' : 'Analysis failed. This thread can be retried.'}</span>{onRetry && <Button variant="ghost" icon="rotate-ccw" onClick={onRetry}>{locale === 'zh-CN' ? '重试' : 'Retry'}</Button>}</div>}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
      <div className="workbench-analysis-panel__footer">
        <Button className="workbench-analysis-panel__generate" aria-label={locale === 'zh-CN' ? '生成' : 'Generate'} variant="primary" icon="sparkles" disabled={!canGenerate} onClick={onGenerate}>{locale === 'zh-CN' ? '生成设计稿' : 'Generate draft'}</Button>
      </div>
    </aside>
  );
};
