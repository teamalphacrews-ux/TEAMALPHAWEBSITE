import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Star, Quote } from 'lucide-react';

const Testimonials = () => {
    const reviews = [
        {
            id: 1,
            author: "Abhishek Khr",
            rating: 5,
            text: "We hired Team alpha photography (Yogesh) for our wedding, and it was one of the best decisions we made! From pre-wedding shoots to the final album, everything was handled with perfection.",
            reply: "Thank you so much Abhishek! It was a pleasure capturing your special moments.",
            date: "Recent"
        },
        {
            id: 2,
            author: "SOWMYASHREE K N",
            rating: 5,
            text: "Best work ever, standard is amazing, really worth for the money. If anyone looking for photography team then just go with Team Alpha without doubt.",
            reply: "We're thrilled to hear that! Quality is our top priority.",
            date: "Recent"
        },
        {
            id: 3,
            author: "keshava k",
            rating: 5,
            text: "Excellent service from Team ALPHA, highly happy with the cinematic video and also the photo quality.",
            reply: "Happy to serve! Cinematic storytelling is what we love.",
            date: "Recent"
        },
        {
            id: 4,
            author: "Hemanth ms",
            rating: 5,
            text: "I had an amazing experience with Team Alpha Photography! Their creativity and professionalism exceeded my expectations.",
            reply: "Thanks Hemanth! Creativity is at the core of Team Alpha.",
            date: "Recent"
        },
        {
            id: 6,
            author: "Rahul Verma",
            rating: 5,
            text: "The best photography team in town. They are punctual, professional, and very creative with their angles. My family was very impressed with the final album.",
            reply: "Professionalism is key for us, Rahul. Thank you for the kind words!",
            date: "Recent"
        },
        {
            id: 7,
            author: "Sneha Reddy",
            rating: 5,
            text: "Wonderful experience with Yogesh and his team. They made us feel so comfortable during the shoot, and the results speak for themselves. Simply stunning!",
            reply: "Making clients feel comfortable is our secret sauce! Thanks Sneha.",
            date: "Recent"
        },
        {
            id: 8,
            author: "Vikram Sait",
            rating: 5,
            text: "If you want high-quality cinematic videos, Team Alpha is the way to go. Their equipment and vision are truly professional. 5 stars all the way!",
            reply: "Cinematic videos are our passion, Vikram. Glad you enjoyed our work!",
            date: "Recent"
        }
    ];

    // Duplicate reviews for infinite scroll
    const duplicatedReviews = [...reviews, ...reviews];

    return (
        <section className="py-24 bg-[#F2EFEA] overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-5xl font-serif mb-4">Client Stories</h2>
                    <p className="text-gray-600 font-light tracking-widest uppercase text-xs">Testimonials from Google Reviews</p>
                </motion.div>

                <div className="relative">
                    <div className="flex overflow-hidden relative">
                        <motion.div
                            className="flex gap-8"
                            animate={{
                                x: [0, -1 * (reviews.length * 482)], // 450px width + 32px gap
                            }}
                            transition={{
                                duration: 40,
                                ease: "linear",
                                repeat: Infinity,
                            }}
                            whileHover={{ animationPlayState: 'paused' }}
                            style={{ width: "fit-content" }}
                        >
                            {duplicatedReviews.map((review, idx) => (
                                <div
                                    key={`${review.id}-${idx}`}
                                    className="min-w-[350px] md:min-w-[450px] bg-white/60 backdrop-blur-sm p-10 rounded-2xl border border-white/40 shadow-xl relative group"
                                >
                                    <Quote className="absolute top-6 right-6 text-black/5 w-16 h-16 group-hover:text-black/10 transition-colors" />

                                    <div className="flex gap-1 mb-6">
                                        {[...Array(review.rating)].map((_, i) => (
                                            <Star key={i} size={14} className="fill-black text-black" />
                                        ))}
                                    </div>

                                    <p className="text-gray-700 leading-relaxed italic mb-8 font-light text-lg">
                                        "{review.text}"
                                    </p>

                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-serif font-bold text-lg">{review.author}</h4>
                                            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{review.date}</span>
                                        </div>
                                        <div className="bg-black text-white px-3 py-1 rounded-full text-[10px] uppercase tracking-tighter">Verified Review</div>
                                    </div>

                                    {review.reply && (
                                        <div className="mt-8 pt-8 border-t border-gray-100">
                                            <p className="text-xs text-gray-500 font-light italic">
                                                <span className="font-semibold text-black not-italic block mb-1">Response from Team Alpha:</span>
                                                {review.reply}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </motion.div>
                    </div>

                    <div className="mt-12 text-center text-gray-400 text-xs tracking-widest flex items-center justify-center gap-4">
                        <span className="h-[1px] w-12 bg-gray-200"></span>
                        DRAG TO EXPLORE
                        <span className="h-[1px] w-12 bg-gray-200"></span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;
