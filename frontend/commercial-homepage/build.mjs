import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const load = relative => readFile(new URL(relative, import.meta.url), 'utf8');
const fingerprint = text => createHash('sha256').update(text).digest('hex').slice(0, 16);

// Render serves index.html for unknown paths. Keep the built app entry intact
// for deep links and deliver the independently authored homepage only at home.
export function commercialHomepage() {
  let commercial = false;
  return {
    name: 'commercial-homepage',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { commercial = config.env.VITE_STUDIO_DEPLOYMENT === 'commercial'; },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        if (!commercial) return;
        const [snapshot, typography, surfaces, entry] = await Promise.all([
          load('./homepage.html'), load('../src/styles/urbanist.css'),
          load('../src/saas/commercialPublicSurface.css'), load('./entry.js'),
        ]);
        const page = snapshot.replace('</head>', () => `<style>${typography}\n${surfaces}</style></head>`);
        const homePath = `assets/commercial-home-${fingerprint(page)}.html`;
        const entryPath = `assets/commercial-entry-${fingerprint(entry)}.js`;
        this.emitFile({ type: 'asset', fileName: homePath, source: page });
        this.emitFile({ type: 'asset', fileName: entryPath, source: entry });

        const index = bundle['index.html'];
        const assets = [];
        const viteTags = /<script\b[^>]*\btype="module"[^>]*\bsrc="[^"]+"[^>]*><\/script>|<link\b[^>]*\brel="(?:modulepreload|stylesheet)"[^>]*>/g;
        const shell = String(index.source).replace(viteTags, tag => { assets.push(tag); return ''; });
        if (!assets.some(tag => tag.startsWith('<script'))) this.error('The commercial app entry is missing from the Vite build.');
        index.source = shell.replace('</body>', () => `<template id="studio-app-assets" data-home="/${homePath}">${assets.join('\n')}</template>
    <script type="module" src="/${entryPath}"></script>
    <noscript><a href="/${homePath}">Explore Studio X OS</a></noscript></body>`);
      },
    },
  };
}
