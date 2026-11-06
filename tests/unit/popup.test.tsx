import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popup } from '../../src/popup/main';

const sendMessage = vi.fn();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sendMessage.mockReset();
});

function mountPopup() {
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: () => 'chrome-extension://feedbackpin/src/dashboard/index.html',
      sendMessage,
    },
  });
  return render(<Popup />);
}

describe('extension popup', () => {
  it('starts selection only after the user activates the button', async () => {
    sendMessage.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    mountPopup();

    expect(sendMessage).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: /select an element/i }),
    );

    expect(sendMessage).toHaveBeenCalledWith({ type: 'START_SELECTION' });
  });

  it('shows a recoverable error when the page cannot be selected', async () => {
    sendMessage.mockResolvedValue({
      ok: false,
      error: 'Not available on this page.',
    });
    const user = userEvent.setup();
    mountPopup();

    await user.click(
      screen.getByRole('button', { name: /select an element/i }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Not available on this page.',
    );
  });

  it('links directly to the local report dashboard', () => {
    mountPopup();

    expect(screen.getByRole('link', { name: /open inbox/i })).toHaveAttribute(
      'href',
      'chrome-extension://feedbackpin/src/dashboard/index.html',
    );
  });
});
