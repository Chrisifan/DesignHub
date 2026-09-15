import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const PageToolbarTarget = createContext<HTMLElement | null>(null);

export const PageToolbarHost = ({ children }: { children?: ReactNode }) => {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);

  return (
    <PageToolbarTarget.Provider value={target}>
      <div ref={setTarget} className="toolbar-actions">
        {children}
      </div>
    </PageToolbarTarget.Provider>
  );
};

export const PageToolbarSlot = ({
  active,
  children,
}: {
  active: boolean;
  children?: ReactNode;
}) => {
  const target = useContext(PageToolbarTarget);

  return active && target ? createPortal(children, target) : null;
};
