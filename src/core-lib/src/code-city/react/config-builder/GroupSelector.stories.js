import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { GroupSelector } from './GroupSelector';
const meta = {
    title: 'Code City/Config Builder/GroupSelector',
    component: GroupSelector,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        onToggleSelection: { action: 'toggle-selection' },
        onNext: { action: 'next' },
        onCancel: { action: 'cancel' },
        isEditing: { control: 'boolean' },
    },
    decorators: [
        Story => (_jsx("div", { style: { width: '400px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }, children: _jsx(Story, {}) })),
    ],
};
export default meta;
const mockRootItems = [
    { name: 'src', path: 'src', type: 'directory', size: 150, isGrouped: false },
    { name: 'tests', path: 'tests', type: 'directory', size: 80, isGrouped: false },
    { name: 'docs', path: 'docs', type: 'directory', size: 20, isGrouped: true },
    { name: 'scripts', path: 'scripts', type: 'directory', size: 5, isGrouped: false },
    { name: 'package.json', path: 'package.json', type: 'file', size: 2048, isGrouped: false },
    { name: 'README.md', path: 'README.md', type: 'file', size: 5120, isGrouped: false },
];
export const Default = {
    args: {
        rootItems: mockRootItems,
        selectedDirectories: new Set(['src']),
        isEditing: false,
    },
};
export const EmptySelection = {
    args: {
        rootItems: mockRootItems,
        selectedDirectories: new Set(),
        isEditing: false,
    },
};
export const MultipleSelection = {
    args: {
        rootItems: mockRootItems,
        selectedDirectories: new Set(['src', 'tests', 'package.json']),
        isEditing: false,
    },
};
export const EditingMode = {
    args: {
        rootItems: mockRootItems,
        selectedDirectories: new Set(['src']),
        isEditing: true,
    },
};
export const AllItemsGrouped = {
    args: {
        rootItems: mockRootItems.map(item => ({ ...item, isGrouped: true })),
        selectedDirectories: new Set(),
        isEditing: false,
    },
};
// Interactive story with state management
export const Interactive = {
    render: args => {
        const [selected, setSelected] = useState(new Set(['src']));
        return (_jsx(GroupSelector, { ...args, selectedDirectories: selected, onToggleSelection: path => {
                const newSelected = new Set(selected);
                if (newSelected.has(path)) {
                    newSelected.delete(path);
                }
                else {
                    newSelected.add(path);
                }
                setSelected(newSelected);
                args.onToggleSelection?.(path);
            } }));
    },
    args: {
        rootItems: mockRootItems,
        isEditing: false,
    },
};
