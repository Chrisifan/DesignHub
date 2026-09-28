import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { Locale } from '../i18n';
import type { View } from './types';
import { Icon, t } from './ui';

type StudioUserMenuProps = {
  locale: Locale;
  operatorName: string;
  avatarDataUrl?: string | null;
  currentView: View;
  onNavigate: (view: View) => void;
  onNewProject: () => void;
  onImportProject: () => void;
  newProjectDisabled?: boolean;
  importDisabled?: boolean;
};

type MenuItem = {
  view: View;
  icon: string;
  zh: string;
  en: string;
};

const groups: Array<{ zh: string; en: string; items: MenuItem[] }> = [
  {
    zh: '创作',
    en: 'Create',
    items: [
      { view: 'projects', icon: 'layout-grid', zh: '首页', en: 'Home' },
      { view: 'designers', icon: 'users', zh: '设计师', en: 'Designers' },
      { view: 'assets', icon: 'image', zh: '素材库', en: 'Assets' },
      { view: 'brands', icon: 'palette', zh: '品牌包', en: 'Brand kits' },
    ],
  },
  {
    zh: '模型',
    en: 'Models',
    items: [
      { view: 'connections', icon: 'plug', zh: '模型连接', en: 'Connections' },
      { view: 'tasks', icon: 'clock', zh: '模型任务', en: 'Model tasks' },
      { view: 'image-tools', icon: 'wand-sparkles', zh: '图像工具', en: 'Image tools' },
    ],
  },
  {
    zh: '管理',
    en: 'Manage',
    items: [
      { view: 'delivery', icon: 'download', zh: '导出交付', en: 'Delivery' },
      { view: 'storage', icon: 'hard-drive', zh: '工作区管理', en: 'Workspace' },
      { view: 'settings', icon: 'settings', zh: '设置', en: 'Settings' },
    ],
  },
];

export const StudioUserMenu = ({
  locale,
  operatorName,
  avatarDataUrl = null,
  currentView,
  onNavigate,
  onNewProject,
  onImportProject,
  newProjectDisabled = false,
  importDisabled = false,
}: StudioUserMenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const menuItems = (): HTMLButtonElement[] => (
    [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
  );
  const closeAndRestoreFocus = (): void => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open) return undefined;
    queueMicrotask(() => menuItems()[0]?.focus({ preventScroll: true }));
    const closeOutside = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeAndRestoreFocus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const chooseView = (view: View): void => {
    triggerRef.current?.focus({ preventScroll: true });
    onNavigate(view);
    setOpen(false);
  };
  const chooseAction = (action: () => void): void => {
    triggerRef.current?.focus({ preventScroll: true });
    action();
    setOpen(false);
  };
  const avatarText = (operatorName.trim() || 'S').slice(0, 1).toUpperCase();
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const items = menuItems();
    if (!items.length) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus({ preventScroll: true });
  };

  return (
    <div className="studio-user-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="studio-user-menu__trigger"
        aria-label={t(locale, '打开用户菜单', 'Open user menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setOpen(true);
          queueMicrotask(() => {
            const items = menuItems();
            items[event.key === 'ArrowUp' ? items.length - 1 : 0]?.focus({ preventScroll: true });
          });
        }}
      >
        {avatarDataUrl ? <img className="operator-avatar operator-avatar--image" src={avatarDataUrl} alt={t(locale, '用户头像', 'User avatar')} /> : <span className="operator-avatar">{avatarText}</span>}
      </button>
      {open ? (
        <div className="studio-user-menu__popover" role="menu" onKeyDown={onMenuKeyDown}>
          {groups.map((group) => (
            <div className="studio-user-menu__group" key={group.en}>
              <p>{t(locale, group.zh, group.en)}</p>
              {group.items.map((item) => (
                <button
                  type="button"
                  role="menuitem"
                  aria-current={item.view === currentView ? 'page' : undefined}
                  key={item.view}
                  onClick={() => chooseView(item.view)}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{t(locale, item.zh, item.en)}</span>
                  {item.view === currentView ? <Icon name="check" size={14} /> : null}
                </button>
              ))}
            </div>
          ))}
          <div className="studio-user-menu__group studio-user-menu__group--actions">
            <button type="button" role="menuitem" disabled={newProjectDisabled} onClick={() => chooseAction(onNewProject)}>
              <Icon name="plus" size={16} />
              <span>{t(locale, '新建项目', 'New project')}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={importDisabled}
              onClick={() => chooseAction(onImportProject)}
            >
              <Icon name="upload" size={16} />
              <span>{t(locale, '导入项目包', 'Import project package')}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
