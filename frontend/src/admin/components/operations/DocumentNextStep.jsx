import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import StudioButton from '../common/StudioButton';

export default function DocumentNextStep({ step, href, focusTarget }) {
  if (!step) return null;
  return <aside className="sx-document-next" aria-label="Next step">
    <div><strong>{step.title}</strong><p>{step.detail}</p></div>
    {step.label && href && <Link className="studio-button" to={href}>{step.label}<ArrowRight size={16} aria-hidden="true" /></Link>}
    {step.label && focusTarget && <StudioButton size="sm" variant="outline" trailingIcon={ArrowRight} onClick={() => document.getElementById(focusTarget)?.focus()}>{step.label}</StudioButton>}
  </aside>;
}
