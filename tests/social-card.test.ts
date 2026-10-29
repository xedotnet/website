import { describe, expect, it } from 'vitest';
import {
  cardDate,
  cardTitle,
  socialCardAlt,
  socialCardPath,
} from '../src/lib/social-card';

describe('social cards', () => {
  it('formats Italian dates and ranges', () => {
    expect(cardDate(new Date('2026-05-22'))).toBe('22 maggio 2026');
    expect(cardDate(new Date('2026-05-22'), new Date('2026-05-23'))).toBe(
      '22 maggio 2026 – 23 maggio 2026',
    );
  });

  it('keeps short titles and truncates exceptionally long titles', () => {
    expect(cardTitle('Comunità & tecnologia')).toBe('Comunità & tecnologia');
    const result = cardTitle('Tecnologia '.repeat(40));
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThan(201);
  });

  it('describes cancelled events for screen readers', () => {
    expect(
      socialCardAlt({
        title: 'Tecnologia e comunità',
        date: '22 maggio 2026',
        cancelled: true,
      }),
    ).toBe('Tecnologia e comunità — 22 maggio 2026 — Evento annullato');
  });

  it('uses deterministic content-specific image paths', () => {
    const card = {
      title: 'Comunità',
      date: '22 maggio 2026',
      cancelled: false,
    };
    expect(socialCardPath('evento', card)).toBe(
      socialCardPath('evento', { ...card }),
    );
    expect(socialCardPath('evento', card)).not.toBe(
      socialCardPath('evento', { ...card, cancelled: true }),
    );
  });
});
