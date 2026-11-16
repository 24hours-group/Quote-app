import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination, getPageNumbers } from '@/features/admin/components/Pagination';

describe('getPageNumbers helper', () => {
  it('returns all pages when totalPages <= 7', () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('truncates tail when on first pages (currentPage <= 4)', () => {
    expect(getPageNumbers(2, 10)).toEqual([1, 2, 3, 4, 5, '...', 10]);
  });

  it('truncates head when on last pages (currentPage >= totalPages - 3)', () => {
    expect(getPageNumbers(8, 10)).toEqual([1, '...', 6, 7, 8, 9, 10]);
  });

  it('truncates both sides when in the middle', () => {
    expect(getPageNumbers(6, 12)).toEqual([1, '...', 5, 6, 7, '...', 12]);
  });
});

describe('Pagination component', () => {
  it('renders nothing when totalItems is 0', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalItems={0}
        pageSize={10}
        onPageChange={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders summary information accurately', () => {
    render(
      <Pagination
        currentPage={2}
        totalItems={45}
        pageSize={10}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('disables previous button on first page and enables next button', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={30}
        pageSize={10}
        onPageChange={vi.fn()}
      />,
    );

    const prevBtn = screen.getByRole('button', { name: 'Previous page' });
    const nextBtn = screen.getByRole('button', { name: 'Next page' });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();
  });

  it('disables next button on last page and enables previous button', () => {
    render(
      <Pagination
        currentPage={3}
        totalItems={30}
        pageSize={10}
        onPageChange={vi.fn()}
      />,
    );

    const prevBtn = screen.getByRole('button', { name: 'Previous page' });
    const nextBtn = screen.getByRole('button', { name: 'Next page' });

    expect(prevBtn).toBeEnabled();
    expect(nextBtn).toBeDisabled();
  });

  it('calls onPageChange when clicking next and previous', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalItems={30}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    );

    const prevBtn = screen.getByRole('button', { name: 'Previous page' });
    const nextBtn = screen.getByRole('button', { name: 'Next page' });

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange when clicking a specific page button', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalItems={30}
        pageSize={10}
        onPageChange={onPageChange}
      />,
    );

    const page2Btn = screen.getByRole('button', { name: 'Page 2' });
    fireEvent.click(page2Btn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders and responds to page size selector when onPageSizeChange is provided', () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        pageSizeOptions={[10, 25, 50]}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Select items per page' });
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: '25' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});

