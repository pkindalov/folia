import { useRef, type MouseEvent, type ReactNode } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';
import useEscapeKey from '../hooks/useEscapeKey';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** id of an element (e.g. the modal's heading) that names it for screen readers. */
  labelledBy?: string;
  children: ReactNode;
};

/** Centered overlay modal — closes on Escape or a backdrop click, traps focus while open. */
export default function Modal({ isOpen, onClose, labelledBy, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-primary/20 backdrop-blur-md p-gutter"
      onClick={onBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="bg-surface-container-lowest w-full max-w-xl p-8 md:p-12 rounded-panel paper-depth border border-outline-variant/40 max-h-[90vh] overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}
