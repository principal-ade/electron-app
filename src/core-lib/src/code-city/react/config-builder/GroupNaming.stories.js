import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { GroupNaming } from './GroupNaming';
const meta = {
    title: 'Code City/Config Builder/GroupNaming',
    component: GroupNaming,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        onNameChange: { action: 'name-changed' },
        onNext: { action: 'next' },
        onBack: { action: 'back' },
    },
    decorators: [
        Story => (_jsx("div", { style: { width: '400px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }, children: _jsx(Story, {}) })),
    ],
};
export default meta;
export const Default = {
    args: {
        selectedCount: 3,
        currentName: '',
    },
};
export const WithName = {
    args: {
        selectedCount: 5,
        currentName: 'Core Components',
    },
};
export const SingleItem = {
    args: {
        selectedCount: 1,
        currentName: '',
    },
};
export const ManyItems = {
    args: {
        selectedCount: 15,
        currentName: 'Application Modules',
    },
};
// Interactive story with state management
export const Interactive = {
    render: args => {
        const [name, setName] = useState('');
        return (_jsx(GroupNaming, { ...args, currentName: name, onNameChange: newName => {
                setName(newName);
                args.onNameChange?.(newName);
            } }));
    },
    args: {
        selectedCount: 4,
    },
};
export const WithCustomTheme = {
    args: {
        selectedCount: 3,
        currentName: 'Test Group',
        theme: {
            colors: {
                primary: '#10b981',
                text: '#111827',
                textSecondary: '#6b7280',
                background: '#ffffff',
                backgroundSecondary: '#f3f4f6',
                border: '#d1d5db',
            },
            radius: {
                sm: '2px',
                md: '4px',
            },
            components: {
                button: {
                    primary: {
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                    },
                    secondary: {
                        backgroundColor: '#e5e7eb',
                        color: '#374151',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #d1d5db',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                    },
                },
            },
        },
    },
};
