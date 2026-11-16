import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog/ConfirmDialog';

describe('ConfirmDialog component', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConfirmDialog
        isOpen={false}
        title="Delete Item"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog contents when isOpen is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Callback Request"
        description="Are you sure you want to remove this lead?"
        confirmLabel="Delete Lead"
        cancelLabel="Keep Lead"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Callback Request')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to remove this lead?'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Lead' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep Lead' })).toBeInTheDocument();
  });

  it('triggers onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Callback Request"
        confirmLabel="Delete Lead"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete Lead' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('triggers onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Callback Request"
        cancelLabel="Cancel Action"
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel Action' }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('triggers onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Callback Request"
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows processing state and disables buttons while processing', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Callback Request"
        isProcessing={true}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

