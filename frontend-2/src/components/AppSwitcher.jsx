import React, { useState } from 'react';
import { UserManager } from 'oidc-client-ts';
import './AppSwitcher.css';

const AppSwitcher = ({ userRoles = [] }) => {
    console.log("Roles yang diterima Switcher:", userRoles);
    const [isOpen, setIsOpen] = useState(false);

    const apps = [
        { name: 'App Alpha', url: 'http://localhost:3001', color: '#D0E2FF', role: 'app-viewer' },
        { name: 'App Beta', url: 'http://localhost:3002', color: '#CAFFBF', role: 'app-viewer' },
    ];

    const accessibleApps = apps;

    const handleSwitch = async (targetUrl) => {
        try {
            const userManager = new UserManager({
                authority: "http://localhost:8080/realms/iom-itb",
                // SESUAIKAN: "frontend-1" jika di folder frontend-1, "frontend-2" jika di frontend-2
                client_id: "frontend-2", 
                redirect_uri: window.location.origin,
            });

            await userManager.signinSilent();
            window.location.href = targetUrl;
        } catch (err) {
            window.location.href = targetUrl;
        }
    };

    return (
        <div className="app-switcher-container">
            {/* Tombol Floating */}
            <button className="floating-btn" onClick={() => setIsOpen(!isOpen)}>
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-dashboard-icon lucide-layout-dashboard"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                )}
            </button>

            {isOpen && (
                <div className="app-modal-overlay" onClick={() => setIsOpen(false)}>
                    <div className="app-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Aplikasi Diakses</h3>
                            <button className="close-x" onClick={() => setIsOpen(false)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        <div className="app-grid">
                            {accessibleApps.map((app, index) => (
                                <div 
                                    key={index} 
                                    className="app-item" 
                                    style={{ backgroundColor: app.color }}
                                    onClick={() => handleSwitch(app.url)}
                                >
                                    <span className="app-name">{app.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppSwitcher;