import { useEffect, type MouseEvent, type ReactNode } from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Centered overlay modal — closes on Escape or a backdrop click. */
export default function Modal({ isOpen, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-primary/20 backdrop-blur-md p-gutter"
      onClick={onBackdropClick}
    >
      <div className="bg-surface-container-lowest w-full max-w-xl p-8 md:p-12 rounded-panel paper-depth border border-outline-variant/40 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
