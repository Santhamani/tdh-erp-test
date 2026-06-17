import React from 'react';
import type { ProcessStage } from '../types';

interface ManagerProcessViewProps {
    stages: ProcessStage[];
    onStageClick: (stage: ProcessStage) => void;
}

// Color mapping from Tailwind classes to CSS colors
const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    'bg-gray-100': { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },  // Changed to green
    'bg-pink-100': { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8' },
    'bg-purple-100': { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
    'bg-fuchsia-100': { bg: '#fae8ff', text: '#a21caf', border: '#f5d0fe' },
    'bg-amber-100': { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
    'bg-blue-100': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },  // Fixed dispatch blue
    'bg-sky-100': { bg: '#e0f2fe', text: '#0c4a6e', border: '#bae6fd' },  // Dispatch stage sky blue
};

export const ManagerProcessView: React.FC<ManagerProcessViewProps> = ({ stages, onStageClick }) => {
    // Active stages that can be clicked
    const activeStageIds = ['arrival', 'weighing', 'quality-check', 'processing', 'sales', 'dispatch'];
    const activeStages = stages.filter(stage => activeStageIds.includes(stage.id));
    
    // Inactive stages (greyed out, not clickable)
    const inactiveStages = stages.filter(stage => !activeStageIds.includes(stage.id));

    const getColors = (stage: ProcessStage) => {
        return colorMap[stage.color.bg] || { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' };
    };

    return (
        <div>
            {/* Active Stages Section */}
            <div className="mb-12">
                <div className="text-center mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Active Stages</h2>
                    <p className="mt-2 text-md text-slate-600 max-w-2xl mx-auto text-center">
                        Click on any stage to view detailed analytics and full activity logs.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {activeStages.map((stage) => {
                        const colors = getColors(stage);
                        return (
                            <div
                                key={stage.id}
                                onClick={() => onStageClick(stage)}
                                style={{
                                    backgroundColor: colors.bg,
                                    borderColor: colors.border,
                                    color: colors.text,
                                }}
                                className="p-6 rounded-lg border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:scale-105"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 rounded-lg bg-white text-slate-700 shadow">
                                        {stage.icon}
                                    </div>
                                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-white" style={{ color: colors.text }}>
                                        ACTIVE
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold mb-2">{stage.name}</h3>
                                <p className="text-sm line-clamp-2 mb-4 opacity-90">{stage.description}</p>
                                <div className="space-y-2 text-xs opacity-80">
                                    <p>
                                        <span className="font-semibold">Role:</span> {stage.responsibleRole}
                                    </p>
                                    <p>
                                        <span className="font-semibold">Output:</span> {stage.output}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Inactive Stages Section */}
            <div>
                <div className="text-center mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-400">Inactive Stages</h2>
                    <p className="mt-2 text-md text-slate-400 max-w-2xl mx-auto text-center">
                        Coming soon - These stages will be available in future updates.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {inactiveStages.map((stage) => (
                        <div
                            key={stage.id}
                            className="p-6 rounded-lg border-2 border-gray-300 bg-gray-100 shadow-sm opacity-50 cursor-not-allowed"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 rounded-lg bg-gray-300 text-gray-500 shadow">
                                    {stage.icon}
                                </div>
                                <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                    INACTIVE
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-600 mb-2">{stage.name}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-4">{stage.description}</p>
                            <div className="space-y-2 text-xs text-gray-500">
                                <p>
                                    <span className="font-semibold">Role:</span> {stage.responsibleRole}
                                </p>
                                <p>
                                    <span className="font-semibold">Depends on:</span> {stage.dependentOn}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};