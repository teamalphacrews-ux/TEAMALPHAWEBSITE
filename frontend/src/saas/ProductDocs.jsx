import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronDown, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { DOC_CATEGORIES, DOC_GUIDES } from './productDocsContent';
import { PRODUCT_SCREENSHOTS } from './productScreenshotCatalog';
import './productDocs.css';
import './commercialPublicSurface.css';

const screenshotThemeKey = 'studio-x-os-docs-screenshot-theme';
const docsLogo = '/assets/studio-x-os/lockup-white-640-20261108.webp';
const screenshots = Array.isArray(PRODUCT_SCREENSHOTS) ? PRODUCT_SCREENSHOTS : Object.values(PRODUCT_SCREENSHOTS || {});
const screenshotById = new Map(screenshots.map(screenshot => [screenshot.id, screenshot]));
const categoryById = new Map(DOC_CATEGORIES.map(category => [category.id, category]));
const guideBySlug = new Map(DOC_GUIDES.map(guide => [guide.slug, guide]));
const normalize = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const searchableGuide = guide => normalize([
  guide.title, guide.summary, categoryById.get(guide.category)?.title,
  ...(guide.prerequisites || []), ...(guide.outcome || []),
  ...guide.sections.flatMap(section => [section.title, ...(section.paragraphs || []), ...(section.tips || []), ...(section.steps || []).flatMap(step => [step.title, step.body]), section.screenshot?.caption]),
].join(' '));
const guideSearch = new Map(DOC_GUIDES.map(guide => [guide.slug, searchableGuide(guide)]));
const readImageTheme = () => { try { return localStorage.getItem(screenshotThemeKey) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };

function docsRoute() {
  const pathname = typeof window === 'undefined' ? '/docs' : window.location.pathname;
  const base = pathname.startsWith('/studio-os/docs') ? '/studio-os/docs' : '/docs';
  const rawSlug = pathname.slice(base.length).replace(/^\/+|\/+$/g, '');
  let slug;
  try { slug = decodeURIComponent(rawSlug); } catch { slug = rawSlug; }
  return { base, slug };
}

function Toc({ guide, mobile = false }) {
  const links = <ol>{guide.sections.map(section => <li key={section.id}><a href={'#' + encodeURIComponent(section.id)}>{section.title}</a></li>)}</ol>;
  return mobile ? <details className="docs-mobile-toc"><summary>On this page<ChevronDown size={17} aria-hidden="true" /></summary><nav aria-label="On this page">{links}</nav></details> : <nav className="docs-toc" aria-label="On this page"><h2>On this page</h2>{links}</nav>;
}

function GuideScreenshot({ screenshot, theme, onThemeChange }) {
  const entry = screenshotById.get(screenshot.id);
  const [failedSource, setFailedSource] = useState('');
  if (!entry) return <p className="docs-image-unavailable" role="status">The screenshot for this step is unavailable. You can still follow the written steps above.</p>;
  const resolvedTheme = entry[theme]?.desktop ? theme : entry.light?.desktop ? 'light' : 'dark';
  const variant = entry[resolvedTheme];
  if (!variant?.desktop) return <p className="docs-image-unavailable" role="status">The screenshot for this step is unavailable. You can still follow the written steps above.</p>;
  const fullSize = variant.desktop2x || variant.desktop;
  const desktopSrcSet = variant.desktop2x ? `${variant.desktop} ${entry.width}w, ${variant.desktop2x} ${entry.width * 2}w` : undefined;
  const alt = String(screenshot.alt || entry.alt || entry.title).replace(/[.!?]$/, '') + `. ${resolvedTheme === 'dark' ? 'Dark' : 'Light'} appearance. Sample data.`;
  return <figure className="docs-screenshot" data-docs-screenshot={entry.id}>
    <div className="docs-screenshot-toolbar"><span>{entry.title}</span><div className="docs-screenshot-theme" role="group" aria-label={'Screenshot appearance: ' + entry.title}>
      {['light', 'dark'].map(mode => <button key={mode} type="button" onClick={() => onThemeChange(mode)} aria-pressed={resolvedTheme === mode} disabled={!entry[mode]?.desktop}>{mode === 'light' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}{mode === 'light' ? 'Light' : 'Dark'}</button>)}
    </div></div>
    {failedSource === variant.desktop ? <div className="docs-image-error" role="status"><p>This screenshot could not load.</p><a href={fullSize} target="_blank" rel="noreferrer">Open the image directly<ArrowUpRight size={16} aria-hidden="true" /></a></div> : <picture>
      {variant.mobile2x && <source media="(max-width: 640px)" srcSet={variant.mobile2x} width={entry.mobileWidth || undefined} height={entry.mobileHeight || undefined} />}
      <img src={variant.desktop} srcSet={desktopSrcSet} sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 959px) calc(100vw - 48px), (max-width: 1199px) calc(100vw - 304px), 800px" width={entry.width} height={entry.height} alt={alt} loading="lazy" decoding="async" onError={() => setFailedSource(variant.desktop)} />
    </picture>}
    <figcaption><span className="docs-sample-label">Sample data</span><span>{screenshot.caption || entry.description}</span><a className={variant.mobile2x ? 'docs-full-size docs-full-desktop' : 'docs-full-size'} href={fullSize} target="_blank" rel="noreferrer">Open full size<ArrowUpRight size={15} aria-hidden="true" /></a>{variant.mobile2x && <a className="docs-full-size docs-full-mobile" href={variant.mobile2x} target="_blank" rel="noreferrer">Open full size<ArrowUpRight size={15} aria-hidden="true" /></a>}</figcaption>
  </figure>;
}

function GuideLink({ guide, base, compact = false }) {
  return <a className={compact ? 'docs-guide-link is-compact' : 'docs-guide-link'} href={`${base}/${encodeURIComponent(guide.slug)}`}><div><h3>{guide.title}</h3>{!compact && <p>{guide.summary}</p>}</div><ArrowUpRight size={19} aria-hidden="true" /></a>;
}

export default function ProductDocs() {
  const { base, slug } = docsRoute();
  const homeHref = base === '/studio-os/docs' ? '/studio-os' : '/';
  const guide = guideBySlug.get(slug);
  const isHub = !slug;
  const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(() => params?.get('q') || '');
  const [category, setCategory] = useState(() => categoryById.has(params?.get('category')) ? params.get('category') : 'all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [imageTheme, setImageTheme] = useState(readImageTheme);
  const menuButton = useRef(null), searchInput = useRef(null), resultsStatus = useRef(null);
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const filteredGuides = DOC_GUIDES.filter(item => (category === 'all' || item.category === category) && terms.every(term => guideSearch.get(item.slug).includes(term)));
  const pageTitle = isHub ? 'Guides · Studio X OS' : guide ? `${guide.title} · Studio X OS Guides` : 'Guide not found · Studio X OS';

  useEffect(() => {
    // Guide articles mount after route loading, including when opened from the workspace.
    const section = guide?.sections.find(item => '#' + item.id === window.location.hash);
    if (section) document.getElementById(section.id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [guide]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = pageTitle;
    let description = document.querySelector('meta[name="description"]');
    const created = !description, previousDescription = description?.getAttribute('content');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.appendChild(description); }
    description.content = guide?.summary || 'Step-by-step Studio X OS guides for studio owners, teams and clients, with screenshots and clear instructions.';
    return () => {
      document.title = previousTitle;
      if (created) description.remove();
      else if (previousDescription === null) description.removeAttribute('content');
      else description.setAttribute('content', previousDescription);
    };
  }, [pageTitle, guide]);
  useEffect(() => { try { localStorage.setItem(screenshotThemeKey, imageTheme); } catch { /* Screenshot controls still work without storage. */ } }, [imageTheme]);
  useEffect(() => {
    if (!isHub) return;
    const search = new URLSearchParams();
    if (query.trim()) search.set('q', query.trim());
    if (category !== 'all') search.set('category', category);
    const next = search.toString();
    window.history.replaceState(window.history.state, '', base + (next ? '?' + next : '') + window.location.hash);
  }, [base, isHub, query, category]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = event => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menuOpen]);

  const chooseCategory = id => {
    setCategory(id);
    setMenuOpen(false);
    if (menuOpen) requestAnimationFrame(() => resultsStatus.current?.focus({ preventScroll: true }));
  };
  const clearSearch = () => { setQuery(''); setCategory('all'); searchInput.current?.focus(); };
  const currentIndex = guide ? DOC_GUIDES.findIndex(item => item.slug === guide.slug) : -1;
  const previousGuide = DOC_GUIDES[currentIndex - 1], nextGuide = guide ? DOC_GUIDES[currentIndex + 1] : null;
  const related = guide ? [...new Set(guide.related || [])].map(item => guideBySlug.get(item)).filter(item => item && item.slug !== guide.slug) : [];

  return <div className="studio-docs" data-docs-view={isHub ? 'hub' : guide ? 'guide' : 'not-found'}>
    <a className="docs-skip" href="#docs-main">Skip to guide content</a>
    <header className="docs-header"><div className="docs-header-inner">
      <div className="docs-header-identity"><a className="docs-brand" href={homeHref} aria-label="Studio X OS home"><img src={docsLogo} alt="Studio X OS" width="640" height="213" decoding="async" /></a><a className="docs-wordmark" href={base} aria-current={isHub ? 'page' : undefined}>Guides</a></div>
      <nav className="docs-header-links" aria-label="Guide navigation"><a href={base + '#docs-search'}><Search size={16} aria-hidden="true" />Search guides</a><a href={homeHref}>Back to website<ArrowUpRight size={16} aria-hidden="true" /></a></nav>
      <button ref={menuButton} type="button" className="docs-menu-toggle" aria-label={menuOpen ? 'Close guide navigation' : 'Open guide navigation'} aria-controls="docs-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}</button>
    </div></header>
    <div className={'docs-layout' + (!isHub && guide ? ' has-article' : '')}>
      <aside id="docs-navigation" className={'docs-sidebar' + (menuOpen ? ' is-open' : '')}>
        <nav aria-label="Browse guides"><a className={'docs-all-guides' + (isHub && category === 'all' ? ' is-current' : '')} href={base} onClick={() => setMenuOpen(false)}><BookOpen size={17} aria-hidden="true" />All guides</a>
          {isHub ? <div className="docs-category-filter" role="group" aria-label="Filter guides by category">{DOC_CATEGORIES.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => chooseCategory(item.id)}><span>{item.title}</span><small>{DOC_GUIDES.filter(candidate => candidate.category === item.id).length}</small></button>)}</div> : DOC_CATEGORIES.map(item => <div className="docs-nav-group" key={item.id}><h2><a href={base + '?category=' + encodeURIComponent(item.id)} onClick={() => setMenuOpen(false)}>{item.title}</a></h2>{DOC_GUIDES.filter(candidate => candidate.category === item.id).map(candidate => <a key={candidate.slug} href={`${base}/${encodeURIComponent(candidate.slug)}`} aria-current={guide?.slug === candidate.slug ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{candidate.title}</a>)}</div>)}
        </nav>
        <a className="docs-sidebar-home" href={homeHref}>Studio X OS website<ArrowUpRight size={15} aria-hidden="true" /></a>
      </aside>

      <main id="docs-main" className="docs-main" tabIndex={-1}>
        {isHub ? <>
          <header className="docs-hub-intro"><h1>Learn your workspace.<br /><em>Keep creating.</em></h1><p>Step-by-step guides for studio owners and teams, plus a guide to the client Smart Link.</p>
            <label className="docs-search" id="docs-search"><Search size={21} aria-hidden="true" /><span className="docs-sr-only">Search all guide content</span><input ref={searchInput} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search quotations, payments, delivery…" aria-controls="docs-guide-results" autoComplete="off" spellCheck="false" />{query && <button type="button" aria-label="Clear guide search" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><X size={18} aria-hidden="true" /></button>}</label>
            <p ref={resultsStatus} className="docs-result-count" role="status" aria-live="polite" tabIndex={-1}>{filteredGuides.length} {filteredGuides.length === 1 ? 'guide' : 'guides'}{query.trim() ? ` matching “${query.trim()}”` : category !== 'all' ? ` in ${categoryById.get(category)?.title}` : ' to help you find your next step'}</p>
          </header>
          <div id="docs-guide-results" className="docs-guide-results">{filteredGuides.length ? DOC_CATEGORIES.map(item => {
            const matches = filteredGuides.filter(candidate => candidate.category === item.id);
            return matches.length ? <section className="docs-guide-group" key={item.id} aria-labelledby={'docs-category-' + item.id}><h2 id={'docs-category-' + item.id}>{item.title}<span>{matches.length} {matches.length === 1 ? 'guide' : 'guides'}</span></h2>{matches.map(candidate => <GuideLink key={candidate.slug} guide={candidate} base={base} />)}</section> : null;
          }) : <section className="docs-empty"><Search size={26} aria-hidden="true" /><h2>No guides found.</h2><p>Try a shorter phrase, another word, or browse all categories.</p><button type="button" className="docs-button" onClick={clearSearch}>Show all guides<ArrowRight size={16} aria-hidden="true" /></button></section>}</div>
          <p className="docs-preview-note">Studio X OS is in commercial preview. Screenshots use sample data; your workspace shows the areas your account can access.</p>
        </> : guide ? <article className="docs-article">
          <nav className="docs-breadcrumbs" aria-label="Breadcrumb"><a href={base}>All guides</a><span aria-hidden="true">/</span><a href={base + '?category=' + encodeURIComponent(guide.category)}>{categoryById.get(guide.category)?.title || guide.category}</a></nav>
          <header className="docs-article-heading"><h1>{guide.title}</h1><p>{guide.summary}</p></header>
          <Toc guide={guide} mobile />
          {!!guide.prerequisites?.length && <section className="docs-before"><h2>Before you begin</h2><ul>{guide.prerequisites.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
          {guide.sections.map(section => <section className="docs-guide-section" id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {!!section.steps?.length && <ol className="docs-steps">{section.steps.map((step, index) => <li key={index}><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>}
            {section.screenshot && <GuideScreenshot key={section.screenshot.id} screenshot={section.screenshot} theme={imageTheme} onThemeChange={setImageTheme} />}
            {!!section.tips?.length && <aside className="docs-tips" aria-label={'Things to know: ' + section.title}><h3>Good to know</h3><ul>{section.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul></aside>}
          </section>)}
          {!!guide.outcome?.length && <section className="docs-outcome"><h2>After this guide</h2><ul>{guide.outcome.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
          <nav className="docs-sequence" aria-label="Previous and next guide">{previousGuide && <a href={`${base}/${encodeURIComponent(previousGuide.slug)}`}><span><ArrowLeft size={15} aria-hidden="true" />Previous guide</span><strong>{previousGuide.title}</strong></a>}{nextGuide && <a className="is-next" href={`${base}/${encodeURIComponent(nextGuide.slug)}`}><span>Next guide<ArrowRight size={15} aria-hidden="true" /></span><strong>{nextGuide.title}</strong></a>}</nav>
          {!!related.length && <section className="docs-related"><h2>Keep learning</h2>{related.map(item => <GuideLink key={item.slug} guide={item} base={base} compact />)}</section>}
          <a className="docs-back-top" href="#docs-main">Back to top<ArrowDown size={15} aria-hidden="true" /></a>
        </article> : <section className="docs-not-found"><BookOpen size={29} aria-hidden="true" /><h1>That guide isn’t here.</h1><p>Choose a guide from the navigation, or return to the full collection.</p><a className="docs-button" href={base}>Browse all guides<ArrowRight size={17} aria-hidden="true" /></a></section>}
      </main>
      {!isHub && guide && <Toc guide={guide} />}
    </div>
    <footer className="docs-footer"><a href={homeHref}>Studio X OS<ArrowUpRight size={15} aria-hidden="true" /></a><span>More creating. A little clarity along the way.</span><a href={base}>All guides</a></footer>
  </div>;
}
