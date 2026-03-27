

import { motion } from 'framer-motion';
import yogeshImg from '../assets/yogesh.jpg';
import sachithaImg from '../assets/sachitha.jpg';

const About = () => {
    return (
        <section id="about" className="py-24 px-6 max-w-7xl mx-auto">
            {/* Intro */}
            <div className="max-w-4xl mx-auto text-center mb-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <h2 className="text-4xl md:text-5xl font-serif mb-8 text-[#1C1C1C]">Welcome To Team Alpha</h2>
                    <p className="text-lg text-gray-700 leading-relaxed font-light">
                        We are a passionate team of professional wedding photographers and cinematographers,
                        dedicated to creating timeless memories that allow you to relive your special day for decades to come.
                        Our philosophy is simple - to capture the true essence of every wedding, preserving genuine emotions
                        and weaving them into beautiful, meaningful visual stories.
                    </p>
                </motion.div>
            </div>

            {/* Team */}
            <div className="grid md:grid-cols-2 gap-16 justify-center">
                {/* Person 1 */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center group"
                >
                    <div className="overflow-hidden mb-6">
                        <img
                            src={yogeshImg}
                            alt="Yogesh Acharya"
                            className="w-full h-[500px] object-cover transition duration-700 group-hover:scale-105 filter grayscale group-hover:grayscale-0"
                        />
                    </div>
                    <h3 className="text-2xl font-serif mb-1">Yogesh Acharya</h3>
                    <p className="text-sm text-gray-500 uppercase tracking-widest">Founder and DOP</p>
                </motion.div>

                {/* Person 2 */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-center group"
                >
                    <div className="overflow-hidden mb-6">
                        <img
                            src={sachithaImg}
                            alt="Sachitha Kharvi"
                            className="w-full h-[500px] object-cover transition duration-700 group-hover:scale-105 filter grayscale group-hover:grayscale-0"
                        />
                    </div>
                    <h3 className="text-2xl font-serif mb-1">Sachitha Kharvi</h3>
                    <p className="text-sm text-gray-500 uppercase tracking-widest">CEO</p>
                </motion.div>
            </div>
        </section>
    );
};
export default About;
