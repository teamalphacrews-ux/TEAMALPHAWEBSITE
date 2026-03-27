import React from 'react';

const Cloud = () => {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/me`, {
                        headers: { 'x-auth-token': token }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setUser(data);
                        console.log("Portal Cloud User Data:", data);
                    } else {
                        console.error("Failed to fetch user data for cloud storage");
                    }
                }
            } catch (err) {
                console.error("Error fetching user for cloud:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);

    const cloudLink = (user?.cloudLink && user.cloudLink.trim() !== "") 
                      ? user.cloudLink 
                      : "https://teamalpha.studio/shared";
    const cloudPassword = (user?.cloudPassword && user.cloudPassword.trim() !== "") 
                          ? user.cloudPassword 
                          : "WAITING";

    if (loading) return <div className="cloud-page"><p className="text-white">Loading your secure storage...</p></div>;

    return (
        <div className="cloud-page">
            <div className="cloud-container">
                <h1 className="cloud-title">Cloud Storage</h1>
                <p className="cloud-subtitle">Securely access your high-resolution files</p>

                <div className="folder-link-container">
                    <a
                        href={cloudLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="folder-card"
                    >
                        <div className="folder-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z" fill="currentColor" />
                            </svg>
                        </div>
                        <span className="folder-text">{user?.firstName ? `${user.firstName}'s` : "Team Alpha"} Shared Files</span>
                        {user?.cloudLink && <span style={{fontSize: "0.75rem", color: "var(--primary)", marginTop: "12px", textTransform: "none", letterSpacing: "normal", fontWeight: "400", wordBreak: "break-all"}}>{user.cloudLink}</span>}
                    </a>
                </div>

                <div className="password-section">
                    <p className="password-label">Access Password</p>
                    <div className="password-box">
                        <span className="password-text" style={{ userSelect: 'all' }}>{cloudPassword}</span>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .cloud-page {
                    padding: 80px 24px;
                    min-height: calc(100vh - 80px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: var(--bg-dark);
                    font-family: 'Inter', sans-serif;
                }

                .cloud-container {
                    background: white;
                    padding: 60px 48px;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    box-shadow: 0 10px 40px rgba(0,0,0,0.03);
                    max-width: 550px;
                    width: 100%;
                    text-align: center;
                    position: relative;
                }

                .cloud-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 2.2rem;
                    margin-bottom: 8px;
                    color: var(--text-main);
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }

                .cloud-subtitle {
                    color: var(--text-muted);
                    margin-bottom: 48px;
                    font-size: 0.9rem;
                    letter-spacing: 0.5px;
                }

                .folder-link-container {
                    margin-bottom: 48px;
                }

                .folder-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    background: var(--bg-card);
                    border-radius: var(--radius);
                    border: 1px solid transparent;
                    transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
                    color: var(--text-main);
                }

                .folder-card:hover {
                    border-color: var(--primary);
                    background: #fff;
                    transform: translateY(-5px);
                    box-shadow: 0 15px 30px rgba(0,0,0,0.06);
                }

                .folder-icon {
                    width: 56px;
                    height: 56px;
                    color: var(--primary);
                    margin-bottom: 20px;
                }

                .folder-text {
                    font-weight: 600;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }

                .password-section {
                    border-top: 1px solid var(--border);
                    padding-top: 40px;
                }

                .password-label {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    margin-bottom: 16px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .password-box {
                    background: var(--bg-card);
                    color: var(--text-main);
                    padding: 16px 36px;
                    display: inline-block;
                    font-family: "Inter", sans-serif;
                    font-size: 1.6rem;
                    letter-spacing: 4px;
                    border-radius: 12px;
                    border: 1px dashed var(--primary);
                    font-weight: 700;
                }

                @media (max-width: 600px) {
                    .cloud-container { padding: 40px 24px; }
                    .cloud-title { font-size: 1.8rem; }
                }
                `
            }} />
        </div>
    );
};

export default Cloud;
