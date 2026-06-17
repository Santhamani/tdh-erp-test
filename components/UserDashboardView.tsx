
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
    TruckIcon, ScaleIcon, ArchiveBoxIcon, 
    ClockIcon, ExclamationCircleIcon, CogIcon, ShieldCheckIcon, 
    UsersIcon, UserGroupIcon, ChartBarIcon, DocumentTextIcon, ArrowRightIcon, PaperAirplaneIcon
} from './Icons';
import { WeighingActivityTable } from './WeighingActivityTable';
import { GateEntryActivityTable } from './GateEntryActivityTable';
import { StorageActivityTable } from './StorageActivityTable';
import { QualityCheckActivityTable } from './QualityCheckActivityTable';
import { DispatchActivityTable } from './DispatchActivityTable';
import { ProcessingActivityTable } from './ProcessingActivityTable';
import { SalesActivityTable } from './SalesActivityTable';

// A generic card for displaying stats
const StatCard = ({ icon, label, value }: { icon: JSX.Element, label: string, value: string | number }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-3 border border-slate-100">
        <div className="bg-red-50 p-3 rounded-full text-red-600">
            {icon}
        </div>
        <div>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            <p className="text-xl font-bold text-slate-800">{value}</p>
        </div>
    </div>
);

export const UserDashboardView: React.FC = () => {
    const { currentUser } = useAuth();

    // If there's no user, show an error message.
    if (!currentUser) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full bg-slate-50">
                <ExclamationCircleIcon />
                <h1 className="text-xl font-semibold text-red-600 mt-4">An Error Occurred</h1>
                <p className="text-slate-500 mt-2">Could not load user dashboard. Please try logging out and back in.</p>
            </div>
        );
    }

    // This function determines what to show on the dashboard based on the user's role.
    const getDashboardData = () => {
        const baseData = {
            greeting: `Welcome, ${currentUser.name || 'User'}`,
            quote: "Ready to make an impact? Here's your current standing.",
            summaryCards: [] as { icon: JSX.Element, label: string, value: string | number }[],
            activityComponent: null as React.ReactNode,
        };

        switch (currentUser.role) {
            case 'DISPATCH_OPERATOR':
                return {
                    ...baseData,
                    greeting: "Dispatch Console",
                    quote: "Manage and record all outbound shipments.",
                    activityComponent: <DispatchActivityTable/>
                };

            case 'GATE_ENTRY_OPERATOR':
                return {
                    ...baseData,
                    greeting: "Gate Entry Console",
                    quote: "Securing and managing all entry and exit points.",
                    activityComponent: <GateEntryActivityTable currentUser={currentUser}/>
                };

            case 'WEIGHING_OPERATOR':
                return {
                    ...baseData,
                    greeting: "Weighing Operator Console",
                    quote: "Ensuring accurate and efficient weight recording.",
                    activityComponent: <WeighingActivityTable currentUser={currentUser}/>
                };

            case 'QUALITY_OPERATOR': 
                return {
                    ...baseData,
                    greeting: "Quality Check Dashboard",
                    quote: "Ensuring all materials meet the required standards.",
                    activityComponent: <QualityCheckActivityTable currentUser={currentUser}/>
                };

            case 'BIN_OPERATOR':
                return {
                    ...baseData,
                    greeting: "Storage Management",
                    quote: "Oversee all stored materials.",
                    activityComponent: <StorageActivityTable currentUser={currentUser}/>
                };

            case 'PLANT_OPERATOR':
                return {
                    ...baseData,
                    greeting: "Processing Console",
                    quote: "Track and verify processing stage records.",
                    activityComponent: <ProcessingActivityTable currentUser={currentUser}/>
                };

            case 'SALES_OPERATOR':
                return {
                    ...baseData,
                    greeting: "Sales Console",
                    quote: "Review and manage daily sales uploads.",
                    activityComponent: <SalesActivityTable currentUser={currentUser}/>
                };

            default:
                // A fallback for any other user roles.
                return {
                    ...baseData,
                    greeting: `Welcome, ${currentUser.name}`,
                    quote: "This is your main dashboard.",
                };
        }
    };

    const data = getDashboardData();

    return (
        <div className="p-4 md:p-6 space-y-8 bg-slate-50 min-h-screen">
            <div>
                <h1 className="flex flex-col items-center text-2xl font-bold text-slate-800">{data.greeting}</h1>
                <p className="flex flex-col items-center text-slate-500 mt-1">{data.quote}</p>
            </div>

            {/* Render summary cards if they exist */}
            {data.summaryCards.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.summaryCards.map((card, index) => (
                        <StatCard 
                            key={index} 
                            icon={card.icon}
                            label={card.label} 
                            value={card.value} 
                        />
                    ))}
                </div>
            )}

            {/* Render the main activity component (e.g., a table) if it exists */}
            {data.activityComponent && (
                <div className="w-full">
                    {data.activityComponent}
                </div>
            )}
        </div>
    );
};