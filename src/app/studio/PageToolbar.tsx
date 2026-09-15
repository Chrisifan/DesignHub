import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type PageToolbarContextValue = {
  target: HTMLElement | null;
  setTarget: (target: HTMLElement | null) => void;
};

const PageToolbarTarget = createContext<PageToolbarContextValue | null>(null);

export const PageToolbarProvider = ({ children }: { children: ReactNode }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  return (
    <PageToolbarTarget.Provider value={{ target, setTarget }}>
      {children}
    </PageToolbarTarget.Provider>
  );
};

const PageToolbarHostContent = ({ children }: { children?: ReactNode }) => {
  const toolbar = useContext(PageToolbarTarget);

  if (!toolbar) return null;

  return (
    <div ref={toolbar.setTarget} className="toolbar-actions">
      {children}
    </div>
  );
};

export const PageToolbarHost = ({ children }: { children?: ReactNode }) => {
  const toolbar = useContext(PageToolbarTarget);

  if (toolbar) return <PageToolbarHostContent>{children}</PageToolbarHostContent>;

  return <PageToolbarProvider><PageToolbarHostContent>{children}</PageToolbarHostContent></PageToolbarProvider>;
};

export const PageToolbarSlot = ({
  active,
  children,
}: {
  active: boolean;
  children?: ReactNode;
}) => {
  const toolbar = useContext(PageToolbarTarget);

  if (!active) return null;
  return toolbar?.target ? createPortal(children, toolbar.target) : <>{children}</>;
};
