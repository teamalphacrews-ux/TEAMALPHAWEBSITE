import React from "react";

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-flex">
                <div className="footer-contact">
                    <p>WhatsApp: 91106 03953</p>
                    <span className="separator">|</span>
                    <a
                        href="https://www.instagram.com/teamalpha_crew/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link"
                    >
                        Instagram: @teamalpha_crew
                    </a>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .footer {
          background: #1c1c1c;
          color: #b8b5b0;
          padding: 24px;
        }

        .footer-flex {
          display: flex;
          justify-content: center;
          align-items: center;
          max-width: 1200px;
          margin: auto;
        }

        .footer-contact {
          display: flex;
          gap: 15px;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: 300;
        }

        .social-link {
          color: #b8b5b0;
          text-decoration: none;
          transition: color 0.3s;
        }

        .social-link:hover {
          color: #f7f5f2;
        }

        .separator {
          color: #555;
        }
      `}} />
        </footer>
    );
}
