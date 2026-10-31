import { getCollection } from 'astro:content';
import { eventSlug } from '../../lib/events';
import {
  defaultCard,
  eventSocialCard,
  renderSocialCard,
  socialCardPath,
} from '../../lib/social-card';
import type { SocialCard } from '../../lib/social-card';

export async function getStaticPaths() {
  const events = await getCollection('events', ({ data }) => !data.draft);
  const cards = [
    { slug: 'xe', card: defaultCard },
    ...events.map((event) => ({
      slug: eventSlug(event),
      card: eventSocialCard(event),
    })),
  ];
  return cards.map(({ slug, card }) => ({
    params: {
      name: socialCardPath(slug, card).slice('/social/'.length, -'.png'.length),
    },
    props: { card },
  }));
}

export async function GET({ props }: { props: { card: SocialCard } }) {
  const image = await renderSocialCard(props.card);
  return new Response(Uint8Array.from(image).buffer, {
    headers: { 'Content-Type': 'image/png' },
  });
}
