import { IS_COMMERCIAL_DEPLOYMENT } from '../../../saas/release';

// Keep real spaces and whole non-Latin words so names wrap and shape correctly.
export default function WorkspaceMotionTitle({ children, ...props }) {
  if (!IS_COMMERCIAL_DEPLOYMENT || typeof children !== 'string' || !children.trim()) {
    return <h1 {...props}>{children}</h1>;
  }
  let index = 0;
  return <h1 {...props} aria-label={children}>{children.split(/(\s+)/u).map((word, i) => {
    if (!word.trim()) return word;
    const letters = children.length <= 80 && /^[\x21-\x7e]+$/.test(word) ? [...word] : [word];
    return <span key={i} className="studio-title-word" aria-hidden="true">{letters.map((letter, j) =>
      <span key={j} className="studio-title-glyph" style={{ '--glyph-delay': Math.min(index++, 22) * 22 + 'ms' }}>{letter}</span>
    )}</span>;
  })}</h1>;
}
