import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import PichaFlowUpload from './PichaFlowUpload.svelte';

describe('PichaFlowUpload (Svelte)', () => {
  it('renders the upload drop zone', () => {
    render(PichaFlowUpload, {
      props: {
        apiKey: 'test',
      }
    });
    // Component renders a drag-and-drop zone — no <button>
    expect(screen.getByText(/drag & drop/i)).toBeDefined();
  });

  it('accepts an apiKey prop without crashing', () => {
    const { container } = render(PichaFlowUpload, {
      props: { apiKey: 'sk_test_123' }
    });
    expect(container.firstChild).toBeTruthy();
  });
});
