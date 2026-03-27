import { motion } from 'framer-motion';
import { Phone, Mail, Instagram, MessageCircle } from 'lucide-react';

const Contact = () => {
    return (
        <section className="py-24 bg-white border-t border-gray-100">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-5xl font-serif mb-4">Get In Touch</h2>
                    <p className="text-gray-600 font-light tracking-widest uppercase text-xs">Reach Out To Us</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Phone */}
                    <a href="tel:+919110603953" className="group flex flex-col items-center bg-[#F2EFEA] p-10 rounded-2xl hover:bg-black hover:-translate-y-2 transition-all duration-500">
                        <Phone className="w-8 h-8 mb-6 text-gray-700 group-hover:text-white transition-colors duration-500" strokeWidth={1.5} />
                        <h3 className="font-serif text-xl mb-2 text-black group-hover:text-white transition-colors duration-500">Phone</h3>
                        <p className="text-sm tracking-wider font-light text-gray-500 group-hover:text-gray-300 transition-colors duration-500">+91 91106 03953</p>
                    </a>

                    {/* Email */}
                    <a href="mailto:Teamalphacrews@gmail.com" className="group flex flex-col items-center bg-[#F2EFEA] p-10 rounded-2xl hover:bg-black hover:-translate-y-2 transition-all duration-500">
                        <Mail className="w-8 h-8 mb-6 text-gray-700 group-hover:text-white transition-colors duration-500" strokeWidth={1.5} />
                        <h3 className="font-serif text-xl mb-2 text-black group-hover:text-white transition-colors duration-500">Email</h3>
                        <p className="text-xs tracking-wider font-light text-gray-500 group-hover:text-gray-300 transition-colors duration-500">Drop us a line</p>
                    </a>

                    {/* WhatsApp */}
                    <a href="https://wa.me/919110603953" target="_blank" rel="noreferrer" className="group flex flex-col items-center bg-[#F2EFEA] p-10 rounded-2xl hover:bg-black hover:-translate-y-2 transition-all duration-500">
                        <MessageCircle className="w-8 h-8 mb-6 text-gray-700 group-hover:text-white transition-colors duration-500" strokeWidth={1.5} />
                        <h3 className="font-serif text-xl mb-2 text-black group-hover:text-white transition-colors duration-500">WhatsApp</h3>
                        <p className="text-sm tracking-wider font-light text-gray-500 group-hover:text-gray-300 transition-colors duration-500">Message Us</p>
                    </a>

                    {/* Instagram */}
                    <a href="https://instagram.com/teamalpha_crew" target="_blank" rel="noreferrer" className="group flex flex-col items-center bg-[#F2EFEA] p-10 rounded-2xl hover:bg-black hover:-translate-y-2 transition-all duration-500">
                        <Instagram className="w-8 h-8 mb-6 text-gray-700 group-hover:text-white transition-colors duration-500" strokeWidth={1.5} />
                        <h3 className="font-serif text-xl mb-2 text-black group-hover:text-white transition-colors duration-500">Instagram</h3>
                        <p className="text-sm tracking-wider font-light text-gray-500 group-hover:text-gray-300 transition-colors duration-500">@teamalpha_crew</p>
                    </a>
                </div>
            </div>
        </section>
    );
};

export default Contact;
