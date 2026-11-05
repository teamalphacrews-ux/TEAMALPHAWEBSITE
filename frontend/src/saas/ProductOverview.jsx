import { createElement, useEffect, useRef } from 'react';
import { ArrowUpRight, Bell, CalendarDays, Camera, ChevronLeft, ChevronRight, Clapperboard, FileText, FolderOpen, Grid2X2, Mail, MessageCircle, PanelLeftClose, Plus, Search, Settings2, SlidersHorizontal, Sun, UsersRound, Wallet } from 'lucide-react';
import { ActivityInsight, BookingInsight, PipelineRings, RhythmInsight, WeekStrip } from '../admin/components/overview/OverviewInsights';
import './productOverview.css';

// Public, illustrative data only. This preview never loads an admin session or API.
const enquiries = [1, 1, 0, 1, 1, 1, 0];
const events = [0, 0, 0, 0, 0, 1, 0];
const tasksDue = [0, 0, 0, 1, 0, 1, 1];
const dates = Array.from({ length: 7 }, (_, index) => `2026-10-${21 + index}`);
const insights = {
  timezone: 'Asia/Kolkata',
  enquiries: { total: 5, changePercent: 67, daily: dates.map((date, index) => ({ date, count: enquiries[index] })) },
  rhythm: { daily: dates.map((date, index) => ({ date, enquiries: enquiries[index], events: events[index], tasksDue: tasksDue[index], completedTasksDue: index === 3 ? 1 : 0 })) },
  activity: { source: 'Illustrative studio activity', days: dates.map((date, index) => ({ date, hours: Array.from({ length: 24 }, (_, hour) => hour === 10 ? enquiries[index] : hour === 15 ? events[index] + tasksDue[index] : 0) })) },
};
const pipeline = [{ status: 'Converted', count: 3 }, { status: 'New', count: 6 }, { status: 'Archived', count: 0 }];
const pages = [[Grid2X2, 'Overview'], [MessageCircle, 'Enquiries'], [FolderOpen, 'Projects'], [FileText, 'Quotations'], [UsersRound, 'Contacts'], [CalendarDays, 'Calendar'], [Wallet, 'Finance']];

export default function ProductOverview({ dark = false, compact = false }) {
  const preview = useRef(null);
  useEffect(() => {
    if (!compact || !preview.current) return;
    const frame = preview.current;
    const screen = frame.firstElementChild;
    const fit = () => frame.style.setProperty('--pov-scale', Math.min(frame.clientWidth / screen.offsetWidth, frame.clientHeight / screen.offsetHeight));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    observer.observe(screen);
    return () => observer.disconnect();
  }, [compact]);
  return <div ref={preview} className={`sos-overview-preview${dark ? ' is-dark' : ''}${compact ? ' is-compact' : ''}`} role="img" aria-label={`Updated Studio OS Overview in ${dark ? 'dark' : 'daylight'} mode: welcome banner, daily planner, booking and studio rhythm charts, activity map and pipeline performance. Illustrative sample data.`}>
    <div className="pov-screen" inert aria-hidden="true">
      <aside className="pov-sidebar">
        <div className="pov-brand"><span><Camera size={19} /></span><strong>Your Studio<small>Studio OS</small></strong><PanelLeftClose size={14} /></div>
        <small className="pov-nav-label">WORKSPACE</small>
        <div className="pov-pages">{pages.map(([icon, label], index) => <span key={label} className={index === 0 ? 'is-active' : ''}>{createElement(icon, { size: 16 })}{label}</span>)}</div>
        {['OPERATIONS', 'COMMUNICATION', 'STUDIO'].map(label => <div className="pov-nav-group" key={label}>{label}<ChevronRight size={12} /></div>)}
        <div className="pov-sidebar-bottom"><span><Settings2 size={15} />Settings<ArrowUpRight size={12} /></span><div><i>YS</i><strong>Studio owner<small>Administrator</small></strong></div></div>
      </aside>
      <div className="pov-workspace">
        <header className="pov-topbar"><strong>Overview</strong><span className="pov-search"><Search size={13} />Find a page…<small>⌘ K</small></span><div><Sun size={15} /><Bell size={15} /><i>YS</i></div></header>
        <div className="pov-sample">PRODUCT PREVIEW · ILLUSTRATIVE SAMPLE DATA</div>
        <div className="pov-content">
          <div className="pov-heading"><span><small>YOUR CREATIVE WORKSPACE</small><strong>Studio overview</strong></span><div><span><SlidersHorizontal size={12} />Customize</span><span><Plus size={12} />New enquiry</span></div></div>
          <div className="pov-grid">
            <div className="pov-welcome"><img src="/assets/banner/dsc05646-1280.webp" alt="" loading="lazy" width="1280" height="853" /><div className="pov-warm-light" /><div className="pov-welcome-copy"><small>Good morning, Studio owner</small><h3>Make today<br />a masterpiece.</h3><p>Your people, projects and possibilities.<br />All beautifully in focus.</p><span>Explore your projects<ArrowUpRight size={13} /></span></div><div className="pov-camera"><Camera size={23} /></div><div className="pov-note"><small>27 Oct 2026</small><strong>More creating.<br />Less chasing.</strong><span>0 events today · 4 tasks to do</span></div></div>
            <div className="pov-planner"><div><strong>Tue, 27 Oct</strong><span>Today<ChevronLeft size={12} /><ChevronRight size={12} /></span></div><small>Your day, in focus · Asia/Kolkata</small><div className="pov-planner-empty"><CalendarDays size={20} /><strong>A little breathing room.</strong><span>No events scheduled for today.</span></div><div className="pov-mountains"><i /><i /><i /></div><footer><span>0 events</span><span>View calendar<ArrowUpRight size={11} /></span></footer></div>
            <div className="pov-booking"><BookingInsight insights={insights} conversion={33} total={9} booked={3} /></div>
            <div className="pov-rhythm"><RhythmInsight insights={insights} /></div>
            <div className="pov-activity"><ActivityInsight insights={insights} /></div>
            <div className="pov-pipeline"><PipelineRings pipeline={pipeline} /></div>
            <div className="pov-week"><WeekStrip insights={insights} /></div>
          </div>
          <div className="pov-preview-foot"><Mail size={11} /><span>Your clients, crew and creative work. Connected.</span><Clapperboard size={11} /></div>
        </div>
      </div>
    </div>
  </div>;
}
