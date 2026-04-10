import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { FileText, Send, IndianRupee, Plus, Trash2, X, Download, LayoutTemplate, Camera, ChevronRight, ChevronLeft, Loader2, Save } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { toJpeg } from "html-to-image";

import jsPDF from "jspdf";
import EstimatePreview from "./EstimatePreview";

export default function InvoiceForm({ onClose, initialData = null, initialClientName = "" }) {
  const token = localStorage.getItem('token');
  const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
  const API = import.meta.env.VITE_API_URL || '';

  const [clientName, setClientName] = useState(initialData?.clientName || initialClientName);
  const [invoiceDate, setInvoiceDate] = useState(initialData?.invoiceDate ? initialData.invoiceDate.split('T')[0] : new Date().toISOString().split('T')[0]);
  const [currentStep, setCurrentStep] = useState(1);

  const [events, setEvents] = useState(initialData?.events || [
    { eventName: "Pre Wedding", services: "Candid Photography\nCinematography\nDrone Coverage", equipment: "SONY A7R4\nSONY FX3\nDJI AIR 3S", dateLocation: "Feb 2026", price: 35000 },
    { eventName: "Home Rituals\nBride & Groom", services: "Traditional Photography", equipment: "SONY M4", dateLocation: "9th or 10th\nApril 2026", price: 16000 },
    { eventName: "Haldi\nBride & Groom", services: "Traditional Photography", equipment: "SONY M4", dateLocation: "9th or 10th\nApril 2026", price: 16000 },
    { eventName: "Sangeeth", services: "Candid Photography\nTraditional Videography\nCinematography", equipment: "SONY A7R4\nSONY M4\nSONY FX3", dateLocation: "10th April 2026", price: 45000 },
    { eventName: "Reception", services: "Candid Photography\nTraditional Photography\nTraditional Videography X2\nCinematography\nDrone Coverage", equipment: "SONY A7R4\nSONY M4\nSONY FX-30\nSONY FX3\nDJI AIR 3S", dateLocation: "11th April 2026", price: 70000 },
    { eventName: "Muhurtham", services: "Candid Photography\nTraditional Photography\nTraditional Videography X2\nCinematography\nDrone Coverage", equipment: "SONY A7R4\nSONY M4\nSONY FX-30\nSONY FX3\nDJI AIR 3S", dateLocation: "12th April 2026", price: 70000 }
  ]);

  const [timeline, setTimeline] = useState(initialData?.timeline || [
    { deliverable: "Soft Copies (All photos)", time: "7 Days" },
    { deliverable: "Candid Photographs", time: "45 days" },
    { deliverable: "Cinematography Video", time: "60 days" },
    { deliverable: "Edited Traditional Video", time: "60 days" }
  ]);

  const [deliverables, setDeliverables] = useState(initialData?.deliverables || [
    "All RAW Data",
    "35 Pre wedding Edited Photos",
    "Pre wedding cinematic Video (3 min max)",
    "Wedding edited images",
    "2 Premium Wedding Albums 15*24(40 pages)",
    "Wedding Cinematography Video 5 Min",
    "Traditional Video Edited 2 Hrs max",
    "Reels"
  ]);
  const [deliverablesPrice, setDeliverablesPrice] = useState(initialData?.deliverablesPrice || 40000);
  const [discount, setDiscount] = useState(initialData?.discount || 0);
  const [extraCharges, setExtraCharges] = useState(initialData?.extraCharges || 0);

  const [coverImage, setCoverImage] = useState(initialData?.coverImage || "");

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const previewRef = useRef(null);

  const eventsTotal = useMemo(() => events.reduce((sum, ev) => sum + (Number(ev.price) || 0), 0), [events]);
  const grandTotal = eventsTotal + Number(deliverablesPrice) + Number(extraCharges) - Number(discount);

  const handleDownload = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    const toastId = toast.loading("Generating High Res PDF...");
    try {
      const pages = previewRef.current.querySelectorAll('.pdf-page');
      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];

        const imgData = await toJpeg(page, {
          quality: 0.95,
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          cacheBust: true,
        });

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      pdf.save(`Estimate_${clientName || "Client"}.pdf`);
      toast.success("PDF Downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(`PDF Error: ${err.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!clientName.trim()) {
      toast.error("Please provide a Client Name in Step 1 before saving.");
      setCurrentStep(1);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        clientName,
        invoiceDate,
        events,
        timeline,
        deliverables,
        deliverablesPrice,
        discount,
        extraCharges,
        total: grandTotal,
        status: initialData?.status || 'Pending'
      };

      if (initialData?._id) {
        await axios.put(`${API}/api/invoices/${initialData._id}`, payload, authHeader);
        toast.success("Changes saved to Database!");
      } else {
        await axios.post(`${API}/api/invoices`, payload, authHeader);
        toast.success("Estimate saved to Database!");
      }
      if (onClose) onClose();
    } catch (err) {
      console.error("Error generating invoice:", err);
      toast.error("Failed to save estimate data.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[8px] z-[9999] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-[0_25px_80px_rgba(0,0,0,0.3)] border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-400 relative flex flex-col max-h-[95vh]">
        
        {/* Premium Gradient Header */}
        <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-br from-[#fafafa] to-white shrink-0">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl text-[#2d2d2d] flex items-center gap-3 leading-tight">
              <LayoutTemplate className="text-[#D9CDEB]" /> Estimate Orchestrator
            </h2>
            <p className="text-[9px] md:text-[10px] text-[#8a8a8a] mt-2 font-black uppercase tracking-[0.25em] bg-gray-100/50 px-3 py-1 rounded-full border border-gray-200 inline-block">Bespoke Financial Crafting</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-5 py-2.5 bg-gray-50 hover:bg-white text-[#2d2d2d] rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm border border-gray-200 disabled:opacity-50"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="hidden sm:inline">Render PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-gray-50 hover:bg-white text-[#8a8a8a] hover:text-[#2d2d2d] rounded-full transition-all hover:rotate-90 border border-transparent hover:border-gray-200 hover:shadow-sm"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col">
          <div className="p-6 md:p-10 space-y-8 flex-1">
            {/* Step Indicator */}
            <div className="flex gap-2 md:gap-3 mb-8 overflow-x-auto no-scrollbar pb-2 snap-x justify-center">
              {['Client', 'Events', 'Timeline', 'Deliverables'].map((step, idx) => (
                <div
                  key={idx}
                  className={`shrink-0 snap-center min-w-[100px] md:min-w-[140px] text-center px-4 py-3 rounded-2xl transition-all cursor-pointer border ${currentStep === idx + 1 ? 'bg-[#2d2d2d] text-white border-black shadow-lg font-bold' : 'text-[#8a8a8a] bg-gray-50 border-gray-100 hover:bg-white hover:border-gray-200'}`}
                  onClick={() => setCurrentStep(idx + 1)}
                >
                  <div className={`text-[8px] uppercase tracking-widest mb-1 ${currentStep === idx + 1 ? 'opacity-40' : 'opacity-60'}`}>Phase 0{idx + 1}</div>
                  <div className="text-[10px] md:text-[11px] uppercase tracking-widest">{step}</div>
                </div>
              ))}
            </div>

            <form className="space-y-8 flex-1" onSubmit={handleSubmit}>
              {currentStep === 1 && (
                <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
                  <div className="bg-gray-50 p-6 md:p-8 rounded-[24px] border border-gray-100 shadow-sm space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">Client Identity</label>
                      <input
                        required
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="e.g. Rahul Mehta"
                        className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-[#2d2d2d] focus:ring-4 focus:ring-black/5 transition-all shadow-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#9a9a9a] ml-1">Hero Cover Image (Optional)</label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                        <div className="w-20 h-20 bg-gray-100 rounded-2xl border border-gray-200 shadow-inner overflow-hidden flex items-center justify-center">
                          {coverImage ? <img src={coverImage} className="w-full h-full object-cover" /> : <Camera size={24} className="text-[#c0c0c0]" />}
                        </div>
                        <label className="flex items-center gap-2 px-5 py-3.5 bg-white border border-gray-200 rounded-2xl text-[11px] font-bold uppercase tracking-widest cursor-pointer hover:bg-gray-50 transition-all text-[#2d2d2d] shadow-sm">
                          <Camera size={16} /> Choose Visual
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {currentStep === 2 && (
                <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
                  <div className="flex justify-between items-center pb-4 border-b border-white/40">
                    <h3 className="text-[11px] uppercase font-bold tracking-[0.2em] text-[#2d2d2d]">Event Master Sessions</h3>
                    <button
                      type="button"
                      onClick={() => setEvents([...events, { eventName: "", services: "", equipment: "", dateLocation: "", price: 0 }])}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-[#2d2d2d] hover:bg-black px-5 py-2.5 rounded-full shadow-md transition-all"
                    >
                      <Plus size={14} /> Incorporate Session
                    </button>
                  </div>

                  <div className="space-y-6 max-h-[45vh] overflow-y-auto custom-scrollbar pr-3">
                    {events.map((ev, i) => (
                      <div key={i} className="bg-white border border-gray-100 p-6 rounded-[24px] shadow-sm relative group hover:shadow-md transition-all">
                        <button type="button" onClick={() => setEvents(events.filter((_, idx) => idx !== i))} className="absolute -top-3 -right-3 bg-white text-red-100/10 text-red-500 p-2 rounded-full shadow-sm border border-red-100 opacity-0 group-hover:opacity-100 transition-all z-10">
                          <Trash2 size={14} />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 col-span-full">
                             <input className="w-full bg-gray-50 rounded-xl px-4 py-3 text-xs border border-gray-100 focus:outline-none focus:border-[#2d2d2d] font-bold" placeholder="Session Designation (e.g. Grand Muhurtham)" value={ev.eventName} onChange={e => { const n = [...events]; n[i].eventName = e.target.value; setEvents(n); }} />
                          </div>
                          <textarea className="bg-gray-50 rounded-xl p-4 text-xs border border-gray-100 focus:outline-none focus:border-[#2d2d2d] resize-none h-24" placeholder="Artistic Services Provided" value={ev.services} onChange={e => { const n = [...events]; n[i].services = e.target.value; setEvents(n); }} />
                          <textarea className="bg-gray-50 rounded-xl p-4 text-xs border border-gray-100 focus:outline-none focus:border-[#2d2d2d] resize-none h-24" placeholder="Technical Equipment Suite" value={ev.equipment} onChange={e => { const n = [...events]; n[i].equipment = e.target.value; setEvents(n); }} />
                          <div className="space-y-3 col-span-full md:col-span-1">
                             <input className="w-full bg-gray-50 rounded-xl px-4 py-3 text-xs border border-gray-100 focus:outline-none focus:border-[#2d2d2d]" placeholder="Curation Date & Location" value={ev.dateLocation} onChange={e => { const n = [...events]; n[i].dateLocation = e.target.value; setEvents(n); }} />
                          </div>
                          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-100 px-4 md:col-span-1 shadow-inner">
                              <IndianRupee size={14} className="text-[#8a8a8a]" />
                              <input type="number" className="w-full bg-transparent py-3 px-2 text-sm focus:outline-none font-black text-[#2d2d2d]" value={ev.price} onChange={e => { const n = [...events]; n[i].price = Number(e.target.value); setEvents(n); }} placeholder="Valuation" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {currentStep === 3 && (
                <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
                  <div className="flex justify-between items-center pb-4 border-b border-white/40">
                    <h3 className="text-[11px] uppercase font-bold tracking-[0.2em] text-[#2d2d2d]">Curation Timeline</h3>
                  </div>
                  <div className="bg-white/40 p-6 md:p-8 rounded-[24px] border border-white/60 shadow-sm space-y-4">
                    {timeline.map((item, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center group w-full relative">
                        <input className="flex-1 w-full bg-white border border-gray-100 rounded-xl px-5 py-3 text-xs focus:outline-none focus:border-[#2d2d2d]" placeholder="Deliverable (e.g. Cinematic Film)" value={item.deliverable} onChange={e => { const m = [...timeline]; m[i].deliverable = e.target.value; setTimeline(m); }} />
                        <div className="flex w-full sm:w-auto items-center gap-2">
                           <input className="flex-1 sm:w-32 bg-white border border-gray-100 rounded-xl px-5 py-3 text-xs focus:outline-none focus:border-[#2d2d2d] text-center font-bold" placeholder="Phasing" value={item.time} onChange={e => { const m = [...timeline]; m[i].time = e.target.value; setTimeline(m); }} />
                           <button type="button" onClick={() => setTimeline(timeline.filter((_, idx) => idx !== i))} className="text-[#8a8a8a] shrink-0 hover:text-red-500 p-2.5 transition-colors absolute sm:static right-[-5px] sm:right-auto top-[-30px] sm:top-auto"><X size={18} /></button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setTimeline([...timeline, { deliverable: '', time: '' }])} className="text-[10px] font-black uppercase tracking-widest text-[#2d2d2d] bg-white hover:bg-gray-50 px-5 py-3 rounded-xl border border-gray-200 transition-all flex items-center justify-center gap-2 w-full mt-4 shadow-sm">
                      <Plus size={14} /> Extend Timeline Phasing
                    </button>
                  </div>
                </section>
              )}

              {currentStep === 4 && (
                <section className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
                  <div className="flex justify-between items-center pb-4 border-b border-white/40">
                    <h3 className="text-[11px] uppercase font-bold tracking-[0.2em] text-[#2d2d2d]">Tangible Deliverables</h3>
                  </div>
                  <div className="bg-white/40 p-6 md:p-8 rounded-[24px] border border-white/60 shadow-sm space-y-4">
                    {deliverables.map((dItem, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center group w-full relative">
                        <span className="hidden sm:block w-8 text-center text-[10px] text-[#8a8a8a] font-black uppercase">{String(i+1).padStart(2, '0')}</span>
                        <div className="flex w-full items-center gap-2">
                           <input className="flex-1 bg-white border border-gray-100 rounded-xl px-5 py-3 text-xs focus:outline-none focus:border-[#2d2d2d]" placeholder="e.g. 2 Premium Couture Albums" value={dItem} onChange={e => { const m = [...deliverables]; m[i] = e.target.value; setDeliverables(m); }} />
                           <button type="button" onClick={() => setDeliverables(deliverables.filter((_, idx) => idx !== i))} className="text-[#8a8a8a] shrink-0 hover:text-red-500 p-2 transition-colors"><X size={18} /></button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setDeliverables([...deliverables, ''])} className="text-[10px] font-black uppercase tracking-widest text-[#2d2d2d] bg-white hover:bg-gray-50 px-5 py-3 rounded-xl border border-gray-100 transition-all flex items-center justify-center gap-2 w-full mt-4 shadow-sm">
                      <Plus size={14} /> Append Artifact
                    </button>
                  </div>

                  <div className="bg-gray-100/50 p-6 md:p-8 rounded-[32px] border border-gray-200 mt-8 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
                      <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#4a4a4a]">Production Valuation (₹)</span>
                      <input type="number" className="w-full sm:w-40 bg-white border text-left sm:text-right border-gray-100 rounded-xl px-5 py-3 text-[13px] font-black focus:outline-none focus:border-[#2d2d2d] shadow-inner" value={deliverablesPrice} onChange={e => setDeliverablesPrice(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
                      <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-red-600">Administrative Gesture (Discount ₹)</span>
                      <input type="number" className="w-full sm:w-40 bg-white border text-left sm:text-right border-red-100 rounded-xl px-5 py-3 text-[13px] font-black focus:outline-none focus:border-red-400 text-red-600 shadow-inner" value={discount} onChange={e => setDiscount(Number(e.target.value))} placeholder="0" />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4">
                      <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-700">Auxiliary Provisions / Tax (₹)</span>
                      <input type="number" className="w-full sm:w-40 bg-white border text-left sm:text-right border-blue-100 rounded-xl px-5 py-3 text-[13px] font-black focus:outline-none focus:border-blue-400 text-blue-700 shadow-inner" value={extraCharges} onChange={e => setExtraCharges(Number(e.target.value))} placeholder="0" />
                    </div>
                    <div className="bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] text-[#2d2d2d] p-6 rounded-[28px] mt-6 shadow-md flex items-center justify-between border border-white/60">
                      <div>
                        <div className="text-[8px] uppercase tracking-[0.3em] text-[#8a8a8a] font-black mb-1">Total Aesthetic Investment</div>
                        <div className="text-2xl font-serif tracking-tighter">₹ {(grandTotal || 0).toLocaleString('en-IN')}</div>
                      </div>
                      <FileText size={40} className="text-[#CFE8D5] opacity-60" />
                    </div>
                  </div>
                </section>
              )}

              <div className="sticky bottom-0 bg-white border-t border-gray-100 py-6 px-1 mt-auto flex flex-col sm:flex-row gap-4 z-50 rounded-b-[32px]">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="flex-1 bg-white/60 border border-white/80 text-[#2d2d2d] py-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all shadow-sm active:scale-[0.98]"
                  >
                    <ChevronLeft size={18} /> Previous Phase
                  </button>
                )}
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    className="flex-1 bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] text-[#2d2d2d] py-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] hover:shadow-lg transition-all border border-white/60 active:scale-[0.98] shadow-md"
                  >
                    Proceed <ChevronRight size={18} className="text-[#4a4a4a]" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-[#CFE8D5] to-[#F0FDF4] text-[#2d2d2d] py-4 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] hover:shadow-lg transition-all border border-white/60 active:scale-[0.98] disabled:opacity-70 shadow-md"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin text-[#4a4a4a]" /> : <Save size={18} className="text-[#4a4a4a]" />} 
                    {loading ? 'Archiving...' : 'Commit to Database'}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="fixed top-0 left-0 bg-white" style={{ width: '794px', zIndex: -9999, opacity: 0.01, pointerEvents: 'none' }}>
            <div ref={previewRef}>
              <EstimatePreview data={{ clientName, events, timeline, deliverables, deliverablesPrice, discount, extraCharges, total: grandTotal, coverImage }} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
