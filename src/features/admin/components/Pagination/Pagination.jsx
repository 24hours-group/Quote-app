'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Pagination.module.css';

export function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      '...',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50],
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems === 0) {
    return null;
  }

  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);
  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  function handlePrevious() {
    if (safeCurrentPage > 1 && onPageChange) {
      onPageChange(safeCurrentPage - 1);
    }
  }

  function handleNext() {
    if (safeCurrentPage < totalPages && onPageChange) {
      onPageChange(safeCurrentPage + 1);
    }
  }

  return (
    <nav className={styles.container} aria-label="Pagination Navigation">
      <div className={styles.summaryWrap}>
        <span className={styles.summaryText}>
          Showing <strong className={styles.summaryHighlight}>{startItem}</strong> to{' '}
          <strong className={styles.summaryHighlight}>{endItem}</strong> of{' '}
          <strong className={styles.summaryHighlight}>{totalItems}</strong> entries
        </span>

        {onPageSizeChange && pageSizeOptions?.length > 1 ? (
          <div className={styles.pageSizeWrap}>
            <label htmlFor="pageSizeSelect" className={styles.pageSizeLabel}>
              Per page:
            </label>
            <select
              id="pageSizeSelect"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={styles.pageSizeSelect}
              aria-label="Select items per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className={styles.navGroup}>
        <button
          type="button"
          onClick={handlePrevious}
          disabled={safeCurrentPage <= 1}
          className={styles.arrowButton}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          <span className={styles.arrowLabel}>Prev</span>
        </button>

        <div className={styles.pageButtons}>
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className={styles.ellipsis}
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isActive = page === safeCurrentPage;
            return (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange && onPageChange(page)}
                className={`${styles.pageButton} ${
                  isActive ? styles.pageButtonActive : styles.pageButtonInactive
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Page ${page}`}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={safeCurrentPage >= totalPages}
          className={styles.arrowButton}
          aria-label="Next page"
        >
          <span className={styles.arrowLabel}>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}

