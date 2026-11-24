import { useState } from 'react';
import { Bell, Check, Mail, RotateCcw, UserRound, UsersRound } from 'lucide-react';
import './productReminders.css';
import ProductWorkspaceCapture from './ProductWorkspaceCapture';

const views = [
  { id:'you', title:'For you', icon:UserRound, eyebrow:'YOUR NEXT STEP, IN VIEW', heading:'A full calendar.\nA little less to remember.', copy:'Keep enquiry follow-ups in view and choose the in-app activity alerts that reach you. Personalise banners, badges and sounds — with quiet hours when work can wait.', status:'Personal notification preferences' },
  { id:'team', title:'For your team', icon:UsersRound, eyebrow:'THE CREW KNOWS WHAT’S NEXT', heading:'The right brief.\nBefore the next shoot.', copy:'A planned reminder experience for your assigned crew, with the event, time and venue in context. Help people prepare without asking you to repeat the plan.', status:'Email setup planned' },
  { id:'client', title:'For your client', icon:Mail, eyebrow:'A THOUGHTFUL NUDGE, WITH CONTEXT', heading:'Keep the next step\nclear for your client.', copy:'Planned email reminders bring clients back to their quote or payment milestone. The smart link keeps the details together, so the reminder has somewhere useful to lead.', status:'Email setup planned' },
];

const reminderScreens = { you: 'reminders', team: 'project-detail', client: 'client-smart-link-payments' };

export function ReminderCapture({ id }) {
  return <ProductWorkspaceCapture view={reminderScreens[id]} className="sos-capture-reminders" />;
}

export default function ProductReminders() {
  const [active, setActive] = useState(0);
  const [replay, setReplay] = useState(0);
  const view = views[active];
  const onKeyDown = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (active + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
    setActive(next);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <section className="sos-reminders sos-container" id="reminders">
    <div className="sos-reminders-heading"><div><span className="sos-eyebrow">THE FOLLOW-THROUGH MATTERS</span><h2>Reminds you.<br />Your team.<br /><span>Your client.</span></h2></div><div><span className="sos-reminders-heading-icon"><Bell size={32} strokeWidth={1.4}/><i/></span><p>Because great work needs a clear next step.<br />Explore how reminders can keep people and projects moving together.</p></div></div>
    <div className={'sos-reminders-playground reminders-'+view.id}>
      <div className="sos-reminders-toolbar"><div className="sos-reminders-tabs" role="tablist" aria-label="Explore reminder recipients" onKeyDown={onKeyDown}>{views.map((item,index)=><button type="button" key={item.id} role="tab" id={'reminder-tab-'+item.id} aria-selected={active===index} aria-controls="sos-reminders-panel" tabIndex={active===index?0:-1} onClick={()=>setActive(index)}><item.icon size={16}/>{item.title}</button>)}</div><span className="sos-reminders-preview"><i/>SAMPLE WORKSPACE</span></div>
      <div className="sos-reminders-panel" id="sos-reminders-panel" role="tabpanel" tabIndex={0} aria-labelledby={'reminder-tab-'+view.id}>
        <div className="sos-reminders-copy"><span>{view.eyebrow}</span><h3>{view.heading.split('\n').map((line,index)=><span key={line}>{index>0&&<br/>}{line}</span>)}</h3><p>{view.copy}</p><div className="sos-reminders-availability"><Check size={13}/>{view.status}</div><button type="button" className="sos-reminders-replay" onClick={()=>setReplay(value=>value+1)}><RotateCcw size={14}/>Replay animation</button></div>
        <ReminderCapture key={view.id + replay} id={view.id}/>
      </div>
      <footer className="sos-reminders-note"><Mail size={15}/><p>Email reminders for studio workspaces are planned and require sender setup. This preview does not send notifications.</p></footer>
    </div>
  </section>;
}
