
import { motion } from 'framer-motion';
import { useState } from 'react';

const GetQuote = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        date: '',
        budget: '',
        message: '',
        eventTypes: [],
        customEvent: ''
    });

    const eventOptions = ['Wedding', 'Pre-Wedding', 'Engagement', 'Haldi', 'Sangeet', 'Others'];

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEventTypeChange = (type) => {
        const updatedTypes = formData.eventTypes.includes(type)
            ? formData.eventTypes.filter(t => t !== type)
            : [...formData.eventTypes, type];
        setFormData({ ...formData, eventTypes: updatedTypes });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const selectedEvents = formData.eventTypes.map(t =>
            t === 'Others' && formData.customEvent ? `${t} (${formData.customEvent})` : t
        ).join(', ');

        const text = `*New Quote Request*\n\n` +
            `*Name:* ${formData.firstName} ${formData.lastName}\n` +
            `*Email:* ${formData.email}\n` +
            `*Event Types:* ${selectedEvents || 'Not specified'}\n` +
            `*Date:* ${formData.date}\n` +
            `*Budget:* ${formData.budget}\n` +
            `*Message:* ${formData.message}`;

        const encodedText = encodeURIComponent(text);
        const url = `https://wa.me/916361472306?text=${encodedText}`;

        window.open(url, '_blank');
    };

    return (
        <div className="font-sans text-[#1C1C1C] bg-[#F7F5F2] min-h-screen selection:bg-black selection:text-white pt-24">
            <section id="contact" className="py-12 px-6 bg-[#F7F5F2]">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-20">
                    {/* Info */}
                    <div className="md:w-1/3">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                        >
                            <h2 className="text-4xl font-serif mb-6">Get a Quote</h2>
                            <p className="text-gray-600 mb-8 font-light leading-relaxed">
                                We would love to hear your story. Please fill out the form and we will get back to you shortly.
                            </p>
                            <div className="space-y-4 text-sm tracking-wide text-gray-800">
                                <p>EMAIL: Teamalphacrews@gmail.com</p>
                                <p>PHONE: +91 9110603953</p>
                            </div>
                        </motion.div>
                    </div>

                    {/* Form */}
                    <div className="md:w-2/3">
                        <form className="space-y-8" onSubmit={handleSubmit}>
                            <div className="grid md:grid-cols-2 gap-8">
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    placeholder="First Name *"
                                    required
                                    className="bg-transparent border-b border-gray-400 py-3 focus:outline-none focus:border-black transition w-full placeholder-gray-500 font-light"
                                />
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    placeholder="Last Name *"
                                    required
                                    className="bg-transparent border-b border-gray-400 py-3 focus:outline-none focus:border-black transition w-full placeholder-gray-500 font-light"
                                />
                            </div>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Email *"
                                required
                                className="bg-transparent border-b border-gray-400 py-3 focus:outline-none focus:border-black transition w-full placeholder-gray-500 font-light"
                            />

                            {/* Type of Event Multi-select */}
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500 font-light uppercase tracking-widest">Type of Event *</p>
                                <div className="flex flex-wrap gap-3">
                                    {eventOptions.map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleEventTypeChange(type)}
                                            className={`px-4 py-2 text-xs border transition-all duration-300 ${formData.eventTypes.includes(type)
                                                    ? 'bg-black text-white border-black'
                                                    : 'border-gray-300 text-gray-600 hover:border-black'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                                {formData.eventTypes.includes('Others') && (
                                    <motion.input
                                        initial={{ opacity: 0, scaleY: 0 }}
                                        animate={{ opacity: 1, scaleY: 1 }}
                                        type="text"
                                        name="customEvent"
                                        value={formData.customEvent}
                                        onChange={handleChange}
                                        placeholder="Please specify your event *"
                                        required
                                        className="bg-transparent border-b border-gray-400 py-3 focus:outline-none focus:border-black transition w-full placeholder-gray-500 font-light"
                                    />
                                )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <input
                                    type="text"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    placeholder="Date of Event"
                                    onFocus={(e) => e.target.type = 'date'}
                                    onBlur={(e) => e.target.type = 'text'}
                                    className="bg-transparent border-b border-gray-400 py-3 focus:outline-none focus:border-black transition w-full placeholder-gray-500 font-light"
                                />
                                <input
                                    type="text"
                                    name="budget"
                                    value={formData.budget}
                                    onChange={handleChange}
                                    placeholder="Estimated Budget"
                                    className="bg-transparent border-b border-gray-400 py-3 focus:outline-none focus:border-black transition w-full placeholder-gray-500 font-light"
                                />
                            </div>
                            <textarea
                                rows="4"
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                placeholder="Tell us about your day"
                                className="bg-transparent border-b border-gray-400 py-3 focus:outline-none focus:border-black transition w-full placeholder-gray-500 font-light"
                            ></textarea>

                            <button type="submit" className="mt-4 bg-[#1C1C1C] text-white px-12 py-4 tracking-widest text-xs uppercase hover:bg-opacity-80 transition duration-300">
                                Send via WhatsApp
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        </div>
    );
};
export default GetQuote;
