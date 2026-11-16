'use client';

import { useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, RefreshCw, X } from 'lucide-react';
import styles from './ConfirmDialog.module.css';

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isProcessing = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape' && !isProcessing && onClose) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  let Icon = AlertTriangle;
  let iconWrapperClass = styles.iconWrapperDanger;
  let confirmButtonClass = styles.confirmButtonDanger;

  if (variant === 'warning') {
    Icon = AlertCircle;
    iconWrapperClass = styles.iconWrapperWarning;
    confirmButtonClass = styles.confirmButtonWarning;
  } else if (variant === 'info') {
    Icon = Info;
    iconWrapperClass = styles.iconWrapperInfo;
    confirmButtonClass = styles.confirmButtonPrimary;
  }

  function handleOverlayClick() {
    if (!isProcessing && onClose) {
      onClose();
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className={styles.headerRow}>
          <div className={iconWrapperClass}>
            <Icon size={20} />
          </div>

          <div className={styles.content}>
            <h2 id="confirm-dialog-title" className={styles.title}>
              {title}
            </h2>
            {description ? (
              <p className={styles.description}>{description}</p>
            ) : null}
          </div>

          {!isProcessing && onClose ? (
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isProcessing}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={confirmButtonClass}
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={13} className={styles.spinner} />
                <span>Processing…</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

