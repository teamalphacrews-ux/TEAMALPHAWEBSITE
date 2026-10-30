import { forwardRef } from 'react';
import { Circle } from 'lucide-react';
import { resolveStudioIconKind, studioIconActivity, studioIconSize } from './studioIconRegistry';
const states=new Set(['idle','loading','success','error']);
function StudioGlyph({kind,status,activity}) {
  if(kind==='camera') return <><path d="M9 4 7.3 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.3L15 4Z"/><g className="studio-icon-shutter"><circle cx="12" cy="13.5" r="3.5"/><path d="m10 10.6 1.2 2.9 3.8.1"/></g><path d="M18 10h.01"/></>;
  if(kind==='gallery') return <><g className="studio-icon-gallery-back"><path d="M4 7H3a1 1 0 0 0-1 1v12a2 2 0 0 0 2 2h12a1 1 0 0 0 1-1v-1"/></g><g className="studio-icon-gallery-front"><rect x="6" y="2" width="16" height="16" rx="2"/><circle cx="11" cy="7" r="1"/><path d="m7 14 4-4 3 3 3-4 5 5"/></g></>;
  if(kind==='timeline') return <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="m3 7 17-5 1 4M8 5.5l2 2.5m4-4.4 2 2.5"/><path d="M6.5 14h11M6.5 18h11"/><g className="studio-icon-playhead"><path d="M12 11.5v8M10.5 11.5l1.5 1.5 1.5-1.5"/></g></>;
  if(kind==='upload') return <><path d="M4 15a7 7 0 1 1 11.7-7H17a4.5 4.5 0 0 1 3 7.9"/><g className="studio-icon-upload-arrow"><path d="M12 21v-9m-4 4 4-4 4 4"/></g></>;
  if(kind==='invoice') return <><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/>{['M8 10h3','M8 14h8','M8 18h8'].map((d,i)=><path key={d} className="studio-icon-document-line" data-line={i+1} pathLength="1" d={d}/>)}</>;
  if(kind==='settings') return <><g className="studio-icon-gear"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/></g><circle cx="12" cy="12" r="3"/></>;
  if(kind==='payment') return <><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20"/>{status==='success'?<path className="studio-icon-payment-check" pathLength="1" d="m9 15 2 2 4-4"/>:<path d="M6 15h3"/>}</>;
  if(kind==='wallet') return <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5"/><path d="M21 12v4"/>{status==='success'&&<path className="studio-icon-payment-check" pathLength="1" d="m7 13 2 2 4-4"/>}</>;
  if(kind==='intercom') return <><rect x="3" y="3" width="18" height="18" rx="5"/>{[.55,1,.8,.45].map((weight,i)=>{const height=4+activity*weight*10;return <path key={i} className="studio-icon-audio-bar" data-bar={i+1} d={`M${7.5+i*3} ${(24-height)/2}v${height}`}/>;})}</>;
  return null;
}
const StudioIcon=forwardRef(function StudioIcon({icon,name,size='md',strokeWidth=1.75,label,decorative,status='idle',activityLevel=0,motion='interaction',className='',style,...props},ref) {
  const kind=resolveStudioIconKind(icon,name),pixels=studioIconSize(size),state=states.has(status)?status:'idle',activity=studioIconActivity(activityLevel);
  const accessibleLabel=label||props['aria-label'],hidden=decorative??!accessibleLabel;
  const shared={...props,ref,className:`lucide studio-icon ${className}`.trim(),width:pixels,height:pixels,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth,strokeLinecap:'round',strokeLinejoin:'round',focusable:false,role:hidden?undefined:'img','aria-hidden':hidden?true:undefined,'aria-label':hidden?undefined:accessibleLabel,'data-icon-kind':kind,'data-icon-status':state,'data-icon-motion':motion==='none'?'none':'interaction','data-icon-activity':activity>0?'active':'idle',style:{'--studio-icon-size':`${pixels}px`,'--studio-icon-activity':activity,...style}};
  const title=!hidden&&accessibleLabel?<title>{accessibleLabel}</title>:null;
  const Glyph=icon||Circle;
  return kind==='generic'?<Glyph {...shared} size={pixels}>{title}</Glyph>:<svg {...shared}>{title}<StudioGlyph kind={kind} status={state} activity={activity}/></svg>;
});
export default StudioIcon;
