/**
 * Smart-Routing Utility
 * Automatically detects whether to use the Production URL, 
 * the Local IP (for mobile testing), or Localhost.
 */

const getApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // 1. If we are in production (Render), use the Environment Variable
    // But ONLY if it's not the placeholder!
    if (envUrl && !envUrl.includes("your-api-slug") && !hostname.includes("localhost") && !hostname.match(/^192\.168\./)) {
        return envUrl.replace(/\/$/, "");
    }

    // 2. If we are on a Local Network (Mobile testing on Wi-Fi)
    // We must use the browser's current hostname (the laptop's IP) to find the backend
    if (hostname.match(/^192\.168\./) || hostname.match(/^10\./) || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        return `${protocol}//${hostname}:5000`;
    }

    // 3. Fallback to localhost for laptop development
    return "http://localhost:5000";
};

export const API_BASE_URL = getApiUrl();
export default API_BASE_URL;
