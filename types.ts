export type Role = 
    | 'ADMIN'
    | 'MANAGER'
    | 'ASSISTANT_MANAGER'
    | 'GATE_ENTRY_OPERATOR'
    | 'WEIGHING_OPERATOR'
    | 'QUALITY_OPERATOR'
    | 'BIN_OPERATOR'
    | 'STORE_MANAGER'
    | 'DISPATCH_OPERATOR'
    | 'PLANT_OPERATOR'
    | 'PACKAGING_OPERATOR'
    | 'CLEANING_OPERATOR'
    | 'SALES_OPERATOR';

export interface User {
    OtherDetails: string;
    emergencyContactPhone: string;
    emergencyContactName: string;
    id: string;
    name: string;
    pin: string;
    role: Role;
    email: string;
    phone?: string;
    address?: string;
    status: 'ACTIVE' | 'INACTIVE';
    isTemporaryPassword?: boolean;
}

export interface ProcessStage {
    [x: string]: any;
    id: string;
    name: string;
    description: string;
}

export interface LogEntry {
    deleted?: boolean;
    id: string;
    stageId?: string;
    timestamp: string | Date;
    userId?: string;
    userName?: string;
    action?: string;
    details?: string | Record<string, any>;
    active?: boolean; // Flag for soft delete/inactive state
}

export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'heading' | 'date' | 'time' | 'tel' | 'email' | 'password' | 'datetime-local' | 'url' | 'color' | 'dropdown' | 'file';
    placeholder?: string;
    options?: string[];
    disabled?: boolean;
}