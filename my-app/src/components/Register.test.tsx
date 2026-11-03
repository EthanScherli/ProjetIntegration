// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import Register from './Register';

const remplirFormulaire = (pseudo: string, email: string, mdp: string, confirmation: string) => {
  fireEvent.change(screen.getByLabelText('Pseudo'), { target: { value: pseudo } });
  fireEvent.change(screen.getByLabelText('Adresse email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: mdp } });
  fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: confirmation } });
};

const soumettre = () => {
  fireEvent.click(screen.getByText("S'inscrire"));
};

describe('Composant Register (US 3.1)', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche le formulaire d\'inscription', () => {
    render(<Register />);

    expect(screen.getByText('Créer un compte')).toBeTruthy();
    expect(screen.getByLabelText('Pseudo')).toBeTruthy();
    expect(screen.getByLabelText('Adresse email')).toBeTruthy();
    expect(screen.getByLabelText('Mot de passe')).toBeTruthy();
    expect(screen.getByLabelText('Confirmer le mot de passe')).toBeTruthy();
    expect(screen.getByText("S'inscrire")).toBeTruthy();
  });

  it('refuse un email invalide', () => {
    render(<Register />);

    const champEmail = screen.getByLabelText('Adresse email') as HTMLInputElement;
    fireEvent.change(champEmail, { target: { value: 'pas-un-email' } });

    expect(champEmail.type).toBe('email');
    expect(champEmail.checkValidity()).toBe(false);

    fireEvent.change(champEmail, { target: { value: 'test@exemple.com' } });
    expect(champEmail.checkValidity()).toBe(true);
  });

  it('refuse l\'inscription si les mots de passe ne correspondent pas', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<Register />);

    remplirFormulaire('serpent', 'test@exemple.com', 'motdepasse1', 'motdepasse2');
    soumettre();

    expect(await screen.findByText('Les mots de passe ne correspondent pas.')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe de moins de 6 caractères', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<Register />);

    remplirFormulaire('serpent', 'test@exemple.com', 'abc', 'abc');
    soumettre();

    expect(await screen.findByText('Le mot de passe doit contenir au moins 6 caractères.')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envoie les données au serveur et affiche un message de confirmation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: '1', pseudo: 'serpent', mail: 'test@exemple.com' }),
    } as Response);
    render(<Register />);

    remplirFormulaire('serpent', 'test@exemple.com', 'motdepasse', 'motdepasse');
    soumettre();

    expect(await screen.findByText('Inscription réussie ! Vous pouvez maintenant vous connecter.')).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledWith('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo: 'serpent', mail: 'test@exemple.com', mdp: 'motdepasse' }),
    });
    expect((screen.getByLabelText('Pseudo') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Mot de passe') as HTMLInputElement).value).toBe('');
  });

  it('affiche l\'erreur renvoyée par le serveur si l\'email est déjà utilisé', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'Cet email est déjà utilisé.' }),
    } as Response);
    render(<Register />);

    remplirFormulaire('serpent', 'test@exemple.com', 'motdepasse', 'motdepasse');
    soumettre();

    expect(await screen.findByText('Cet email est déjà utilisé.')).toBeTruthy();
  });

  it('affiche une erreur si le serveur est injoignable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    render(<Register />);

    remplirFormulaire('serpent', 'test@exemple.com', 'motdepasse', 'motdepasse');
    soumettre();

    await waitFor(() => {
      expect(screen.getByText('Impossible de joindre le serveur.')).toBeTruthy();
    });
  });

});
