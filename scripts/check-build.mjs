import { existsSync, globSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import * as cheerio from 'cheerio';
import {
  deploymentConfig,
  isSitemapExcluded,
  resolveSiteUrl,
} from '../src/lib/deployment.mjs';

const publicUrl = resolveSiteUrl(),
  { site, base } = deploymentConfig(publicUrl),
  errors = [];

function outputPath(pathname) {
  const relativePath = decodeURIComponent(pathname.slice(base.length));
  if (!relativePath || relativePath.endsWith('/')) {
    return join('dist', relativePath, 'index.html');
  }
  if (!extname(relativePath)) {
    return join('dist', relativePath, 'index.html');
  }
  return join('dist', relativePath);
}

function inspectUrl(value, file, attribute) {
  if (
    !value ||
    value.startsWith('#') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('data:')
  ) {
    return;
  }

  let url;
  try {
    url = new URL(value, `${site}${base}`);
  } catch {
    errors.push(`${file}: invalid ${attribute}: ${value}`);
    return;
  }
  if (url.origin !== site) {
    return;
  }
  if (!url.pathname.startsWith(base)) {
    errors.push(`${file}: ${attribute} leaves the base path ${base}: ${value}`);
    return;
  }
  const target = outputPath(url.pathname);
  if (!existsSync(target)) {
    errors.push(
      `${file}: missing destination for ${attribute}=${value} (${target})`,
    );
  }
}

const htmlFiles = globSync('dist/**/*.html');
for (const file of htmlFiles) {
  const $ = cheerio.load(readFileSync(file, 'utf8'));
  const ogImage = $('meta[property="og:image"]').attr('content'),
    twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (!ogImage && $('meta[http-equiv="refresh"]').length > 0) {
    // Redirect pages delegate their preview metadata to the destination.
  } else if (!ogImage || !ogImage.startsWith(`${site}${base}`)) {
    errors.push(`${file}: missing or invalid absolute og:image`);
  } else {
    inspectUrl(ogImage, file, 'og:image');
    if (twitterImage !== ogImage) {
      errors.push(`${file}: Twitter and Open Graph images differ`);
    }
    const imagePath = outputPath(new URL(ogImage).pathname);
    if (
      existsSync(imagePath) &&
      new URL(ogImage).pathname.includes('/social/')
    ) {
      const png = readFileSync(imagePath);
      if (
        png.length < 24 ||
        png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        png.readUInt32BE(16) !== 1200 ||
        png.readUInt32BE(20) !== 630
      ) {
        errors.push(`${file}: sharing image is not a 1200x630 PNG`);
      }
      if (!$('meta[property="og:image:alt"]').attr('content')) {
        errors.push(`${file}: missing sharing image alternative text`);
      }
    }
  }
  $('[href], [src], [poster]').each((_index, element) => {
    for (const attribute of ['href', 'src', 'poster']) {
      inspectUrl($(element).attr(attribute), file, attribute);
    }
  });
}

const robots = readFileSync('dist/robots.txt', 'utf8'),
  expectedSitemap = `${site}${base}sitemap-index.xml`;
if (!robots.includes(expectedSitemap)) {
  errors.push(`robots.txt does not contain ${expectedSitemap}`);
}

for (const file of globSync('dist/sitemap*.xml')) {
  const sitemap = readFileSync(file, 'utf8'),
    locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
  for (const location of locations) {
    const url = new URL(location);
    if (url.origin !== site || !url.pathname.startsWith(base)) {
      errors.push(`${file}: URL outside ${site}${base}: ${location}`);
    }
    if (isSitemapExcluded(url.pathname, base)) {
      errors.push(`${file}: excluded URL present in sitemap: ${location}`);
    }
  }
}

const rssPath = join('dist', 'rss.xml');
if (existsSync(rssPath)) {
  const rss = readFileSync(rssPath, 'utf8'),
    rssLinks = [
      ...[...rss.matchAll(/<link>(.*?)<\/link>/g)].map((match) => match[1]),
      ...[...rss.matchAll(/<atom:link\s+href="(.*?)"/g)].map(
        (match) => match[1],
      ),
    ];
  for (const link of rssLinks) {
    inspectUrl(link, rssPath, 'rss-link');
  }
} else {
  errors.push('dist/rss.xml does not exist');
}

const graziePath = join('dist', 'grazie', 'index.html');
if (existsSync(graziePath)) {
  const grazie = readFileSync(graziePath, 'utf8');
  if (!grazie.includes('content="noindex, nofollow"')) {
    errors.push('dist/grazie/index.html does not contain the noindex metadata');
  }
}

const rootLlmsPath = join('dist', 'llms.txt');
if (!existsSync(rootLlmsPath)) {
  errors.push('dist/llms.txt is missing');
}
for (const file of globSync('dist/**/llms.txt')) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(
    /\]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/gu,
  )) {
    inspectUrl(match[1], file, 'markdown-link');
  }
}

if (errors.length > 0) {
  console.error(errors.slice(0, 30).join('\n'));
  if (errors.length > 30) {
    console.error(`...and ${errors.length - 30} more errors.`);
  }
  process.exit(1);
}

console.log(`Verified ${htmlFiles.length} documents for ${site}${base}`);
