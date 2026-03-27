

import { motion } from 'framer-motion';

const services = [
    {
        title: "Wedding",
        desc: "Weddings are all about traditions, colors, laughter, happy tears, families and friends coming together to celebrate the union.",
        img: "/assets/services/wedding.jpg"
    },
    {
        title: "Pre Wedding",
        desc: "Step into a world of timeless elegance. We create dreamy, cinematic frames that blend natural light and genuine emotions.",
        img: "/assets/services/pre_wedding.jpg"
    },
    {
        title: "Haldi Ceremony",
        desc: "Golden hues, pure joy, and heartfelt moments. From the playful splashes of turmeric to the candid laughter of loved ones.",
        img: "/assets/services/haldi.jpg"
    },
    {
        title: "Engagement",
        desc: "An engagement is more than a celebration - it's a promise. Highlighting every emotion, every detail, and every memory.",
        img: "/assets/services/engagement.jpg"
    }
];

const Services = () => {
    return (
        <section id="services" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-20">
                    <h2 className="text-4xl md:text-5xl font-serif mb-6 text-[#1C1C1C]">Our Services</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto font-light">Thoughtfully crafted visual storytelling for weddings, celebrations, and legacy moments.</p>
                </div>

                <div className="space-y-32">
                    {services.map((service, index) => (
                        <div key={index} className={`flex flex-col md:flex-row gap-12 items-center ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.8 }}
                                viewport={{ once: true }}
                                className="w-full md:w-1/2"
                            >
                                <img src={service.img} alt={service.title} className="w-full h-[500px] object-cover shadow-xl" />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, x: index % 2 === 0 ? 30 : -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.8 }}
                                viewport={{ once: true }}
                                className="w-full md:w-1/2 text-center md:text-left"
                            >
                                <h3 className="text-3xl font-serif mb-6">{service.title}</h3>
                                <p className="text-gray-700 leading-relaxed font-light">{service.desc}</p>
                            </motion.div>
                        </div>
                    ))}
                </div>

                {/* Vivahasya */}
                <div className="mt-32 text-center max-w-3xl mx-auto bg-[#F7F5F2] p-12 rounded-sm shadow-sm">
                    <h3 className="text-3xl font-serif mb-4">In-House Services: Vivahasya</h3>
                    <p className="text-sm font-sans uppercase tracking-widest text-gray-500 mb-6">Wedding Planner & Decor</p>
                    <p className="text-gray-700 leading-relaxed font-light mb-8">
                        Transforming your dream wedding into reality. From concept to execution, we curate every detail with precision and creativity.
                    </p>
                    <a href="https://www.vivahasya.in" target="_blank" rel="noopener noreferrer" className="border-b border-black pb-1 hover:opacity-60 transition">
                        Visit Vivahasya
                    </a>
                </div>
            </div>
        </section>
    );
};
export default Services;
