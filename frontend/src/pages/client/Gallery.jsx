import React, { useState, useEffect } from "react";

// CRITICAL: Ensure CLOUD_NAME is correct
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "djkb4eiqf";
const CLIENT_TAG = "cclient";

export default function Gallery() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [user, setUser] = useState(null);
  const [displayTag, setDisplayTag] = useState(CLIENT_TAG);

  useEffect(() => {
    const fetchUserAndImages = async () => {
      let currentTag = CLIENT_TAG;

      // 1. Fetch User Info
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/me`, {
            headers: { 'x-auth-token': token }
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            // Use specific galleryTag if set, otherwise fallback to firstName (lowercase)
            currentTag = (userData.galleryTag && userData.galleryTag.trim() !== "") 
                         ? userData.galleryTag 
                         : userData.firstName.toLowerCase();
            setDisplayTag(currentTag);
            console.log("Portal User Data:", userData);
            console.log("Using dynamic gallery tag:", currentTag);
          } else {
            console.error("Failed to fetch user data for personalization");
          }
        }
      } catch (err) {
        console.error("Error fetching user for gallery:", err);
      }

      if (CLOUD_NAME === "YOUR_CLOUD_NAME_HERE") {
        setLoading(false);
        return;
      }

      // 2. Fetch both images and videos tagged with currentTag
      const fetchByTag = async (resourceType) => {
        try {
          // Cloudinary client-side list feature
          const response = await fetch(
            `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/list/${currentTag}.json`
          );
          if (response.ok) {
            const json = await response.json();
            return json.resources.map(res => {
              const type = res.type || "upload";
              const encodedPublicId = res.public_id.split('/').map(encodeURIComponent).join('/');
              const url = `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/${type}/v${res.version}/${encodedPublicId}.${res.format}`;
              return { type: resourceType, src: url, publicId: res.public_id };
            });
          }
        } catch (err) {
          console.error(`Error fetching ${resourceType} for ${currentTag}:`, err);
        }
        return [];
      };

      try {
        const [imgs, vids] = await Promise.all([
          fetchByTag("image"),
          fetchByTag("video")
        ]);

        const fetchedImages = [...imgs, ...vids];
        if (fetchedImages.length > 0) {
          // Randomly shuffle images
          for (let i = fetchedImages.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fetchedImages[i], fetchedImages[j]] = [fetchedImages[j], fetchedImages[i]];
          }
          setImages(fetchedImages);
        }
      } catch (error) {
        console.error("Critical Error during gallery loading:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndImages();
  }, []);

  const downloadMedia = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loader-content">
          <p>Curating your moments...</p>
          <div className="shimmer-bar"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-container">
      <header className="gallery-header">
        <h2>Our Gallery</h2>
        <div className="header-line"></div>
        <p>A curated collection of captured emotions and timeless stories.</p>
        <p style={{fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "16px", opacity: 0.7}}>
          (Admin Note: To inject Cloudinary images here, assign them the tag <strong>{displayTag}</strong>)
        </p>
      </header>

      <main className="gallery-grid-wrapper">
        {images.length > 0 ? (
          <div className="gallery-mosaic">
            {images.map((item, index) => (
              <div
                key={index}
                className={`media-tile tile-size-${(index % 5) + 1}`}
                onClick={() => setSelectedMedia(item)}
              >
                {item.type === "image" ? (
                  <img src={item.src} alt="Gallery item" loading="lazy" />
                ) : (
                  <video src={item.src} muted playsInline autoPlay loop />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Your luxury gallery is currently being curated. Check back soon for your personalized captures.</p>
          </div>
        )}
      </main>

      {selectedMedia && (
        <ImageModal
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onDownload={downloadMedia}
        />
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
                .gallery-container {
                    padding: 80px 0;
                    background: var(--bg-dark);
                    min-height: 100vh;
                }

                .gallery-header {
                    text-align: center;
                    margin-bottom: 60px;
                    padding: 0 24px;
                }

                .gallery-header h2 {
                    font-size: clamp(2rem, 5vw, 3.5rem);
                    text-transform: uppercase;
                    letter-spacing: 10px;
                    margin-bottom: 16px;
                    color: var(--text-main);
                }

                .header-line {
                    height: 1px;
                    width: 80px;
                    background: var(--primary);
                    margin: 0 auto 24px;
                }

                .gallery-header p {
                    font-family: "Inter", sans-serif;
                    color: var(--text-muted);
                    font-style: italic;
                    letter-spacing: 1px;
                    font-size: 0.9rem;
                }

                .gallery-grid-wrapper {
                    max-width: 1600px;
                    margin: 0 auto;
                    padding: 0 24px;
                }

                .gallery-mosaic {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    grid-auto-rows: 280px;
                    grid-auto-flow: dense;
                    gap: 12px;
                }

                .media-tile {
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    background: var(--bg-card);
                    border-radius: var(--radius);
                    transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
                    border: 1px solid var(--border);
                }

                .media-tile:hover {
                    box-shadow: 0 15px 35px rgba(0,0,0,0.08);
                    z-index: 10;
                    transform: translateY(-5px);
                    border-color: var(--primary);
                }

                /* Premium Masonry-like sizing */
                .tile-size-1 { grid-column: span 1; grid-row: span 1; }
                .tile-size-2 { grid-column: span 2; grid-row: span 2; }
                .tile-size-3 { grid-column: span 1; grid-row: span 2; }
                .tile-size-4 { grid-column: span 2; grid-row: span 1; }
                .tile-size-5 { grid-column: span 1; grid-row: span 1; }

                .media-tile img,
                .media-tile video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    filter: saturate(0.9);
                    transition: all 0.6s ease;
                }

                .media-tile:hover img,
                .media-tile:hover video {
                    transform: scale(1.05);
                    filter: saturate(1.1);
                }

                .modal-backdrop {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(255,255,255,0.95);
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(20px);
                }

                .modal-content {
                    position: relative;
                    max-width: 95%;
                    max-height: 95%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .modal-media {
                    max-width: 100%;
                    max-height: 80vh;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.1);
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                }

                .modal-actions {
                    margin-top: 32px;
                    display: flex;
                    gap: 16px;
                }

                .modal-btn {
                    background: #1a1a1a;
                    color: white;
                    border: none;
                    padding: 14px 40px;
                    cursor: pointer;
                    font-family: "Inter", sans-serif;
                    font-size: 0.75rem;
                    font-weight: 600;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    border-radius: 40px;
                    transition: all 0.3s;
                }

                .modal-btn:hover {
                    background: var(--primary);
                    transform: translateY(-2px);
                }

                .close-modal {
                    position: absolute;
                    top: -60px;
                    right: 0;
                    color: #000;
                    font-size: 3rem;
                    cursor: pointer;
                    background: none;
                    border: none;
                    font-weight: 200;
                }

                .loading-state {
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-dark);
                }

                .loader-content p {
                    color: var(--text-main);
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    font-size: 0.8rem;
                }

                .shimmer-bar {
                    width: 200px;
                    height: 1px;
                    background: #eee;
                    margin: 20px auto;
                    position: relative;
                    overflow: hidden;
                }

                .shimmer-bar::after {
                    content: '';
                    position: absolute;
                    top: 0; left: -100%;
                    width: 100%; height: 100%;
                    background: linear-gradient(90deg, transparent, var(--primary), transparent);
                    animation: shimmer 2s infinite;
                }

                @keyframes shimmer {
                    100% { left: 100%; }
                }

                .empty-state {
                    text-align: center;
                    padding: 100px 0;
                    color: var(--text-muted);
                }

                @media (max-width: 768px) {
                    .gallery-header h2 { font-size: 1.8rem; letter-spacing: 4px; }
                    .gallery-mosaic {
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                        grid-auto-rows: 140px;
                    }
                    .modal-actions { flex-direction: column; width: 100%; }
                    .modal-btn { width: 100%; }
                }
            `}} />
    </div>
  );
}

function ImageModal({ media, onClose, onDownload }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-modal" onClick={onClose}>&times;</button>
        {media.type === "image" ? (
          <img src={media.src.replace('/upload/', '/upload/q_auto,f_auto/')} className="modal-media" alt="Full view" />
        ) : (
          <video src={media.src} controls autoPlay className="modal-media" />
        )}
        <div className="modal-actions">
          <button
            className="modal-btn"
            onClick={() => onDownload(media.src, `${media.publicId}.${media.src.split('.').pop()}`)}
          >
            Save Memory
          </button>
          <button className="modal-btn" style={{ background: '#eee', color: '#000' }} onClick={onClose}>Back</button>
        </div>
      </div>
    </div>
  );
}
