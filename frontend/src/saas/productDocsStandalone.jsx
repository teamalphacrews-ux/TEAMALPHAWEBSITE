import { createRoot } from 'react-dom/client';
import ProductDocs from './ProductDocs';
import './productDocs.css';

const container = document.getElementById('root') || document.getElementById('studio-docs-root');
if (container) createRoot(container).render(<ProductDocs />);
