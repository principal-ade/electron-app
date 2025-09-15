import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from 'themed-markdown';
import { GitFork, FileText, ExternalLink, Plus } from 'lucide-react';
import { RepositoryAvatar } from '../repository-maps/RepositoryAvatar';
import { getTagColor } from '../../utils/tagUtils';
import { getLicenseColor, getLicenseDisplayName } from '../../utils/licenseUtils';
export const EphemeralRepositoryCard = ({ repository, onAddLocally, onOpenInGitHub, loading = false, }) => {
    const { theme } = useTheme();
    return (_jsxs("div", { style: {
            backgroundColor: theme.colors.backgroundSecondary,
            border: `2px solid ${theme.colors.primary}40`,
            borderRadius: '8px',
            padding: '16px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: '180px',
            opacity: loading ? 0.7 : 1,
            transition: 'opacity 0.2s',
        }, children: [repository.metadata?.license && (_jsxs("div", { style: {
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: `${getLicenseColor(repository.metadata.license.key)}15`,
                    border: `1px solid ${getLicenseColor(repository.metadata.license.key)}40`,
                    fontSize: '11px',
                    fontWeight: 600,
                    color: getLicenseColor(repository.metadata.license.key),
                    zIndex: 1,
                }, title: repository.metadata.license.name || 'License', children: [_jsx(FileText, { size: 11 }), getLicenseDisplayName(repository.metadata.license)] })), _jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '8px',
                    alignItems: 'start',
                }, children: [_jsx("div", { style: { gridRow: 'span 2' }, children: _jsx(RepositoryAvatar, { repository: repository, size: 48, type: "repository" }) }), _jsx("a", { href: repository.remoteUrl, target: "_blank", rel: "noopener noreferrer", onClick: (e) => {
                            e.stopPropagation();
                        }, style: {
                            fontSize: '16px',
                            fontWeight: 600,
                            color: theme.colors.primary,
                            margin: '0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textDecoration: 'none',
                            display: 'block',
                            cursor: 'pointer',
                            transition: 'color 0.2s',
                            lineHeight: '1.2',
                        }, onMouseEnter: (e) => {
                            e.currentTarget.style.color = theme.colors.primary;
                            e.currentTarget.style.textDecoration = 'underline';
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.color = theme.colors.primary;
                            e.currentTarget.style.textDecoration = 'none';
                        }, children: repository.name }), _jsx("p", { style: {
                            fontSize: '14px',
                            color: theme.colors.textSecondary,
                            margin: '0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.2',
                        }, children: repository.owner })] }), repository.metadata?.description && (_jsx("p", { style: {
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    margin: '0',
                    lineHeight: '1.4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                }, children: repository.metadata.description })), repository.tags && repository.tags.length > 0 && (_jsxs("div", { style: {
                    display: 'flex',
                    gap: '4px',
                    flexWrap: 'wrap',
                    marginTop: '4px',
                    marginBottom: '4px',
                }, children: [repository.tags.slice(0, 3).map(tag => (_jsx("span", { style: {
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: `${getTagColor(tag)}15`,
                            color: getTagColor(tag),
                            border: `1px solid ${getTagColor(tag)}30`,
                            fontWeight: 500,
                            opacity: 0.9,
                        }, children: tag }, tag))), repository.tags.length > 3 && (_jsxs("span", { style: {
                            fontSize: '11px',
                            padding: '2px 6px',
                            color: theme.colors.textSecondary,
                            fontStyle: 'italic',
                        }, children: ["+", repository.tags.length - 3, " more"] }))] })), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    flex: 1,
                    flexWrap: 'wrap',
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            backgroundColor: theme.colors.backgroundTertiary,
                            color: theme.colors.primary,
                            border: `1px solid ${theme.colors.primary}30`,
                            fontSize: '11px',
                            fontWeight: 500,
                        }, children: [_jsx(GitFork, { size: 10 }), _jsx("span", { children: "PARENT" })] }), repository.metadata?.language && (_jsx("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: _jsx("span", { children: repository.metadata.language }) })), repository.metadata?.starCount !== undefined && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: ["\u2B50 ", repository.metadata.starCount.toLocaleString()] })), repository.metadata?.forkCount !== undefined && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [_jsx(GitFork, { size: 12 }), repository.metadata.forkCount.toLocaleString()] }))] }), _jsxs("div", { style: {
                    display: 'flex',
                    gap: '8px',
                    marginTop: 'auto',
                }, children: [_jsxs("button", { onClick: (e) => {
                            e.stopPropagation();
                            onOpenInGitHub();
                        }, disabled: loading, style: {
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            backgroundColor: theme.colors.backgroundTertiary,
                            color: theme.colors.text,
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: '6px',
                            padding: '8px 12px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                            opacity: loading ? 0.5 : 1,
                        }, onMouseEnter: (e) => {
                            if (!loading) {
                                e.currentTarget.style.backgroundColor = theme.colors.background;
                                e.currentTarget.style.borderColor = theme.colors.primary;
                            }
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                            e.currentTarget.style.borderColor = theme.colors.border;
                        }, children: [_jsx(ExternalLink, { size: 14 }), "Open in GitHub"] }), _jsxs("button", { onClick: (e) => {
                            e.stopPropagation();
                            onAddLocally();
                        }, disabled: loading, style: {
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            backgroundColor: theme.colors.primary,
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'all 0.2s',
                            opacity: loading ? 0.5 : 1,
                        }, onMouseEnter: (e) => {
                            if (!loading) {
                                e.currentTarget.style.opacity = '0.9';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }, children: [_jsx(Plus, { size: 14 }), "Add to Repositories"] })] })] }));
};
