import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md'
}) => {
  // Handle ESC key to close dialog
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-white rounded-xl shadow-2xl ${maxWidthClasses[maxWidth]} w-full transform transition-all`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - only show if title is provided */}
          {title ? (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close dialog"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
          ) : (
            /* Close button only when no title */
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors z-10"
              aria-label="Close dialog"
            >
              <X size={20} className="text-gray-500" />
            </button>
          )}

          {/* Content */}
          <div className="px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dialog;
