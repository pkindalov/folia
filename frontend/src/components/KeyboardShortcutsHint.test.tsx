import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeyboardShortcutsHint from './KeyboardShortcutsHint';

describe('KeyboardShortcutsHint', () => {
  test('is closed by default, showing only the trigger', () => {
    render(<KeyboardShortcutsHint />);
    expect(screen.getByRole('button', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('opens on click and lists all three shortcuts', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsHint />);

    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));

    const dialog = screen.getByRole('dialog', { name: 'Shortcuts for this volume' });
    expect(dialog).toHaveTextContent('Turn to the previous or next photo');
    expect(dialog).toHaveTextContent('Open the reaction picker');
    expect(dialog).toHaveTextContent('Pick a reaction');
  });

  test('closes via its own close button, outside click, and Escape', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <KeyboardShortcutsHint />
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    await user.click(screen.getByRole('button', { name: 'Close shortcuts' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('reports its open state through onOpenChange', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<KeyboardShortcutsHint onOpenChange={onOpenChange} />);

    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
