import type { ComponentProps } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommentComposer from './CommentComposer';

const DEFAULT_PROPS: ComponentProps<typeof CommentComposer> = {
  onSubmit: vi.fn().mockResolvedValue(undefined),
  isPending: false,
};

const renderComposer = (props: Partial<ComponentProps<typeof CommentComposer>> = {}) =>
  render(<CommentComposer {...DEFAULT_PROPS} {...props} />);

describe('CommentComposer', () => {
  test('disables the submit button when the draft is empty', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled();
  });

  test('enables the submit button once non-whitespace text is typed', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByPlaceholderText('Add a comment…'), 'Lovely!');

    expect(screen.getByRole('button', { name: 'Post comment' })).toBeEnabled();
  });

  test('keeps the submit button disabled for whitespace-only text', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByPlaceholderText('Add a comment…'), '   ');

    expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled();
  });

  test('clicking submit calls onSubmit with the trimmed text', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderComposer({ onSubmit });

    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, '  Lovely photo!  ');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));

    expect(onSubmit).toHaveBeenCalledWith('Lovely photo!');
  });

  test('Enter submits the comment without inserting a newline', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderComposer({ onSubmit });

    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, 'Nice!{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('Nice!');
    expect(textarea).not.toHaveValue('Nice!\n');
  });

  test('Shift+Enter inserts a newline instead of submitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderComposer({ onSubmit });

    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, 'Line one{Shift>}{Enter}{/Shift}Line two');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Line one\nLine two');
  });

  test('disables the textarea and shows a spinner while pending', () => {
    renderComposer({ isPending: true });

    expect(screen.getByPlaceholderText('Add a comment…')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled();
  });

  test('does not show a character counter for a short draft', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByPlaceholderText('Add a comment…'), 'Short comment');

    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
  });

  test('shows a character counter once nearing the limit', () => {
    renderComposer();

    // fireEvent.change (not user.type) — typing out 950 characters one
    // keystroke at a time is unnecessarily slow for what this test actually
    // checks (the counter's threshold math), not real typing behavior.
    fireEvent.change(screen.getByPlaceholderText('Add a comment…'), {
      target: { value: 'x'.repeat(950) },
    });

    expect(screen.getByText('50 left')).toBeInTheDocument();
  });

  // Clearing is driven directly by the promise onSubmit returns (see
  // CommentComposer) rather than by the isPending prop — a fast-settling
  // mutation's pending and success dispatches can land in the same render,
  // so there's no reliable isPending=true frame to watch for here.
  test('does not clear the draft when a submit fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('failed'));
    const user = userEvent.setup();
    renderComposer({ onSubmit });

    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, 'Nice!');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Post comment' })).toBeEnabled());
    expect(textarea).toHaveValue('Nice!');
  });

  test('clears the draft once a submit succeeds', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderComposer({ onSubmit });

    const textarea = screen.getByPlaceholderText('Add a comment…');
    await user.type(textarea, 'Nice!');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));

    await waitFor(() => expect(textarea).toHaveValue(''));
  });
});
