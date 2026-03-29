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
            const textData = await res.text();
            if (textData) {
              const userData = JSON.parse(textData);
              setUser(userData);
              // Use specific galleryTag if set, otherwise fallback to firstName (lowercase)
              currentTag = (userData.galleryTag && userData.galleryTag.trim() !== "") 
                           ? userData.galleryTag 
                           : userData.firstName.toLowerCase();
              setDisplayTag(currentTag);
            }
          }
        }
      } catch (err) {
        
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
            try {
              const text = await response.text();
              if (text) {
                const json = JSON.parse(text);
                return json.resources.map(res => {
                  const type = res.type || "upload";
                  const encodedPublicId = res.public_id.split('/').map(encodeURIComponent).join('/');
                  const url = `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/${type}/v${res.version}/${encodedPublicId}.${res.format}`;
                  return { type: resourceType, src: url, publicId: res.public_id };
                });
              }
            } catch (e) {
              
            }
          }

        } catch (err) {
          
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
        
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndImages();
  }, []);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (selectedMedia) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [selectedMedia]);

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
                className="media-tile"
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
                    column-count: 4;
                    column-gap: 16px;
                    width: 100%;
                }

                .media-tile {
                    break-inside: avoid;
                    margin-bottom: 24px;
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    background: var(--bg-card);
                    border-radius: var(--radius);
                    transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
                    border: 1px solid var(--border);
                }

                .media-tile:hover {
                    box-shadow: 0 12px 30px rgba(0,0,0,0.4);
                    transform: translateY(-4px);
                    border-color: var(--primary);
                }

                .media-tile img,
                .media-tile video {
                    width: 100%;
                    height: auto;
                    display: block;
                    transition: all 0.6s ease;
                }

                .media-tile:hover img,
                .media-tile:hover video {
                    transform: scale(1.05);
                }

                /* Redefined Modal CSS for Premium Balanced UI */
                .modal-backdrop {
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                    overflow-y: auto;
                    animate: fadeIn 0.4s ease;
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .modal-container {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    width: 100%;
                    max-width: 1100px;
                    max-height: 95vh;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.5);
                    overflow: hidden;
                }

                .modal-media-wrapper {
                    flex: 1;
                    overflow-y: auto;
                    scrollbar-width: none;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #000;
                    min-height: 300px;
                }

                .modal-media-wrapper::-webkit-scrollbar { display: none; }

                .modal-media {
                    max-width: 100%;
                    max-height: 100%;
                    display: block;
                    object-fit: contain;
                }

                .modal-content-footer {
                    padding: 24px 32px;
                    background: rgba(0,0,0,0.4);
                    backdrop-filter: blur(10px);
                    border-top: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: center;
                    gap: 16px;
                }

                .modal-btn {
                    padding: 14px 28px;
                    background: #fff;
                    color: #000;
                    border: none;
                    font-family: inherit;
                    font-weight: 700;
                    font-size: 0.75rem;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    border-radius: 50px;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .modal-btn:hover {
                    background: var(--primary);
                    color: #fff;
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                }

                .modal-btn.secondary {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .modal-btn.secondary:hover {
                    background: rgba(255,255,255,0.2);
                    border-color: #fff;
                }

                .close-modal-btn {
                    position: absolute;
                    top: 24px;
                    right: 24px;
                    width: 44px;
                    height: 44px;
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(10px);
                    color: #fff;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    cursor: pointer;
                    z-index: 50;
                    transition: all 0.3s;
                }

                .close-modal-btn:hover {
                    background: #fff;
                    color: #000;
                    transform: rotate(90deg);
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

                @media (max-width: 1024px) {
                    .gallery-header h2 { font-size: 1.8rem; letter-spacing: 4px; }
                    .gallery-mosaic {
                        column-count: 2;
                    }
                    .modal-actions { flex-direction: column; width: 100%; }
                    .modal-btn { width: 100%; }
                }

                @media (max-width: 600px) {
                    .gallery-mosaic {
                        column-count: 1;
                    }
                }
            `}} />
    </div>
  );
}

function ImageModal({ media, onClose, onDownload }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <button className="close-modal-btn" onClick={onClose}>&times;</button>
        
        <div className="modal-media-wrapper">
          {media.type === "image" ? (
            <img 
              src={media.src.replace('/upload/', '/upload/q_auto,f_auto/')} 
              className="modal-media" 
              alt="Luxury Capture" 
            />
          ) : (
            <video src={media.src} controls autoPlay className="modal-media" />
          )}
        </div>

        <div className="modal-content-footer">
          <button
            className="modal-btn"
            onClick={() => onDownload(media.src, `${media.publicId}.${media.src.split('.').pop()}`)}
          >
            Save Memory
          </button>
          <button className="modal-btn secondary" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
