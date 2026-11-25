import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { PRODUCT_SCREENSHOTS } from './productScreenshotCatalog';
import './productDocsTeaser.css';

const learningPaths = [
  { slug: 'getting-started', screenshot: 'overview', label: 'For your studio', title: 'Start with a connected workspace.', summary: 'A practical first route through studio setup, your first client and the connected enquiry-to-delivery workflow.' },
  { slug: 'quotations', screenshot: 'quote-editor', label: 'From enquiry to agreement', title: 'Build a quote. Keep every detail together.', summary: 'Link the right client and project, review the document, then share a client link with clear acceptance expectations.' },
  { slug: 'client-guide', screenshot: 'client-smart-link', label: 'For your clients', title: 'One link. A clear next step.', summary: 'Review your quotation, issued invoice, payments and creative progress from the private link supplied by your studio.' },
];

export default function ProductDocsTeaser() {
  return <section className="sos-docs-entry" id="docs" aria-labelledby="sos-docs-heading">
    <div className="sos-container">
      <div className="sos-docs-intro">
        <h2 id="sos-docs-heading">Know your workspace.<br /><em>Make it your own.</em></h2>
        <div><p>Clear, step-by-step guides for your studio and your clients. Follow the new interface with real product screenshots, from the first enquiry to the final delivery.</p><a href="/studio-os/docs">Explore the Docs<ArrowUpRight size={18} aria-hidden="true" /></a></div>
      </div>
      <div className="sos-docs-paths">
        {learningPaths.map(path => {
          const screen = PRODUCT_SCREENSHOTS[path.screenshot];
          return <a key={path.slug} href={'/studio-os/docs/' + path.slug} className="sos-docs-path">
            <div className="sos-docs-path-image">
              <picture>
                <source media="(max-width: 600px)" srcSet={screen.light.mobile2x} width={screen.mobileWidth} height={screen.mobileHeight} />
                <img src={screen.light.desktop} srcSet={screen.light.desktop + ' 1440w, ' + screen.light.desktop2x + ' 2880w'}
                  sizes="(max-width: 760px) 92vw, (max-width: 1440px) 31vw, 420px" width={screen.width} height={screen.height}
                  alt={screen.description} loading="lazy" decoding="async" />
              </picture>
            </div>
            <span className="sos-docs-path-audience">{path.label}</span>
            <h3>{path.title}<ArrowRight size={20} aria-hidden="true" /></h3>
            <p>{path.summary}</p>
          </a>;
        })}
      </div>
      <p className="sos-docs-image-note">Screenshots show fictional sample records. Guides explain available actions and features still being prepared.</p>
    </div>
  </section>;
}
