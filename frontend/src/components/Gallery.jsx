import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Grid, LayoutTemplate } from 'lucide-react';




// Dynamic imports for all categories
const localImages = {
    "Wedding": Object.values(import.meta.glob('../assets/wedding/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })),
    "Engagement": Object.values(import.meta.glob('../assets/engagement/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })),
    "Pre Wedding": Object.values(import.meta.glob('../assets/pre_wedding/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })),
    "Haldi": Object.values(import.meta.glob('../assets/haldi/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })),
    "Reception": Object.values(import.meta.glob('../assets/reception/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })),
    "Mehendi": Object.values(import.meta.glob('../assets/mehendi/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }))
};

// Cover images (DPs)
const localCovers = import.meta.glob('../assets/covers/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });

// Fallback images if folders are empty
const defaultImages = {
    "Wedding": "/assets/services/wedding.jpg",
    "Engagement": "/assets/services/engagement.jpg",
    "Pre Wedding": "/assets/services/pre_wedding.jpg",
    "Haldi": "/assets/services/haldi.jpg",
    "Reception": "/assets/services/wedding.jpg", // Fallback
    "Mehendi": "/assets/services/haldi.jpg"      // Fallback
};

const CATEGORIES = [
    { id: "Wedding", label: "Twinkling Knots", tag: "wedding" },
    { id: "Engagement", label: "Engagement", tag: "engagement" },
    { id: "Pre Wedding", label: "Pre Wedding", tag: "pre_wedding" },
    { id: "Haldi", label: "Haldi Ceremony", tag: "haldi" },
    { id: "Reception", label: "Reception", tag: "reception" },
    { id: "Mehendi", label: "Mehendi", tag: "mehendi" }
];

const Gallery = () => {
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [cloudData, setCloudData] = useState({});

    // Cloudinary Configuration
    const CLOUD_NAME = "djkb4eiqf";

    useEffect(() => {
        if (CLOUD_NAME) {
            // Fetch for each category
            CATEGORIES.forEach(cat => {
                fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/list/${cat.tag}.json`)
                    .then(res => res.json())
                    .catch((err) => {
                        console.error(`Cloudinary fetch failed for tag ${cat.tag}:`, err);
                        return { resources: [] };
                    })
                    .then(data => {
                        if (data.resources) {
                            const urls = data.resources.map(res =>
                                `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${res.version}/${res.public_id}.${res.format}`
                            );
                            setCloudData(prev => ({ ...prev, [cat.id]: urls }));
                        }
                    })
                    .catch((err) => {
                        console.error(`Cloudinary fetch failed for category ${cat.id}:`, err);
                        console.log("Tip: Ensure 'Resource List' is enabled in Cloudinary Security settings.");
                    });
            });
        }
    }, [CLOUD_NAME]);

    // get images for a category (Cloud -> Local -> Default)
    const getImages = (id) => {
        const cloud = cloudData[id];
        if (cloud && cloud.length > 0) return cloud;

        const local = localImages[id];
        if (local && local.length > 0) return local;

        return [defaultImages[id]];
    };

    // get cover image (Local Cover -> Cloud Album[0] -> Local Album[0] -> Default)
    const getCover = (id) => {
        const normalizedId = id.toLowerCase().replace(' ', '_');

        // Strict match: filename (without path/extension) must equal normalizedId
        const key = Object.keys(localCovers).find(k => {
            // k example: "../assets/covers/wedding.png"
            const filename = k.split('/').pop().split('.')[0];
            return filename.toLowerCase() === normalizedId;
        });

        if (key) return localCovers[key];

        return getImages(id)[0];
    };

    const openAlbum = (category) => {
        setSelectedAlbum(category);
    };

    const closeAlbum = () => {
        setSelectedAlbum(null);
    };

    useEffect(() => {
        if (selectedAlbum) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [selectedAlbum]);

    return (
        <section id="gallery" className="py-24 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-serif mb-6">Our Portfolio</h2>
                <p className="text-gray-600 font-light">Capturing moments that last forever.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {CATEGORIES.map((cat, idx) => {
                    const coverImg = getCover(cat.id);
                    return (
                        <motion.div
                            key={cat.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            className="group relative overflow-hidden cursor-pointer"
                            onClick={() => openAlbum(cat.id)}
                        >
                            <img
                                src={coverImg} // Use specific cover
                                alt={cat.label}
                                className="w-full h-[400px] object-cover transition duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-500 flex flex-col items-center justify-center">
                                <h3 className="text-white font-serif text-2xl mb-2">{cat.label}</h3>
                                <p className="text-white font-serif text-lg tracking-wider border-b border-white pb-1">View Album</p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Album Modal */}
            <AnimatePresence>
                {selectedAlbum && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm overflow-y-auto"
                    >
                        <div className="min-h-screen px-6 py-12">
                            {/* Header */}
                            <div className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center bg-black/50 backdrop-blur-md z-50">
                                <h3 className="text-white font-serif text-2xl">{CATEGORIES.find(c => c.id === selectedAlbum)?.label}</h3>

                                <div className="flex items-center gap-6">
                                    {/* View Toggle */}
                                    <div className="flex bg-white/10 rounded-lg p-1">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-2 rounded-md transition ${viewMode === 'grid' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                                            title="Regular Grid"
                                        >
                                            <Grid size={20} />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('masonry')}
                                            className={`p-2 rounded-md transition ${viewMode === 'masonry' ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                                            title="Native Aspect Ratio"
                                        >
                                            <LayoutTemplate size={20} />
                                        </button>
                                    </div>

                                    <button onClick={closeAlbum} className="text-white hover:opacity-70 transition">
                                        <X size={32} />
                                    </button>
                                </div>
                            </div>

                            {/* Images Grid */}
                            <div className={`mt-24 max-w-7xl mx-auto ${viewMode === 'grid'
                                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                                : 'columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6'
                                }`}>
                                {getImages(selectedAlbum).map((img, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="break-inside-avoid"
                                    >
                                        <img
                                            src={img}
                                            alt={`${selectedAlbum} ${idx}`}
                                            className={`w-full rounded-lg ${viewMode === 'grid' ? 'h-[300px] object-cover' : 'h-auto'
                                                }`}
                                        />
                                    </motion.div>
                                ))}
                            </div>

                            {/* Tag Footer */}
                            <div className="mt-12 text-center pb-8">
                                <p className="text-white/50 text-xs tracking-widest font-mono">
                                    # {CATEGORIES.find(c => c.id === selectedAlbum)?.tag}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};
export default Gallery;
