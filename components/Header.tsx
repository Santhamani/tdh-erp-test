import React, { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { ProcessIcon, UsersIcon, DashboardIcon, UserCircleIcon } from './Icons';

type View = 'process' | 'manage' | 'dashboard';

interface HeaderProps {
    currentUser: User;
    onLogout: () => void;
    currentView: View;
    onToggleView: (view: View) => void;
    onProfileClick: () => void;
}

const managerRoles: User['role'][] = ['ADMIN', 'MANAGER', 'ASSISTANT_MANAGER'];

export const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, currentView, onToggleView, onProfileClick }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isManager = managerRoles.includes(currentUser.role);
    // Add DISPATCH_OPERATOR to this array to change the button label
    const isDataEntryRole = ['GATE_ENTRY_OPERATOR', 'WEIGHING_OPERATOR', 'QUALITY_OPERATOR', 'BIN_OPERATOR', 'DISPATCH_OPERATOR', 'PLANT_OPERATOR', 'SALES_OPERATOR'].includes(currentUser.role);
    
    const processViewLabel = isDataEntryRole ? 'Create Record' : 'Process View';
    const mobileProcessViewLabel = isDataEntryRole ? 'Create Record' : 'Process';


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const NavButton: React.FC<{ view: View; label: string; icon: React.ReactNode }> = ({ view, label, icon }) => (
        <button
            onClick={() => onToggleView(view)}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center space-x-2 transition-colors ${currentView === view ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <header className="bg-white shadow-md sticky top-0 z-40">
            <div className="container mx-auto px-4 py-3 sm:px-6 lg:px-8 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                     <svg className="h-8 w-8 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                        TDH ERP System
                    </h1>
                </div>

                <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-1">
                    <NavButton view="dashboard" label="Dashboard" icon={<DashboardIcon />} />
                    <NavButton view="process" label={processViewLabel} icon={<ProcessIcon />} />
                    {isManager && <NavButton view="manage" label="Manage Team" icon={<UsersIcon />} />}
                </div>

                <div ref={dropdownRef} className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center space-x-2 p-2 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="font-bold text-slate-700 text-sm">{currentUser.name}</p>
                            <p className="text-xs text-slate-500 capitalize">{currentUser.role.replace(/_/g, ' ').toLowerCase()}</p>
                        </div>
                         <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                    </button>
                    {dropdownOpen && (
                         <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5 animate-fade-in">
                            <button
                                onClick={() => { onProfileClick(); setDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                            >
                                <UserCircleIcon /> <span>My Profile</span>
                            </button>
                            <div className="border-t my-1"></div>
                            <button
                                onClick={onLogout}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                                aria-label="Logout"
                            >
                                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l-3-3m0 0l-3 3m3-3V9" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="md:hidden flex items-center bg-slate-100 justify-around p-1 border-t">
                 <button onClick={() => onToggleView('dashboard')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex-1 text-center transition-colors ${currentView === 'dashboard' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}>Dashboard</button>
                <button onClick={() => onToggleView('process')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex-1 text-center transition-colors ${currentView === 'process' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}>{mobileProcessViewLabel}</button>
                {isManager && <button onClick={() => onToggleView('manage')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex-1 text-center transition-colors ${currentView === 'manage' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'}`}>Manage</button>}
            </div>
        </header>
    );
};