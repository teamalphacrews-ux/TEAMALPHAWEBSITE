import { useState, useRef } from "react";
import { Phone, Mail, Calendar, Clock, CheckCircle, MessageCircle, AlertCircle, CalendarPlus } from "lucide-react";
import { format, addDays } from "date-fns";
import axios from "axios";
import toast from "react-hot-toast";

export default function FollowUpList({ lead, onUpdate }) {
    const token = localStorage.getItem('token');
    const authHeader = token ? { headers: { 'x-auth-token': token } } : {};
    const API = import.meta.env.VITE_API_URL || '';
  const [loading, setLoading] = useState(false);
  const dateInputRef = useRef(null);

  const handleSetFollowUp = async (daysOrDate, isDateString = false) => {
    setLoading(true);
    const nextDate = isDateString ? new Date(daysOrDate) : addDays(new Date(), daysOrDate);

    if (isNaN(nextDate.getTime())) {
      toast.error("Invalid date selected");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${lead._id}`, {
        status: 'Follow-up',
        followUpDate: nextDate
      });

      if (onUpdate) onUpdate(response.data);
      toast.success(`Follow-up scheduled for ${format(nextDate, 'MMM dd')}`);
    } catch (err) {
      console.error("Failed to update follow-up", err);
      toast.error("Error setting follow-up date");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomDateChange = (e) => {
    if (e.target.value) {
      handleSetFollowUp(e.target.value, true);
    }
  };

  const handleMarkDone = async () => {
    if (!window.confirm("Complete this follow-up?")) return;

    setLoading(true);
    try {
      const response = await axios.patch(`${import.meta.env.VITE_API_URL || ""}/api/leads/${lead._id}`, {
        followUpDate: null,
      });
      if (onUpdate) onUpdate(response.data);
      toast.success("Follow-up marked as completed");
    } catch (err) {
      toast.error("Error updating status");
    } finally {
      setLoading(false);
    }
  };

  const contactButtonClasses = (isActive) =>
    `relative overflow-hidden group flex flex-col items-center justify-center gap-2 py-4 rounded-xl text-xs font-bold transition-all duration-300 transform ${isActive
      ? 'bg-white border border-ivory text-charcoal hover:border-gold hover:shadow-lg hover:-translate-y-1'
      : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed opacity-70'
    }`;

  const renderContactButton = ({ type, isActive, icon: Icon, label, onClick, href, target }) => {
    const content = (
      <>
        <Icon size={18} className={isActive ? (type === 'whatsapp' ? "text-[#25D366] group-hover:scale-110 transition-transform" : "text-charcoal group-hover:text-gold transition-colors") : ""} />
        <span className="text-[10px] uppercase tracking-wider mt-1">{label}</span>
      </>
    );

    if (href && isActive) {
      return (
        <a href={href} target={target} rel={target === '_blank' ? "noopener noreferrer" : undefined} className={contactButtonClasses(isActive)} onClick={onClick}>
          {content}
        </a>
      );
    }

    return (
      <button onClick={onClick} className={contactButtonClasses(isActive)}>
        {content}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-4xl border border-[#e6e3df]/60 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="font-serif text-xl text-charcoal flex items-center gap-3">
            <div className="p-2 bg-ivory/50 rounded-lg">
              <Clock size={18} className="text-mutedbrown relative" />
            </div>
            Next Follow-Up
          </h3>
          <p className="text-[11px] text-warmgray mt-1">Keep track of your client engagements</p>
        </div>
        {lead.followUpDate && (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1.5 rounded-full animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Active
          </span>
        )}
      </div>

      <div className="space-y-8">
        {lead.followUpDate ? (
          <div className="relative overflow-hidden bg-linear-to-br from-ivory/40 to-white p-6 rounded-2xl border border-gold/20 flex justify-between items-center group transition-all duration-300 hover:border-gold/40">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-3xl -mr-10 -mt-10"></div>

            <div className="flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-gold shadow-sm border border-gold/10 group-hover:scale-110 transition-transform duration-500">
                <Calendar size={22} />
              </div>
              <div>
                <h4 className="font-bold text-charcoal text-base">{format(new Date(lead.followUpDate), 'EEEE, MMMM do')}</h4>
                <p className="text-[11px] uppercase tracking-wider text-warmgray mt-1 font-semibold flex items-center gap-1">
                  <Clock size={10} /> Scheduled Reminder
                </p>
              </div>
            </div>
            <button
              onClick={handleMarkDone}
              disabled={loading}
              className="relative z-10 p-3 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full transition-all hover:scale-110 hover:shadow-md"
              title="Mark as Done"
            >
              <CheckCircle size={22} className={loading ? "opacity-50" : ""} />
            </button>
          </div>
        ) : (
          <div className="relative text-center py-10 px-6 border border-dashed border-[#e6e3df] bg-gray-50/50 rounded-2xl group transition-all duration-300 hover:bg-gray-50">
            <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm text-gray-300 group-hover:text-warmgray transition-colors">
              <AlertCircle size={20} />
            </div>
            <p className="text-sm text-warmgray font-medium mb-6">No follow-up has been scheduled yet.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => handleSetFollowUp(3)}
                disabled={loading}
                className="relative overflow-hidden group/btn text-[10px] font-bold uppercase tracking-[0.2em] bg-charcoal text-white px-5 py-3 rounded-xl transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex-1 max-w-[120px]"
              >
                <div className="absolute inset-0 w-full h-full bg-linear-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]"></div>
                +3 Days
              </button>
              <button
                onClick={() => handleSetFollowUp(7)}
                disabled={loading}
                className="text-[10px] font-bold uppercase tracking-[0.2em] bg-white border border-[#e6e3df] text-charcoal px-5 py-3 rounded-xl transition-all hover:border-charcoal hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex-1 max-w-[120px]"
              >
                +1 Week
              </button>

              <div className="relative flex-1 max-w-[120px] isolate">
                <input
                  type="date"
                  onChange={handleCustomDateChange}
                  ref={dateInputRef}
                  className="absolute opacity-0 pointer-events-none w-0 h-0 -z-10"
                  style={{ left: "50%", top: "50%" }}
                  disabled={loading}
                  min={new Date().toISOString().split('T')[0]}
                />
                <button
                  disabled={loading}
                  onClick={() => {
                    if (dateInputRef.current) {
                      try {
                        dateInputRef.current.showPicker();
                      } catch (e) {
                        dateInputRef.current.focus();
                        dateInputRef.current.click();
                      }
                    }
                  }}
                  className="w-full text-[10px] font-bold uppercase tracking-[0.2em] bg-gold/10 border border-gold/30 text-gold-700 px-5 py-3 rounded-xl transition-all hover:bg-gold hover:text-white hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CalendarPlus size={12} /> Date
                </button>
              </div>

            </div>
          </div>
        )}

        <div className="pt-8 border-t border-[#e6e3df]/60">
          <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-warmgray mb-5 flex items-center gap-2">
            Quick Engagement <div className="flex-1 h-px bg-linear-to-r from-[#e6e3df] to-transparent"></div>
          </h4>
          <div className="grid grid-cols-3 gap-4">

            {renderContactButton({
              type: 'call',
              isActive: !!lead.phone,
              icon: Phone,
              label: 'Call',
              href: lead.phone ? `tel:${lead.phone.replace(/[^0-9+]/g, '')}` : undefined,
              onClick: (e) => {
                if (!lead.phone) {
                  e.preventDefault();
                  toast.error("No valid phone number to call.");
                }
              }
            })}

            {renderContactButton({
              type: 'email',
              isActive: !!lead.email,
              icon: Mail,
              label: 'Email',
              href: lead.email ? `mailto:${lead.email}` : undefined,
              onClick: (e) => {
                if (!lead.email) {
                  e.preventDefault();
                  toast.error("No email address available.");
                }
              }
            })}

            {renderContactButton({
              type: 'whatsapp',
              isActive: !!lead.phone,
              icon: MessageCircle,
              label: 'WhatsApp',
              href: lead.phone ? `https://wa.me/${lead.phone.replace(/[^0-9+]/g, '').replace('+', '')}?text=${encodeURIComponent(`Hello ${lead.name || 'there'}, regarding your upcoming ${lead.eventType || 'session'}...`)}` : undefined,
              target: '_blank',
              onClick: (e) => {
                if (!lead.phone) {
                  e.preventDefault();
                  toast.error("No phone number available for WhatsApp.");
                }
              }
            })}

          </div>
        </div>
      </div>
    </div>
  );
}
