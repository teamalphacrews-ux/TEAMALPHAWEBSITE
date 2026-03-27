import { useState, useRef, useMemo } from "react";
import { FileText, Send, IndianRupee, Plus, Trash2, X, Download, LayoutTemplate, Camera, ChevronRight, ChevronLeft } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import EstimatePreview from "./EstimatePreview";

export default function InvoiceForm({ onClose, initialClientName = "" }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [clientName, setClientName] = useState(initialClientName);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentStep, setCurrentStep] = useState(1);

  const [events, setEvents] = useState([
    { eventName: "Pre Wedding", services: "Candid Photography\nCinematography\nDrone Coverage", equipment: "SONY A7R4\nSONY FX3\nDJI AIR 3S", dateLocation: "Feb 2026", price: 35000 },
    { eventName: "Home Rituals\nBride & Groom", services: "Traditional Photography", equipment: "SONY M4", dateLocation: "9th or 10th\nApril 2026", price: 16000 },
    { eventName: "Haldi\nBride & Groom", services: "Traditional Photography", equipment: "SONY M4", dateLocation: "9th or 10th\nApril 2026", price: 16000 },
    { eventName: "Sangeeth", services: "Candid Photography\nTraditional Videography\nCinematography", equipment: "SONY A7R4\nSONY M4\nSONY FX3", dateLocation: "10th April 2026", price: 45000 },
    { eventName: "Reception", services: "Candid Photography\nTraditional Photography\nTraditional Videography X2\nCinematography\nDrone Coverage", equipment: "SONY A7R4\nSONY M4\nSONY FX-30\nSONY FX3\nDJI AIR 3S", dateLocation: "11th April 2026", price: 70000 },
    { eventName: "Muhurtham", services: "Candid Photography\nTraditional Photography\nTraditional Videography X2\nCinematography\nDrone Coverage", equipment: "SONY A7R4\nSONY M4\nSONY FX-30\nSONY FX3\nDJI AIR 3S", dateLocation: "12th April 2026", price: 70000 }
  ]);


  const [timeline, setTimeline] = useState([
    { deliverable: "Soft Copies (All photos)", time: "7 Days" },
    { deliverable: "Candid Photographs", time: "45 days" },
    { deliverable: "Cinematography Video", time: "60 days" },
    { deliverable: "Edited Traditional Video", time: "60 days" }
  ]);

  const [deliverables, setDeliverables] = useState([
    "All RAW Data",
    "35 Pre wedding Edited Photos",
    "Pre wedding cinematic Video (3 min max)",
    "Wedding edited images",
    "2 Premium Wedding Albums 15*24(40 pages)",
    "Wedding Cinematography Video 5 Min",
    "Traditional Video Edited 2 Hrs max",
    "Reels"
  ]);
  const [deliverablesPrice, setDeliverablesPrice] = useState(40000);
  const [discount, setDiscount] = useState(0);
  const [extraCharges, setExtraCharges] = useState(0);

  const [coverImage, setCoverImage] = useState("");

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

        // Use html-to-image which respects modern CSS like oklch natively via SVG rendering
        const imgData = await toJpeg(page, {
          quality: 0.95,
          backgroundColor: '#ffffff',
          pixelRatio: 2
        });

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
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
      await axios.post(`${import.meta.env.VITE_API_URL || ""}/api/invoices`, {
        clientName,
        invoiceDate,
        events,
        timeline,
        deliverables,
        deliverablesPrice,
        discount,
        extraCharges,
        total: grandTotal,
        status: 'Pending'
      }, authHeader);
      toast.success("Estimate saved to Database!");
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

  return (
    <div className="bg-white sm:rounded-3xl border border-[#e6e3df]/40 shadow-sm sm:shadow-2xl overflow-hidden w-full max-w-3xl mx-auto h-auto flex flex-col animate-in zoom-in-95 duration-300">

      <div className="p-5 md:p-6 border-b border-ivory flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-ivory/20 shrink-0">
        <div className="pr-8">
          <h2 className="font-serif text-2xl md:text-3xl text-charcoal flex items-center gap-2 md:gap-3 leading-tight">
            <LayoutTemplate className="text-mutedbrown hidden sm:block" /> Custom Estimate Generator
          </h2>
          <p className="text-[9px] md:text-[10px] text-warmgray mt-2 md:mt-1 font-bold uppercase tracking-[0.2em] leading-normal w-3/4 md:w-full">Craft beautiful PDFs instantly</p>
        </div>
        <div className="flex w-full md:w-auto gap-3 absolute top-5 right-5 md:relative md:top-auto md:right-auto justify-end">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 md:flex-none justify-center bg-white border border-[#e6e3df] text-charcoal px-4 md:px-6 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-ivory transition-all shadow-sm disabled:opacity-50"
          >
            <Download size={14} /> <span className="hidden sm:inline">{downloading ? 'Rendering...' : 'Download PDF'}</span><span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={onClose}
            className="p-2.5 bg-gray-50 md:bg-transparent hover:bg-white rounded-full transition-colors text-warmgray shrink-0 border border-[#e6e3df] md:border-transparent"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar relative">
        {/* FORM SIDE */}
        <div className="p-4 md:p-8 bg-white overflow-x-hidden">
          <form className="space-y-6" onSubmit={handleSubmit}>

            <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto no-scrollbar pb-2 mx-1 snap-x">
              {['Client', 'Events', 'Timeline', 'Deliverables'].map((step, idx) => (
                <div
                  key={idx}
                  className={`shrink-0 snap-center min-w-[110px] sm:flex-1 text-center text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-3 py-2.5 rounded-xl transition-all cursor-pointer ${currentStep === idx + 1 ? 'bg-charcoal text-white shadow-md' : 'text-warmgray bg-ivory/30 hover:bg-ivory/80'}`}
                  onClick={() => setCurrentStep(idx + 1)}
                >
                  <span className="opacity-60 block md:inline mb-0.5 md:mb-0 md:mr-1 text-[8px] md:text-[10px]">Step {idx + 1}</span>
                  {step}
                </div>
              ))}
            </div>

            {currentStep === 1 && (
              <section className="space-y-6 bg-ivory/10 p-6 rounded-2xl border border-ivory/50 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Client Name</label>
                    <input
                      required
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Rahul Mehta"
                      className="w-full bg-white border border-[#e6e3df] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-mutedbrown transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-warmgray ml-1">Cover Image (Optional)</label>
                  <div className="flex items-center gap-4">
                    {coverImage && <img src={coverImage} className="w-16 h-16 rounded-lg object-cover shadow-sm bg-gray-100" />}
                    <label className="flex items-center gap-2 px-4 py-3 bg-white border border-[#e6e3df] rounded-xl text-sm cursor-pointer hover:bg-ivory transition-all text-warmgray">
                      <Camera size={16} /> Upload Photo
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </section>
            )}

            {currentStep === 2 && (
              <section className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center pb-2 border-b border-ivory">
                  <h3 className="text-xs uppercase font-bold tracking-widest text-charcoal">Event Sessions</h3>
                  <button
                    type="button"
                    onClick={() => setEvents([...events, { eventName: "", services: "", equipment: "", dateLocation: "", price: 0 }])}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-mutedbrown hover:text-charcoal transition-colors bg-ivory/50 px-3 py-1.5 rounded-full"
                  >
                    <Plus size={14} /> Add Event
                  </button>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                  {events.map((ev, i) => (
                    <div key={i} className="bg-white border border-[#e6e3df] p-4 rounded-xl shadow-sm relative group">
                      <button type="button" onClick={() => setEvents(events.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-white text-red-400 p-1.5 rounded-full shadow-md border border-ivory opacity-0 group-hover:opacity-100 transition-all hover:text-red-600">
                        <X size={14} />
                      </button>
                      <div className="grid grid-cols-2 gap-4">
                        <textarea className="bg-ivory/20 rounded-lg p-3 text-xs border border-ivory resize-none h-16" placeholder="Event Name" value={ev.eventName} onChange={e => { const n = [...events]; n[i].eventName = e.target.value; setEvents(n); }} />
                        <textarea className="bg-ivory/20 rounded-lg p-3 text-xs border border-ivory resize-none h-16" placeholder="Services (e.g. Candid Photo)" value={ev.services} onChange={e => { const n = [...events]; n[i].services = e.target.value; setEvents(n); }} />
                        <textarea className="bg-ivory/20 rounded-lg p-3 text-xs border border-ivory resize-none h-16" placeholder="Equipment Used" value={ev.equipment} onChange={e => { const n = [...events]; n[i].equipment = e.target.value; setEvents(n); }} />
                        <div className="space-y-2">
                          <textarea className="w-full bg-ivory/20 rounded-lg p-3 text-xs border border-ivory resize-none h-12" placeholder="Date & Location" value={ev.dateLocation} onChange={e => { const n = [...events]; n[i].dateLocation = e.target.value; setEvents(n); }} />
                          <div className="flex items-center bg-ivory/20 rounded-lg border border-ivory px-3">
                            <IndianRupee size={12} className="text-warmgray" />
                            <input type="number" className="w-full bg-transparent p-2 text-xs focus:outline-none font-bold" value={ev.price} onChange={e => { const n = [...events]; n[i].price = Number(e.target.value); setEvents(n); }} placeholder="Price" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {currentStep === 3 && (
              <section className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center pb-2 border-b border-ivory">
                  <h3 className="text-xs uppercase font-bold tracking-widest text-charcoal">Delivery Timeline</h3>
                </div>
                <div className="space-y-3">
                  {timeline.map((item, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <input className="flex-1 bg-white border border-[#e6e3df] rounded-xl px-3 py-2 text-xs" placeholder="Deliverable (e.g. Soft Copies)" value={item.deliverable} onChange={e => { const m = [...timeline]; m[i].deliverable = e.target.value; setTimeline(m); }} />
                      <input className="w-1/3 bg-white border border-[#e6e3df] rounded-xl px-3 py-2 text-xs" placeholder="Timeframe (e.g. 7 days)" value={item.time} onChange={e => { const m = [...timeline]; m[i].time = e.target.value; setTimeline(m); }} />
                      <button type="button" onClick={() => setTimeline(timeline.filter((_, idx) => idx !== i))} className="text-warmgray hover:text-red-500 p-2"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setTimeline([...timeline, { deliverable: '', time: '' }])} className="text-[10px] font-bold uppercase tracking-widest text-mutedbrown hover:underline">
                    + Add Timeline Item
                  </button>
                </div>
              </section>
            )}

            {currentStep === 4 && (
              <section className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center pb-2 border-b border-ivory">
                  <h3 className="text-xs uppercase font-bold tracking-widest text-charcoal">Deliverables (Album & Editing)</h3>
                </div>
                <div className="space-y-3">
                  {deliverables.map((dItem, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <span className="w-6 text-center text-xs text-warmgray font-bold">{i + 1}.</span>
                      <input className="flex-1 bg-white border border-[#e6e3df] rounded-xl px-3 py-2 text-xs" placeholder="e.g. 35 Pre wedding Edited Photos" value={dItem} onChange={e => { const m = [...deliverables]; m[i] = e.target.value; setDeliverables(m); }} />
                      <button type="button" onClick={() => setDeliverables(deliverables.filter((_, idx) => idx !== i))} className="text-warmgray hover:text-red-500 p-2"><Trash2 size={16} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setDeliverables([...deliverables, ''])} className="text-[10px] font-bold uppercase tracking-widest text-mutedbrown hover:underline">
                    + Add Deliverable
                  </button>
                </div>

                <div className="flex flex-col gap-3 mt-4">
                  <div className="flex items-center justify-end gap-3 bg-ivory/30 p-4 rounded-xl">
                    <span className="text-xs font-bold uppercase tracking-widest">Deliverables Total (₹)</span>
                    <input type="number" className="bg-white border text-right border-[#e6e3df] rounded-xl px-4 py-2 text-sm w-32 font-bold focus:outline-mutedbrown" value={deliverablesPrice} onChange={e => setDeliverablesPrice(Number(e.target.value))} />
                  </div>
                  <div className="flex items-center justify-end gap-3 bg-red-50/50 p-4 rounded-xl border border-red-100">
                    <span className="text-xs font-bold uppercase tracking-widest text-red-600">Discount (₹)</span>
                    <input type="number" className="bg-white border text-right border-red-200 rounded-xl px-4 py-2 text-sm w-32 font-bold focus:outline-red-400 focus:ring-1 focus:ring-red-400" value={discount} onChange={e => setDiscount(Number(e.target.value))} placeholder="0" />
                  </div>
                  <div className="flex items-center justify-end gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-700">Extra Charges / Taxes (₹)</span>
                    <input type="number" className="bg-white border text-right border-blue-200 rounded-xl px-4 py-2 text-sm w-32 font-bold focus:outline-blue-400 focus:ring-1 focus:ring-blue-400" value={extraCharges} onChange={e => setExtraCharges(Number(e.target.value))} placeholder="0" />
                  </div>
                  <div className="flex items-center justify-end gap-3 bg-charcoal text-white p-4 rounded-xl mt-2 shadow-md">
                    <span className="text-[10px] uppercase tracking-widest opacity-80">Automatic Grand Total</span>
                    <span className="text-lg font-bold ml-2">₹ {grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </section>
            )}

            <div className="sticky bottom-0 bg-white border-t border-ivory py-6 mt-8 flex gap-4">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="flex-1 bg-white border border-[#e6e3df] text-charcoal py-4 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-ivory transition-all shadow-sm active:scale-[0.98]"
                >
                  <ChevronLeft size={18} /> Back
                </button>
              )}
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="flex-1 bg-charcoal text-white py-4 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-mutedbrown transition-all shadow-xl hover:shadow-2xl active:scale-[0.98]"
                >
                  Next <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-green-700 text-white py-4 rounded-xl flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-green-800 transition-all shadow-xl hover:shadow-2xl active:scale-[0.98] disabled:opacity-70"
                >
                  <Send size={18} /> {loading ? 'Saving...' : 'Save Estimate to DB'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* HIDDEN PREVIEW ELEMENT FOR PDF GENERATION */}
        <div className="fixed top-0 left-0 bg-white" style={{ width: '794px', zIndex: -9999, opacity: 0.01, pointerEvents: 'none' }}>
          <div ref={previewRef}>
            <EstimatePreview data={{ clientName, events, timeline, deliverables, deliverablesPrice, discount, extraCharges, total: grandTotal, coverImage }} />
          </div>
        </div>
      </div>
    </div>
  );
}
