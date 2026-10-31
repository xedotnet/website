import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import satori from 'satori';
import type { JSXNode, JSXElement } from 'satori/jsx';
import sharp from 'sharp';
import { formatCalendarDate } from './events';

function h(
  type: string,
  props: Record<string, unknown>,
  ...children: JSXNode[]
): JSXElement<Record<string, unknown>, string> {
  return { type, props: { ...props, children }, key: null };
}

export interface SocialCard {
  title: string;
  date?: string;
  cancelled?: boolean;
}

const logo = readFileSync('public/images/xe-logo-original.png'),
  font = readFileSync(
    'node_modules/@fontsource/manrope/files/manrope-latin-700-normal.woff',
  ),
  template = readFileSync('src/lib/social-card.ts'),
  logoData = `data:image/png;base64,${logo.toString('base64')}`;

export const defaultCard: SocialCard = {
  title: 'Condividiamo tecnologia dal 2006',
};

export function cardDate(start: Date, end?: Date): string {
  const first = formatCalendarDate(start),
    last = end && formatCalendarDate(end);
  return last && first !== last ? `${first} – ${last}` : first;
}

export function cardTitle(title: string): string {
  const normalized = title.replaceAll(/\s+/gu, ' ').trim();
  return normalized.length > 180
    ? `${normalized.slice(0, 179).trimEnd()}…`
    : normalized;
}

export function socialCardPath(slug: string, card: SocialCard): string {
  const hash = createHash('sha256')
    .update(template)
    .update(logo)
    .update(font)
    .update(JSON.stringify(card))
    .digest('hex')
    .slice(0, 12);
  return `/social/${slug}-${hash}.png`;
}

export async function renderSocialCard(card: SocialCard): Promise<Uint8Array> {
  const title = cardTitle(card.title),
    size = card.date
      ? title.length > 100
        ? 35
        : title.length > 65
          ? 42
          : 52
      : 52,
    svg = await satori(
      h(
        'div',
        {
          style: {
            display: 'flex',
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundColor: '#f6f8f9',
            color: '#171b1e',
            fontFamily: 'Manrope',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          },
        },
        h('div', {
          style: {
            position: 'absolute',
            display: 'flex',
            left: 0,
            top: 0,
            width: 18,
            height: '100%',
            backgroundColor: '#b4232c',
          },
        }),
        h('div', {
          style: {
            position: 'absolute',
            display: 'flex',
            right: 0,
            bottom: 0,
            width: 150,
            height: 150,
            backgroundColor: '#b4232c',
            opacity: 0.12,
            transform: 'rotate(45deg) translate(75px, 75px)',
          },
        }),
        h(
          'div',
          {
            style: {
              display: 'flex',
              width: 620,
              height: 530,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            },
          },
          h('img', {
            src: logoData,
            width: 162,
            height: 97,
            style: { objectFit: 'contain', marginBottom: 28 },
          }),
          h(
            'div',
            {
              style: {
                fontSize: size,
                lineHeight: 1.15,
                lineClamp: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 610,
              },
            },
            title,
          ),
          card.date
            ? h(
                'div',
                { style: { marginTop: 24, fontSize: 26, color: '#52616a' } },
                card.date,
              )
            : h(
                'div',
                { style: { marginTop: 26, fontSize: 25, color: '#b4232c' } },
                'xedotnet.com',
              ),
          card.cancelled
            ? h(
                'div',
                { style: { marginTop: 14, fontSize: 23, color: '#b4232c' } },
                'Evento annullato',
              )
            : null,
        ),
      ),
      {
        width: 1200,
        height: 630,
        fonts: [{ name: 'Manrope', data: font, weight: 700, style: 'normal' }],
      },
    );
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function eventSocialCard(
  event: import('./events').EventEntry,
): SocialCard {
  return {
    title: event.data.title,
    date: cardDate(event.data.date, event.data.endDate),
    cancelled: event.data.status === 'cancelled',
  };
}

export function socialCardAlt(card: SocialCard): string {
  return [
    card.title,
    card.date,
    card.cancelled ? 'Evento annullato' : undefined,
  ]
    .filter(Boolean)
    .join(' — ');
}
