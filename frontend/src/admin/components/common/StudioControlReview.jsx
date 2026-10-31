import { useState } from 'react';
import { Camera, Images, Clapperboard, Upload, FileText, Settings2, CreditCard, AudioLines, Plus, Trash2, ArrowRight, X } from 'lucide-react';
import StudioButton from './StudioButton';
import StudioIcon from './StudioIcon';
import StudioAppIcon from './StudioAppIcon';
const symbols = [
 ['Capture',Camera,'blue'],['Galleries',Images,'violet'],['Post production',Clapperboard,'indigo'],
 ['Upload',Upload,'cyan'],['Invoice',FileText,'amber'],['Settings',Settings2,'slate'],
 ['Payment',CreditCard,'green'],['Audio · idle',AudioLines,'rose'],
];
// Development-only review surface. It never calls business APIs.
export default function StudioControlReview() {
 const [complete,setComplete]=useState(false),[attempts,setAttempts]=useState(0);
 const check=async()=>{setComplete(false);setAttempts(value=>value+1);await new Promise(resolve=>setTimeout(resolve,900));setComplete(true);};
 return <section className="studio-controls-review">
  <header><span className="studio-eyebrow">Design review · local only</span><h1>Precision in every interaction.</h1><p className="studio-muted">Shared Studio OS controls. These examples do not save records, send messages or take payments.</p></header>
  <section className="studio-card"><h2>One icon language</h2><p className="studio-muted">Hover, focus or press to see restrained movement within the symbol.</p><div className="studio-controls-symbols">{symbols.map(([label,icon,tone])=><button type="button" key={label} className="studio-controls-symbol"><StudioAppIcon icon={icon} tone={tone} size={42}/><span>{label}</span></button>)}</div></section>
  <section className="studio-card"><h2>Clear actions</h2><div className="studio-controls-examples">
   <StudioButton type="button" variant="primary" icon={Plus}>Create project</StudioButton>
   <StudioButton type="button" icon={FileText}>View invoice</StudioButton>
   <StudioButton type="button" variant="outline" trailingIcon={ArrowRight}>Open details</StudioButton>
   <StudioButton type="button" variant="ghost">Cancel</StudioButton>
   <StudioButton type="button" variant="destructive" icon={Trash2}>Delete example</StudioButton>
   <StudioButton type="button" variant="icon" icon={X} label="Close example"/>
   <StudioButton type="button" variant="primary" disabled>Unavailable</StudioButton>
  </div></section>
  <section className="studio-card"><h2>Process feedback</h2><p className="studio-muted">Run a local control check to review loading, stable width and duplicate-tap protection.</p><div className="studio-controls-examples">
   <StudioButton type="button" variant="primary" icon={Settings2} onClick={check} success={complete} successLabel="Local control check completed" loadingLabel="Running local control check">Run control check</StudioButton>
   <StudioButton type="button" variant="ghost" onClick={()=>setComplete(false)}>Reset check</StudioButton>
   <span role="status">{attempts} {attempts===1?'check':'checks'} started</span>
  </div><p className="studio-muted">Payment checks appear only after an explicitly verified success. Audio stays idle without microphone activity.</p><StudioIcon icon={CreditCard} status="success" label="Verified payment success example" size={24}/><StudioIcon icon={AudioLines} label="Audio idle example" size={24}/></section>
 </section>;
}
