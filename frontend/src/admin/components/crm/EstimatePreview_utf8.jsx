import React, { forwardRef } from 'react';
import { numberToIndianWords } from '../../utils/numberToWords';

const EstimatePreview = forwardRef(({ data }, ref) => {
    // A4 proportions: 794 x 1123 px at 96 DPI
    const pageStyle = "w-[794px] h-[1123px] bg-white relative mx-auto shrink-0 shadow-sm border border-gray-200 mt-4 overflow-hidden text-black font-sans box-border";

    // Total from events
    const eventsTotal = data.events?.reduce((sum, ev) => sum + (Number(ev.price) || 0), 0) || 0;

    // Render Deliverables Table mapping from lines
    const deliverablesList = Array.isArray(data.deliverables) ? data.deliverables : (data.deliverables || "").split('\n').filter(l => l.trim() !== '');
    const timelineList = data.timeline || [
        { deliverable: "Soft Copies (All photos)", time: "7 Days" },
        { deliverable: "Candid Photographs", time: "45 days" },
        { deliverable: "Cinematography Video", time: "60 days" },
        { deliverable: "Edited Traditional Video", time: "60 days" }
    ];

    // Default to an empty pixel or local asset if no coverImage to prevent CORS taint
    const coverImageUrl = data.coverImage || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    return (
        <div ref={ref} className="bg-gray-100 p-8 pt-0 flex flex-col gap-8 items-center" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* PAGE 1: COVER */}
            <div className={pageStyle + " pdf-page"}>
                {/* Decorative Elements */}
                <div className="absolute top-16 right-32 w-16 h-16 bg-[#e96e45] rounded-full z-10"></div>
                <div className="absolute -bottom-32 left-0 w-[500px] h-[500px] bg-[#f2b38f] rounded-tr-full z-10"></div>
                <div className="absolute bottom-0 right-10 w-48 h-48 bg-[#e87a5d] rounded-t-full rounded-b-0 z-20"></div>

                {/* Image Clipper */}
                <div className="absolute top-[180px] right-0 w-[450px] h-[700px] z-0 overflow-hidden" style={{ borderTopLeftRadius: '300px', borderBottomLeftRadius: '300px' }}>
                    <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                </div>

                <div className="relative z-30 pt-24 px-12">
                    <h1 className="text-[18px] font-bold tracking-widest text-[#111] uppercase mb-16 text-center w-full">
                        TEAM ALPHA WEDDING PHOTOGRAPHY ESTIMATE
                    </h1>

                    <div className="mt-8 mb-40">
                        <img src="/team-alpha-logo.png" className="w-48 h-auto object-contain" alt="Team Alpha"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                        <div style={{ display: 'none' }} className="w-48 h-48 flex items-center justifies-center bg-gray-200 font-bold text-2xl">TEAM ALPHA</div>
                    </div>

                    <div className="mt-32">
                        <div className="w-16 h-1 bg-[#1aa0a0] mb-4"></div>
                        <h2 className="text-[32px] font-bold leading-tight text-[#444] font-serif uppercase w-[350px]">
                            TURN YOUR WEDDING INTO A TIMELESS MEMORY
                        </h2>
                    </div>

                    <div className="absolute bottom-[80px] left-[50px] text-white">
                        <div className="flex items-center gap-2 text-xl font-bold">
                            <span>whatsapp +91 91106 03953</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PAGE 2: Welcome & Timeline */}
            <div className={pageStyle + " pdf-page px-16 py-20"}>
                <h2 className="text-3xl font-bold text-center mt-12 mb-10">Congratulations!!!</h2>
                <div className="text-sm space-y-4 mb-16 text-center px-12 leading-relaxed">
                    <p>We wish you a lifetime of happiness. Thank you for considering us to be a part of your Event.</p>
                    <p>It'll be a privilege to capture your most memorable journey. Our team is dedicated to giving you the best service possible and establishing a long-lasting relationship with you.</p>
                </div>

                <table className="w-[85%] mx-auto border-collapse border border-gray-400 mb-16 text-center text-[13px]">
                    <thead>
                        <tr>
                            <th className="border border-gray-400 bg-[#c0d6e4] py-3 w-16 font-bold uppercase">SL.NO</th>
                            <th className="border border-gray-400 bg-[#c0d6e4] py-3 font-bold uppercase">DELIVERABLES</th>
                            <th className="border border-gray-400 bg-[#c0d6e4] py-3 font-bold uppercase">TIMELINE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timelineList.map((item, i) => (
                            <tr key={i}>
                                <td className="border border-gray-400 py-3 font-medium">{i + 1}</td>
                                <td className="border border-gray-400 py-3 font-medium">{item.deliverable}</td>
                                <td className="border border-gray-400 py-3 font-medium">{item.time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Workflow Graphic Simulation */}
                <div className="w-[85%] mx-auto flex flex-col gap-6 font-bold text-[12px] relative pl-10">
                    <div className="flex items-center gap-6 z-10">
                        <div className="w-20 h-20 bg-blue-100 flex items-center justify-center rounded-xl shadow-sm text-2xl">??</div>
                        <p>payment confirmation with 50% advanced</p>
                    </div>
                    <div className="flex items-center justify-end gap-6 z-10 -mt-4">
                        <p className="w-48 text-right">project confirmation with other vendors & finalize deliverables with 25% payment</p>
                        <div className="w-20 h-20 bg-indigo-100 flex items-center justify-center rounded-xl shadow-sm text-2xl">??</div>
                    </div>
                    <div className="flex items-center gap-6 z-10 -mt-4">
                        <div className="w-20 h-20 bg-orange-100 flex items-center justify-center rounded-xl shadow-sm text-2xl">??</div>
                        <p className="w-48">shoot day data will be updated on drive & download link will be sent</p>
                    </div>
                    <div className="flex items-center justify-end gap-6 z-10 -mt-4">
                        <p className="w-48 text-right">selection of photos & videos from client</p>
                        <div className="w-20 h-20 bg-teal-100 flex items-center justify-center rounded-xl shadow-sm text-2xl">??</div>
                    </div>
                    <div className="flex items-center gap-6 z-10 -mt-4">
                        <div className="w-20 h-20 bg-yellow-100 flex items-center justify-center rounded-xl shadow-sm text-2xl">??</div>
                        <p className="w-48">deliver of albums & collection of remaining payment</p>
                    </div>
                </div>
            </div>

            {/* PAGE 3: MAIN ESTIMATE TABLE */}
            <div className={pageStyle + " pdf-page px-12 py-20"}>
                <h3 className="font-bold text-center text-[14px] uppercase mb-10 tracking-wide">HERE IS OUR ESTIMATE IT MAY CHANGE SUBJECT TO FURTHER DISCUSSION</h3>

                <table className="w-full border-collapse border border-gray-800 text-center text-[12px]">
                    <thead>
                        <tr>
                            <th className="border-b border-r border-gray-800 bg-[#c0d6e4] py-3 px-1 w-10 uppercase">SL.NO</th>
                            <th className="border-b border-r border-gray-800 bg-[#c0d6e4] py-3 px-2 uppercase">EVENTS</th>
                            <th className="border-b border-r border-gray-800 bg-[#c0d6e4] py-3 px-2 uppercase">SERVICES</th>
                            <th className="border-b border-r border-gray-800 bg-[#c0d6e4] py-3 px-2 uppercase">EQUIPMENT USED</th>
                            <th className="border-b border-r border-gray-800 bg-[#c0d6e4] py-3 px-2 uppercase">DATE &<br />Location</th>
                            <th className="border-b border-gray-800 bg-[#c0d6e4] py-3 px-2 uppercase w-20">Price per session</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.events?.map((ev, i) => (
                            <tr key={i}>
                                <td className="border-b border-r border-gray-800 py-4 font-bold">{i + 1}</td>
                                <td className="border-b border-r border-gray-800 py-4 font-bold max-w-[100px] wrap-break-word whitespace-pre-wrap">{ev.eventName}</td>
                                <td className="border-b border-r border-gray-800 py-4 text-xs max-w-[160px] whitespace-pre-wrap">{ev.services}</td>
                                <td className="border-b border-r border-gray-800 py-4 text-xs font-medium max-w-[120px] whitespace-pre-wrap">{ev.equipment}</td>
                                <td className="border-b border-r border-gray-800 py-4 font-bold text-xs max-w-[100px] whitespace-pre-wrap">{ev.dateLocation}</td>
                                <td className="border-b border-gray-800 py-4 font-bold">{Number(ev.price).toLocaleString('en-IN')}/-</td>
                            </tr>
                        ))}
                        {/* Empty spacer row if few items to fill some space */}
                        {(!data.events || data.events.length < 5) && (
                            <tr>
                                <td className="border-r border-gray-800 py-8"></td>
                                <td className="border-r border-gray-800 py-8"></td>
                                <td className="border-r border-gray-800 py-8"></td>
                                <td className="border-r border-gray-800 py-8"></td>
                                <td className="border-r border-gray-800 py-8"></td>
                                <td className="py-8"></td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan="6" className="bg-black text-white text-center py-4 font-bold text-sm tracking-widest uppercase">
                                TOTAL = {eventsTotal.toLocaleString('en-IN')}.00 INR ({numberToIndianWords(eventsTotal)})
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* PAGE 4: DELIVERABLES */}
            <div className={pageStyle + " pdf-page px-16 py-24 flex flex-col items-center"}>
                <h3 className="font-bold text-2xl uppercase mb-4 tracking-wide mt-10">DELIVERABLES</h3>
                <table className="w-[95%] border-collapse border border-gray-800 text-center text-[13px] font-bold mb-4">
                    <tbody>
                        <tr>
                            <td className="border border-gray-800 py-6 w-1/3 bg-[#fdfdfd]">Deliverables</td>
                            <td className="border border-gray-800 py-6 w-2/3 leading-relaxed">
                                {deliverablesList.map((d, i) => (
                                    <div key={i}>{d}</div>
                                ))}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan="2" className="border border-gray-800 bg-[#e4dfed] py-4 uppercase">
                                ALBUM AND EDITING = {(data.deliverablesPrice || 0).toLocaleString('en-IN')} INR ({numberToIndianWords(data.deliverablesPrice || 0)})
                            </td>
                        </tr>
                        {Number(data.extraCharges || 0) > 0 && (
                            <tr>
                                <td colSpan="2" className="border border-gray-800 bg-blue-50 py-3 uppercase text-[#333]">
                                    EXTRA CHARGES / TAXES = (+){Number(data.extraCharges).toLocaleString('en-IN')} INR
                                </td>
                            </tr>
                        )}
                        {Number(data.discount || 0) > 0 && (
                            <tr>
                                <td colSpan="2" className="border border-gray-800 bg-red-50 py-3 uppercase text-red-600">
                                    DISCOUNT = (-){Number(data.discount).toLocaleString('en-IN')} INR
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan="2" className="bg-black text-white py-4 text-sm leading-relaxed uppercase tracking-wider">
                                GRAND TOTAL = {(data.total || 0).toLocaleString('en-IN')} INR<br />
                                ({numberToIndianWords(data.total || 0)})
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="absolute bottom-16 left-16 right-16 text-xs text-[#0a488e] italic space-y-1">
                    <p><span className="font-bold">NOTE:</span> The Services provided are all customizable according to your requirements.</p>
                    <p>We give these services based on what we feel is right for the event and number of people in attendance.</p>
                    <p className="font-bold">Equipment that will be used during the event will be top of the line SONY ALPHA SERIES Cameras only</p>
                </div>
            </div>

            {/* PAGE 5: TERMS AND CONDITIONS */}
            <div className={pageStyle + " pdf-page px-16 py-24"}>
                <h3 className="font-bold text-[18px] uppercase mb-1 tracking-wide">TERMS & CONDITIONS</h3>
                <p className="text-[#ed1c24] font-bold text-[13px] mb-8 leading-relaxed">
                    We kindly ask you to review our Terms & Conditions carefully before making an advance payment. By completing the payment, you confirm your understanding and acceptance of these terms, helping us serve you better.
                </p>

                <div className="space-y-6 text-[12px] text-gray-700 leading-relaxed text-justify">
                    <div className="flex gap-4">
                        <span className="text-[#555] mt-1 text-[10px]">?</span>
                        <div>
                            <span className="font-bold text-black text-[13px]">BOOKING CONFIRMATION AND PAYMENTS:</span><br />
                            To confirm booking for our photography, videography, and other services, you are requested to pay an advance amount of 50% of the total project cost plus the traveling charges (if any). We follow a strict "first come first serve" policy. Without the advance payment, we cannot guarantee to block specific dates for you. The remaining balance of the total amount can be paid prior to the 1st day of the photo shoot or preferably two days in advance. We accept cash, cheque, and online transfer. We will share the transaction details once you confirm to us your preferred mode of payment.
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <span className="text-[#555] mt-1 text-[10px]">?</span>
                        <div>
                            <span className="font-bold text-black text-[13px]">CANCELLATIONS AND RESCHEDULING:</span><br />
                            Client will be responsible for payment of all expenses incurred up to the time of cancellation of the assignment, plus 50 percent of Photographer's fee. However, if notice of cancellation is given less than two (2) business days before the shoot date, the client will be charged a 100% fee. All cancellations must be in writing. Likewise, requests for rescheduling the photo shoot shall be intimated to us well in advance of the initial agreed date. In case of delayed intimation, we may not guarantee booking on your preferred new dates.
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <span className="text-[#555] mt-1 text-[10px]">?</span>
                        <div>
                            <span className="font-bold text-black text-[13px]">DISTURBANCE AT THE EVENT:</span><br />
                            you are looking for multiple photographers and videographers, we recommend booking within TEAM ALPHA as we have good rapport with our team members. If there are any other photographers/videographers (who are not a part of TEAM ALPHA), they must be briefed to cooperate with our team members. As candid photography and cinematography concentrates on special moments, subjects and detailing, there are chances that our crew members will appear on other team's camera frames and vice-versa. Any guests or family members behave rudely or threaten the photographers during the event, the situation should be handled by you. We believe to maintain professionalism of high standards and expect the same from all our clients. If there are any unavoidable circumstances, the entire crew will leave the premises with no further photoshoot. There shall also be no refund of any fees.
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <span className="text-[#555] mt-1 text-[10px]">?</span>
                        <div>
                            <span className="font-bold text-black text-[13px]">TRAVELING:</span><br />
                            We are a team based in Bengaluru. For any events/venue outside Bengaluru, all the travel expenses and accommodation must be taken care of by the client for the entire crew. If there are any events happening during the late night and the next event is scheduled in the early morning, accommodation must be taken care of by the client for the entire crew. This is applicable for Bengaluru events as well.
                        </div>
                    </div>
                </div>
            </div>

            {/* PAGE 6: DATA MANAGEMENT TERMS & CONDITIONS */}
            <div className={pageStyle + " pdf-page px-16 py-24 flex flex-col justify-between"}>
                <div>
                    <h3 className="font-bold text-[18px] mb-8 text-[#222]">Wedding Photography Data Management — Terms & Conditions</h3>

                    <div className="space-y-8 text-[13px] text-black leading-relaxed text-justify">
                        <div>
                            <span className="font-bold">1. Data Storage & Security</span><br />
                            As part of our commitment to delivering a premium experience, all final edited images are stored securely in our professional archive system for a period of 6 months from the date of delivery. We take every precaution to safeguard your wedding memories during this period through multiple redundant backups.
                        </div>

                        <div>
                            <span className="font-bold">2. Client Responsibility</span><br />
                            Upon delivery of your final gallery and/or HDD, SSD it becomes the client's responsibility to download, store, and back up their images. We highly recommend saving your photos on multiple devices and cloud services to ensure long-term preservation.
                        </div>

                        <div>
                            <span className="font-bold">3. Limitations of Liability</span><br />
                            While we employ best-in-class data management practices, we cannot be held liable for any data loss resulting from circumstances beyond our control (e.g. hardware failure, natural disasters, force majeure) after the guaranteed 6-month storage period.
                        </div>

                        <div>
                            <span className="font-bold">4. Requests for Additional Copies</span><br />
                            Should you require an additional copy of your images after the initial delivery and/or after the 6-month storage period, we will do our best to accommodate your request, subject to availability. An additional fee may apply for this service. for any data loss additional fee to made to Recover the data
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-20">
                    <h4 className="font-bold text-[18px] mb-2 uppercase">CONTACT US</h4>
                    <div className="text-[13px] text-[#555] space-y-1">
                        <p>PHONE NUMBER: +91 91106 03953</p>
                        <p>EMAIL: <a href="mailto:info@teamalphacrew.com" className="text-blue-500">info@teamalphacrew.com</a></p>
                        <p>INSTAGRAM: <a href="https://www.instagram.com/teamalpha_crew/" className="text-blue-500">@teamalpha_crew</a></p>
                    </div>
                </div>
            </div>
        </div >
    );
});

export default EstimatePreview;
