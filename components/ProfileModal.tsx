
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from './Modal';
import type { User } from '../types';

interface ProfileModalProps {
    currentUser: User;
    onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ currentUser, onClose }) => {
    const { updateUserProfile } = useAuth();
    const [userData, setUserData] = useState<Partial<User>>(currentUser || {});
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        setUserData(currentUser || {});
    }, [currentUser]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setUserData({ ...userData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateUserProfile(userData as User);
        setIsSaved(true);
        setTimeout(() => {
            setIsSaved(false);
            onClose();
        }, 1500);
    };
    
    const inputClasses = "mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500";
    const labelClasses = "block text-sm font-medium text-slate-600";

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">{currentUser?.name} Profile</h2>
                <div className="flex flex-col items-center text-center mb-6">
                    <p className="text-sm text-slate-500 capitalize">User: {currentUser?.role.replace(/_/g, ' ')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="name" className={labelClasses}>Full Name</label>
                            <input type="text" name="name" id="name" value={userData.name || ''} onChange={handleChange} className={inputClasses} />
                        </div>
                        <div>
                            <label htmlFor="email" className={labelClasses}>Email</label>
                            <div className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700">
                                {userData.email || ''}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="phone" className={labelClasses}>Phone</label>
                            <input type="tel" name="phone" id="phone" value={userData.phone || ''} onChange={(e) => handleChange({...e, target: {...e.target, value: e.target.value.replace(/\D/g, '').slice(0, 10)}})} maxLength={10} pattern="[0-9]{10}" className={inputClasses} />
                        </div>
                         <div className="md:col-span-2">
                            <label htmlFor="address" className={labelClasses}>Address</label>
                            <textarea name="address" id="address" value={userData.address || ''} onChange={handleChange} rows={2} className={inputClasses} />
                        </div>
                    </div>

                    <div className="pt-4 mt-4 border-t">
                        <h3 className="text-md font-semibold text-gray-800 mb-2">Emergency & Other Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="emergencyContactName" className={labelClasses}>Emergency Contact Name</label>
                                <input type="text" id="emergencyContactName" name="emergencyContactName" value={userData.emergencyContactName || ''} onChange={handleChange} className={inputClasses} />
                            </div>
                                <div>
                                <label htmlFor="emergencyContactPhone" className={labelClasses}>Emergency Contact Phone</label>
                                <input type="text" id="emergencyContactPhone" name="emergencyContactPhone" value={userData.emergencyContactPhone || ''} onChange={handleChange} className={inputClasses} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="OtherDetails" className={labelClasses}>Other Details</label>
                            <textarea id="OtherDetails" name="OtherDetails" value={userData.OtherDetails || ''} onChange={handleChange} rows={2} className={inputClasses} />
                        </div>
                    </div>

                    <div className="pt-6 mt-6 border-t flex justify-end items-center space-x-2">
                        <button type="button" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 transition" onClick={onClose}>
                            Close
                        </button>
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-semibold transition" disabled={isSaved}>
                            {isSaved ? 'Saved!' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};