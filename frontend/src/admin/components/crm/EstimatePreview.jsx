import React, { forwardRef } from 'react';
import { numberToIndianWords } from '../../utils/numberToWords';
import new_logo from "../../../assets/new_logo_original.png";

const EstimatePreview = forwardRef(({ data }, ref) => {
     // A4 proportions: 794 x 1123 px at 96 DPI
    const pageStyle = "w-[794px] h-[1123px] bg-white relative mx-auto shrink-0 shadow-sm border border-stone-100 mt-4 overflow-hidden text-[#1A1A1A] font-sans box-border";

    // Total from events
    const eventsTotal = data.events?.reduce((sum, ev) => sum + (Number(ev.price) || 0), 0) || 0;

    const deliverablesList = Array.isArray(data.deliverables) ? data.deliverables : (data.deliverables || "").split('\n').filter(l => l.trim() !== '');
    const timelineList = data.timeline || [
        { deliverable: "Soft Copies (All photos)", time: "7 Days" },
        { deliverable: "Candid Photographs", time: "45 days" },
        { deliverable: "Cinematography Video", time: "60 days" },
        { deliverable: "Edited Traditional Video", time: "60 days" }
    ];

    const coverImageUrl = data.coverImage || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    return (
        <div ref={ref} className="bg-stone-50 p-8 pt-0 flex flex-col gap-12 items-center" style={{ fontFamily: "'Inter', sans-serif" }}>
            
            {/* PAGE 1: REFINED COVER - NO OVERLAPS */}
            <div className={pageStyle + " pdf-page flex flex-col items-center pt-10"}>
                {/* Minimalist Top Branding */}
                <div className="text-center mb-8">
                    <p className="text-[10px] tracking-[0.5em] text-stone-400 uppercase mb-2">Wedding Photography Portfolio</p>
                    <div className="w-12 h-[1px] bg-stone-200 mx-auto"></div>
                </div>

                {/* Primary Logo - Centered */}
                <div className="flex flex-col items-center mb-10 px-4">
                    <img
                        src={new_logo}
                        alt="Team Alpha Logo"
                        style={{
                            width: "180px",
                            height: "auto",
                            objectFit: "contain"
                        }}
                    />
                    <div className="mt-[-15px] text-center">
                        <h1 className="text-2xl font-bold tracking-[0.2em] text-[#1A1A1A] font-serif uppercase">TEAM ALPHA</h1>
                        <p className="text-[8px] tracking-[0.6em] text-stone-400 uppercase mt-1 italic">THE WEDDING ARTIST</p>
                    </div>
                </div>

                {/* Centered Image Frame - Avoids Side-Text Collision */}
                <div className="w-[85%] h-[420px] border-[10px] border-stone-50 shadow-2xl relative overflow-hidden rounded-sm">
                    <img 
                        src={coverImageUrl} 
                        alt="Wedding" 
                        className="w-full h-full object-cover grayscale-[0.1]" 
                        crossOrigin="anonymous" 
                    />
                </div>

                {/* Central Statement - Perfectly Aligned */}
                <div className="mt-16 text-center max-w-[600px] px-8">
                    <h2 className="text-[34px] font-serif italic text-stone-800 leading-tight tracking-[0.02em]">
                        "Capturing your forever, one timeless memory at a time."
                    </h2>
                    <div className="mt-8 flex justify-center items-center gap-4">
                        <div className="h-[1px] w-8 bg-stone-300"></div>
                        <p className="text-[11px] tracking-[0.3em] font-medium text-stone-400 uppercase">OFFICIAL PROPOSAL</p>
                        <div className="h-[1px] w-8 bg-stone-300"></div>
                    </div>
                </div>

                {/* Bottom Contact Detail */}
                <div className="absolute bottom-12 text-center w-full border-t border-stone-50 pt-8">
                    <p className="text-[10px] tracking-[0.4em] text-stone-400 uppercase">
                        +91 91106 03953  •  info@teamalphacrew.com
                    </p>
                </div>
            </div>

            {/* PAGE 2: WELCOME & WORKFLOW */}
            <div className={pageStyle + " pdf-page px-20 py-28"}>
                <div className="mb-16">
                    <h3 className="text-4xl font-serif italic text-stone-900 mb-6">Congratulations</h3>
                    <p className="text-stone-500 text-[13px] leading-relaxed max-w-[450px]">
                        Thank you for considering us to be part of your legacy. It’s an honor to capture the moments you’ll cherish for decades to come. Our team is committed to excellence and storytelling of the highest caliber.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-12">
                     {/* Timeline Table */}
                    <div className="bg-stone-50 p-10 rounded-sm">
                        <h4 className="text-[10px] font-bold tracking-[0.4em] text-stone-400 uppercase mb-8">Post-Production Timeline</h4>
                        <table className="w-full text-left text-[12px]">
                            <tbody className="divide-y divide-stone-200">
                                {timelineList.map((item, i) => (
                                    <tr key={i}>
                                        <td className="py-4 font-bold text-stone-900 pr-4">{item.deliverable}</td>
                                        <td className="py-4 text-stone-500 text-right italic">{item.time}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Simple Workflow */}
                    <div className="px-4">
                        <h4 className="text-[10px] font-bold tracking-[0.4em] text-stone-400 uppercase mb-8">Service Workflow</h4>
                        <div className="space-y-6 text-[12px] text-stone-600">
                            {[
                                "Booking confirmation with 50% initial payment.",
                                "Project briefing & vendor synchronization.",
                                "High-speed data processing and delivery.",
                                "Final asset delivery and collection of remaining payment."
                            ].map((step, i) => (
                                <div key={i} className="flex gap-4 items-center">
                                    <span className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center text-[10px] text-stone-400">{i+1}</span>
                                    <p>{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* PAGE 3: INVESTMENT DETAILS */}
            <div className={pageStyle + " pdf-page px-16 py-24"}>
                <div className="text-center mb-16">
                    <p className="text-[10px] tracking-[0.4em] text-stone-400 uppercase mb-2">Detailed Investment</p>
                    <h3 className="text-3xl font-serif italic text-stone-900">Project Sessions & Fees</h3>
                </div>

                <div className="border border-stone-100 rounded-sm overflow-hidden shadow-sm">
                    <table className="w-full border-collapse">
                        <thead className="bg-stone-50 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            <tr>
                                <th className="p-6 text-left border-r border-stone-100">Event / Context</th>
                                <th className="p-6 text-left border-r border-stone-100">Inclusions</th>
                                <th className="p-6 text-right">Investment</th>
                            </tr>
                        </thead>
                        <tbody className="text-[12px] text-stone-800">
                             {data.events?.map((ev, i) => (
                                <tr key={i} className="border-t border-stone-100">
                                    <td className="p-6 border-r border-stone-100 align-top">
                                        <div className="font-bold mb-1">{ev.eventName}</div>
                                        <div className="text-[10px] text-stone-400 uppercase tracking-widest">{ev.dateLocation}</div>
                                    </td>
                                    <td className="p-6 border-r border-stone-100 align-top leading-relaxed text-stone-500">
                                        {ev.services}
                                    </td>
                                    <td className="p-6 text-right font-bold align-top whitespace-nowrap">
                                        ₹ {Number(ev.price).toLocaleString('en-IN')}/-
                                    </td>
                                </tr>
                             ))}
                        </tbody>
                        <tfoot className="bg-[#1A1A1A] text-white">
                            <tr>
                                <td colSpan="2" className="p-6 font-bold text-sm tracking-widest uppercase">Base Total Investment</td>
                                <td className="p-6 text-right font-bold text-lg">₹ {eventsTotal.toLocaleString('en-IN')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p className="mt-4 text-[10px] text-stone-400 italic text-right px-2">
                    {numberToIndianWords(eventsTotal)} Only
                </p>
            </div>

            {/* PAGE 4: ASSETS & SUMMARY */}
            <div className={pageStyle + " pdf-page px-20 py-28 flex flex-col"}>
                <div className="mb-20">
                     <h3 className="text-[10px] tracking-[0.4em] text-stone-400 uppercase mb-8">Deliverables Checklist</h3>
                     <div className="grid grid-cols-1 gap-4">
                         {deliverablesList.map((d, i) => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-stone-100 text-[13px] text-stone-700">
                                 <span className="w-1.5 h-1.5 bg-stone-900"></span>
                                 {d}
                            </div>
                         ))}
                     </div>
                </div>

                <div className="mt-auto bg-stone-50 p-12 text-center rounded-sm">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.5em] mb-4">Total Value of Services</p>
                    <h2 className="text-4xl font-serif text-stone-900 mb-2">₹ {(data.total || 0).toLocaleString('en-IN')}.00</h2>
                    <p className="text-[11px] italic text-stone-500">{numberToIndianWords(data.total || 0)}</p>
                </div>

                <div className="mt-20 pt-10 border-t border-stone-100 text-center">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest">Equipped with Pro Sony Cinema Series & GM Prime Lenses</p>
                </div>
            </div>

            {/* PAGE 5: THE FINE PRINT */}
            <div className={pageStyle + " pdf-page px-20 py-24"}>
                 <div className="mb-16">
                   <h3 className="text-3xl font-serif text-stone-900 mb-2">The Fine Print</h3>
                   <p className="text-[10px] tracking-[0.3em] text-stone-400 uppercase">Terms & Conditions of Service</p>
                </div>

                <div className="grid grid-cols-1 gap-10 text-[11px] text-stone-500 leading-relaxed">
                    <div className="space-y-2">
                        <h4 className="font-bold text-stone-900 uppercase tracking-widest text-[10px]">Booking & Payments</h4>
                        <p>50% advance to secure dates. First-come-first-serve basis. Raw data delivered post full payment settlement.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-stone-900 uppercase tracking-widest text-[10px]">Cancellations</h4>
                        <p>Client responsible for expenses incurred up to time of cancellation. Cancellation within 2 days of shoot incurs 100% project fee.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-stone-900 uppercase tracking-widest text-[10px]">Crew Safety</h4>
                        <p>Rude or threatening behavior towards team members results in immediate withdrawal without refund.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-stone-900 uppercase tracking-widest text-[10px]">Travel Logistics</h4>
                        <p>Travel and hotel expenses for outstation shoots to be covered by the client for the entire crew.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-stone-900 uppercase tracking-widest text-[10px]">Data Management</h4>
                        <p>Archive stored for 6 months. Client recommended to maintain private backups post-delivery.</p>
                    </div>
                </div>

                <div className="absolute bottom-16 left-20 right-20 flex justify-between items-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    <span>Team Alpha Crew</span>
                    <span>Bengaluru, India</span>
                </div>
            </div>
        </div >
    );
});

export default EstimatePreview;
