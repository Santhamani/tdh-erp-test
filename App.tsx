import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import { ManagerView } from './components/ManagerView';
import { UserDashboardView } from './components/UserDashboardView';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Header } from './components/Header';
import { GateEntryForm } from './components/GateEntryForm';
import { DispatchForm } from './components/DispatchForm';
import { WeighingForm } from './components/WeighingForm';
import { QualityCheckForm } from './components/QualityCheckForm';
import { BinOperationForm } from './components/BinOperationForm';
import { SalesForm } from './components/SalesForm';
import { ProfileModal } from './components/ProfileModal';
import { ManagerProcessView } from './components/ManagerProcessView';
import { AnalyticsModal } from './components/AnalyticsModal';
import { PROCESS_STAGES } from './constants';
import type { ProcessStage } from './types';

type View = 'dashboard' | 'process' | 'manage';

const AppContent: React.FC = () => {
    const auth = useAuth();
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [selectedStage, setSelectedStage] = useState<ProcessStage | null>(null);

    const handleToggleView = (view: View) => {
        if (view === 'manage' && !(auth.currentUser?.role === 'ADMIN' || auth.currentUser?.role === 'MANAGER')) {
            return;
        }
        setCurrentView(view);
    };

    const handleStageClick = (stage: ProcessStage) => {
        setSelectedStage(stage);
    };

    const handleCloseModal = () => {
        setSelectedStage(null);
    };

    if (auth.loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!auth.currentUser) {
        return <LoginScreen />;
    }

    const renderMainContent = () => {
        // Prevent non-managers from accessing manage view
        const isManager = auth.currentUser?.role === 'ADMIN' || auth.currentUser?.role === 'MANAGER';
        
        if (currentView === 'process') {
            if (auth.currentUser?.role === 'MANAGER' || auth.currentUser?.role === 'ASSISTANT_MANAGER' || auth.currentUser?.role === 'ADMIN') {
                return <ManagerProcessView stages={PROCESS_STAGES} onStageClick={handleStageClick} />;
            }
            switch (auth.currentUser?.role) {
                case 'GATE_ENTRY_OPERATOR':
                    return <GateEntryForm onSubmissionSuccess={() => setCurrentView('dashboard')} />;
                case 'DISPATCH_OPERATOR':
                    return <DispatchForm onSubmissionSuccess={() => setCurrentView('dashboard')} />;
                case 'WEIGHING_OPERATOR':
                    return <WeighingForm onSubmissionSuccess={() => setCurrentView('dashboard')} />;
                case 'QUALITY_OPERATOR':
                    return <QualityCheckForm onSubmissionSuccess={() => setCurrentView('dashboard')} />;
                case 'BIN_OPERATOR':
                    return <BinOperationForm onSubmissionSuccess={() => setCurrentView('dashboard')} />;
                case 'SALES_OPERATOR':
                    return <SalesForm onSubmissionSuccess={() => setCurrentView('dashboard')} />;
                default:
                    return <UserDashboardView />;
            }
        }

        // Manage view - only for managers and admins
        if (currentView === 'manage') {
            if (isManager) {
                return <ManagerView />;
            }
            // Redirect non-managers to dashboard
            return <UserDashboardView />;
        }

        // Dashboard view
        if (isManager) {
            return <AnalyticsDashboard />;
        }
        return <UserDashboardView />;
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <Header 
                currentUser={auth.currentUser} 
                onLogout={auth.logout} 
                currentView={currentView} 
                onToggleView={handleToggleView}
                onProfileClick={() => setIsProfileModalOpen(true)}
            />
            <main className="flex-grow p-4 sm:p-6 lg:p-8">
                {renderMainContent()}
            </main>
            <footer className="text-center py-4 text-sm text-slate-500 border-t border-slate-200 bg-gray-50">
                <p>Powered by A Square Technologies</p>
            </footer>
            {isProfileModalOpen && auth.currentUser && (
                <ProfileModal 
                    currentUser={auth.currentUser} 
                    onClose={() => setIsProfileModalOpen(false)} 
                />
            )}
            {selectedStage && (
                <AnalyticsModal stage={selectedStage} onClose={handleCloseModal} />
            )}
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
