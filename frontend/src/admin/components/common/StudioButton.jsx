import { forwardRef, useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import StudioIcon from './StudioIcon';
import { createButtonActionGuard } from './studioButtonAction';
const variants=new Set(['primary','secondary','outline','ghost','destructive','icon']);
const sizes=new Set(['sm','md','lg']);
const StudioButton=forwardRef(function StudioButton({children,label,icon,trailingIcon,iconOnly=false,variant='secondary',size='md',loading=false,loadingLabel,loadingIcon,success=false,successLabel,fullWidth=false,disabled=false,onClick,className='',title,type,'aria-label':ariaLabel,...props},ref){
  const [actionPending,setActionPending]=useState(false),mounted=useRef(true),guard=useRef(createButtonActionGuard());
  const working=Boolean(loading||actionPending),chosenVariant=variants.has(variant)?variant:'secondary',chosenSize=sizes.has(size)?size:'md',onlyIcon=iconOnly||chosenVariant==='icon';
  const textName=typeof children==='string'||typeof children==='number'?String(children):'',name=ariaLabel||label||textName||title;
  const accessibleName=working?loadingLabel||(name?`${name}, in progress`:'Working'):success?successLabel||(name?`${name}, completed`:'Completed'):ariaLabel||(onlyIcon?name:undefined);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(import.meta.env.DEV&&onlyIcon&&!name)console.warn('StudioButton: icon-only controls need a label or aria-label.');},[onlyIcon,name]);
  const activate=event=>{
    const activation=guard.current.run(event,onClick,disabled||working);
    if(!activation.accepted)return;
    const result=activation.result;
    if(result&&typeof result.then==='function'){setActionPending(true);const complete=()=>{if(mounted.current)setActionPending(false);};Promise.resolve(result).then(complete,complete);}
    return result;
  };
  const classes=['studio-button','studio-control-button',chosenVariant==='primary'&&'primary',chosenVariant==='destructive'&&'danger',onlyIcon&&'is-icon-only',working&&'is-loading',!working&&success&&'is-success',fullWidth&&'is-full-width',className].filter(Boolean).join(' ');
  return <button {...props} ref={ref} type={type} className={classes} data-variant={chosenVariant} data-size={chosenSize} data-state={working?'loading':success?'success':'idle'} aria-busy={working||undefined} aria-label={accessibleName} title={title||(onlyIcon?name:undefined)} disabled={disabled||working} onClick={activate}>
    <span className="studio-button-content" aria-hidden={working||success||undefined}>{icon&&<StudioIcon icon={icon} size={18} decorative/>}{children??(!onlyIcon?label:null)}{trailingIcon&&<StudioIcon icon={trailingIcon} size={18} decorative/>}</span>
    {(working||success)&&<span className="studio-button-indicator" aria-hidden="true"><StudioIcon icon={working?(loadingIcon||LoaderCircle):Check} status={working?'loading':'success'} size={18} decorative/></span>}
  </button>;
});
export default StudioButton;
