'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { useAuth } from '@repo-explorer/contexts/AuthContext';
import { LogOut, Home, Calendar, User } from 'lucide-react';
import Link from '@repo-explorer/shims/next-link';
import { usePathname } from '@repo-explorer/shims/next-navigation';
export function UserAvatarMenu({ hideLoginButton = false } = {}) {
    const { theme } = useTheme();
    const { user, isAuthenticated, login, logout } = useAuth();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [organizations, setOrganizations] = useState([]);
    const [orgsLoading, setOrgsLoading] = useState(false);
    const userMenuRef = useRef(null);
    const pathname = usePathname();
    const isHomePage = pathname === '/';
    // Close user menu when clicking outside
    useEffect(() => {
        if (!userMenuOpen)
            return;
        function handleClickOutside(event) {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [userMenuOpen]);
    // Fetch organizations when menu opens
    useEffect(() => {
        if (!userMenuOpen || !isAuthenticated || organizations.length > 0)
            return;
        const fetchOrganizations = async () => {
            setOrgsLoading(true);
            try {
                const response = await fetch('/api/github/user/orgs');
                if (response.ok) {
                    const data = await response.json();
                    setOrganizations(data.organizations || []);
                }
            }
            catch (error) {
                console.error('Failed to fetch organizations:', error);
            }
            finally {
                setOrgsLoading(false);
            }
        };
        fetchOrganizations();
    }, [userMenuOpen, isAuthenticated, organizations.length]);
    if (!isAuthenticated || !user) {
        if (hideLoginButton)
            return null;
        return (_jsx("button", { onClick: () => login(), className: "flex items-center justify-center px-3 h-8 rounded-md transition-all hover:opacity-80 text-sm font-medium", style: {
                background: theme.colors.primary,
                color: theme.colors.textOnPrimary,
            }, title: "Login", children: "Login" }));
    }
    return (_jsxs("div", { className: "relative", ref: userMenuRef, children: [_jsx("button", { onClick: () => setUserMenuOpen(!userMenuOpen), className: "flex items-center rounded-full transition-all hover:opacity-80", children: user.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                _jsx("img", { src: user.avatar_url, alt: user.name || user.login, className: "w-8 h-8 rounded-full" })) }), userMenuOpen && (_jsxs("div", { className: "absolute right-0 top-full mt-1 py-1 rounded-md shadow-lg border min-w-[160px] z-50", style: {
                    background: theme.colors.background,
                    borderColor: theme.colors.border,
                }, children: [user && (_jsxs(Link, { href: `/${user.login}`, className: "flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:opacity-80", style: { color: theme.colors.text }, onClick: () => setUserMenuOpen(false), children: [_jsx(User, { className: "w-4 h-4" }), "Your Profile"] })), !isHomePage && (_jsxs(Link, { href: "/", className: "flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:opacity-80", style: { color: theme.colors.text }, onClick: () => setUserMenuOpen(false), children: [_jsx(Home, { className: "w-4 h-4" }), "Home"] })), (organizations.length > 0 || orgsLoading) && (_jsxs(_Fragment, { children: [_jsx("div", { className: "my-1 h-px", style: { background: theme.colors.border } }), _jsx("div", { className: "px-3 py-1 text-xs font-medium uppercase tracking-wider", style: { color: theme.colors.textMuted }, children: "Organizations" }), orgsLoading ? (_jsx("div", { className: "px-3 py-2 text-sm", style: { color: theme.colors.textMuted }, children: "Loading..." })) : (organizations.map((org) => (_jsxs(Link, { href: `/${org.login}`, className: "flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:opacity-80", style: { color: theme.colors.text }, onClick: () => setUserMenuOpen(false), children: [_jsx("img", { src: org.avatar_url, alt: org.login, className: "w-4 h-4 rounded" }), org.login] }, org.id))))] })), _jsxs(Link, { href: "/activity", className: "flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:opacity-80", style: { color: theme.colors.text }, onClick: () => setUserMenuOpen(false), children: [_jsx(Calendar, { className: "w-4 h-4" }), "Feed"] }), _jsx("div", { className: "my-1 h-px", style: { background: theme.colors.border } }), _jsxs("button", { onClick: () => {
                            setUserMenuOpen(false);
                            logout();
                        }, className: "flex items-center gap-2 px-3 py-2 text-sm w-full transition-colors hover:opacity-80", style: { color: theme.colors.error }, children: [_jsx(LogOut, { className: "w-4 h-4" }), "Logout"] })] }))] }));
}
