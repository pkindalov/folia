import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';

describe('Pagination', () => {
  test('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when there are no pages', () => {
    const { container } = render(<Pagination page={1} totalPages={0} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders a button per page and marks the current one', () => {
    render(<Pagination page={2} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 3' })).not.toHaveAttribute('aria-current');
  });

  test('disables Previous on the first page and Next on the last page', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
  });

  test('calls onPageChange with the clicked page number', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={1} totalPages={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  test('Next and Previous step relative to the current page', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={2} totalPages={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  test('collapses a large page count into first/last plus neighbors of the current page', () => {
    render(<Pagination page={50} totalPages={200} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 49' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 50' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 51' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 200' })).toBeInTheDocument();

    // Only the numbered buttons above, plus Previous/Next, should render —
    // not one button per page.
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.queryByRole('button', { name: 'Page 2' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Page 199' })).not.toBeInTheDocument();
  });

  test('does not collapse pages near either end of a large page count', () => {
    render(<Pagination page={2} totalPages={200} onPageChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 200' })).toBeInTheDocument();
    // Only one ellipsis is needed — the gap toward the end.
    expect(screen.getAllByText('…')).toHaveLength(1);
  });
});
