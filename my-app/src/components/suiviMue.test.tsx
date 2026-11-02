// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SuiviMue from './suiviMue';

describe('Composant SuiviMue', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche le composant et le statut initial', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/api/mue/historique')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as Response);
    });

    render(<SuiviMue />);

    expect(await screen.findByText('Suivi de la Mue')).toBeTruthy();
    expect(screen.getByText('Aucune mue en cours')).toBeTruthy();
  });

  it('déclenche le démarrage d\'une mue au clic sur le bouton', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) => {
      if (String(url).includes('/api/mue/demarrer') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id_mue: 1, statut: 'EN_COURS' }) } as Response);
      }
      if (String(url).includes('/api/mue/historique')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) } as Response);
    });

    render(<SuiviMue />);

    const bouton = await screen.findByText('Déclarer une mue');
    fireEvent.click(bouton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/mue/demarrer', { method: 'POST' });
    });
  });

});