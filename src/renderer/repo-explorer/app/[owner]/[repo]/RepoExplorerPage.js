'use client';
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import Link from '@repo-explorer/shims/next-link';
import dynamic from '@repo-explorer/shims/next-dynamic';
import { useRouter } from '@repo-explorer/shims/next-navigation';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { FileText, X, Compass, Volume2, AlertTriangle, Mic, Trash2, Star, GitFork, Play, CircleDot, GitPullRequest, ChevronRight, Boxes, MapPin, Globe, Users, Building2, GitCommitHorizontal, Twitter, Mail, } from 'lucide-react';
import { FileTree as PierreFileTree, useFileTree } from '@pierre/trees/react';
import { themeToTreeStyles } from '@pierre/trees';
import { PanelEventBus, } from '@principal-ade/panel-framework-core';
import { GitFileTreeBuilder, } from '@principal-ai/repository-abstraction';
import { PackageCompositionPanelContent, } from '@industry-theme/repository-composition-panels';
import { addRecentRepository } from '@industry-theme/github-panels';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { trpc } from '@repo-explorer/lib/trpc/client';
import { useAuth } from '@repo-explorer/contexts/AuthContext';
import VibeCodingPane from '@repo-explorer/components/VibeCodingPane';
import { readRecentRepos } from '@repo-explorer/lib/recentRepos';
import { BookmarksDrawer } from '@repo-explorer/components/bookmarks/BookmarksDrawer';
import { BlockDropLoadingScreen } from '@repo-explorer/components/trail/BlockDropLoadingScreen';
import { InlineTrailLoader } from '@repo-explorer/components/trail/InlineTrailLoader';
import { ConfirmDialog } from '@repo-explorer/components/ConfirmDialog';
import { SlidePane } from '@repo-explorer/components/rail/SlidePane';
import { RailPaneHeader } from '@repo-explorer/components/rail/RailPaneHeader';
import { ActivityHeatmap } from '@repo-explorer/components/ActivityHeatmap';
import { FileSourcePanel } from './FileSourcePanel';
import { RepoActivityPane } from './RepoActivityPane';
import { RepoIssuesPane } from './RepoIssuesPane';
import { RepoPullRequestsPane } from './RepoPullRequestsPane';
import { RepoAnalysisProvider, useRepoAnalysis, } from './RepoAnalysisContext';
import { analysisContributors, mergeContributors, } from '@repo-explorer/lib/repo-analysis/contributionLayers';
import { useCommitsChangedFiles } from '@repo-explorer/hooks/useCommitsChangedFiles';
import { usePullRequestFiles } from '@repo-explorer/hooks/usePullRequestFiles';
import { useCommitView } from '@repo-explorer/hooks/useCommitView';
import { useIssueView } from '@repo-explorer/hooks/useIssueView';
import { usePullRequestView } from '@repo-explorer/hooks/usePullRequestView';
import { useReadme } from '@repo-explorer/hooks/useReadme';
import { useWeekCommits } from '@repo-explorer/hooks/useWeekCommits';
import { buildAggregateChurnLayers, buildCommitFilesLayer, } from '@repo-explorer/lib/activity/commitLayers';
const FileCityGuidePanel = dynamic(() => import('@industry-theme/file-city-panel').then((m) => m.FileCityGuidePanel), { ssr: false });
// FileCity3D loaded directly so we can warm WebGL / shader caches with a
// minimal sample scene during the loading screen, mirroring the trail
// page. See docs/nextjs-3d-rendering-issue.md.
const FileCity3D = dynamic(() => import('@principal-ai/file-city-react').then((m) => m.FileCity3D), { ssr: false });
if (typeof window !== 'undefined') {
    void FileCity3D.preload?.();
}
// Sample CityData used to warm FC3D's WebGL / shader caches during the
// loading screen — same fixture the trail page uses.
const WARMING_CITY_DATA = {
    buildings: [
        { path: 'src/index.ts', position: { x: 5, y: 0, z: 5 }, dimensions: [8, 12, 8], type: 'file', fileExtension: 'ts', size: 4096, lineCount: 240 },
        { path: 'src/app.tsx', position: { x: 18, y: 0, z: 5 }, dimensions: [8, 18, 8], type: 'file', fileExtension: 'tsx', size: 8192, lineCount: 480 },
        { path: 'src/api/client.js', position: { x: 31, y: 0, z: 5 }, dimensions: [6, 9, 6], type: 'file', fileExtension: 'js', size: 3000, lineCount: 180 },
        { path: 'src/components/Button.tsx', position: { x: 5, y: 0, z: 22 }, dimensions: [6, 6, 6], type: 'file', fileExtension: 'tsx', size: 1024, lineCount: 80 },
        { path: 'src/components/Modal.tsx', position: { x: 14, y: 0, z: 22 }, dimensions: [6, 14, 6], type: 'file', fileExtension: 'tsx', size: 6000, lineCount: 320 },
        { path: 'src/utils/helpers.ts', position: { x: 23, y: 0, z: 22 }, dimensions: [6, 9, 6], type: 'file', fileExtension: 'ts', size: 2400, lineCount: 160 },
        { path: 'src/styles/main.css', position: { x: 31, y: 0, z: 22 }, dimensions: [6, 5, 6], type: 'file', fileExtension: 'css', size: 1500 },
        { path: 'package.json', position: { x: 5, y: 0, z: 38 }, dimensions: [5, 4, 5], type: 'file', fileExtension: 'json', size: 800 },
        { path: 'README.md', position: { x: 14, y: 0, z: 38 }, dimensions: [5, 5, 5], type: 'file', fileExtension: 'md', size: 1500 },
        { path: 'tsconfig.json', position: { x: 23, y: 0, z: 38 }, dimensions: [5, 4, 5], type: 'file', fileExtension: 'json', size: 600 },
    ],
    districts: [
        {
            path: 'src',
            worldBounds: { minX: 0, maxX: 38, minZ: 0, maxZ: 30 },
            fileCount: 7,
            type: 'directory',
            label: { text: 'src', bounds: { minX: 0, maxX: 38, minZ: 30, maxZ: 33 }, position: 'bottom' },
        },
    ],
    bounds: { minX: -2, maxX: 40, minZ: -2, maxZ: 42 },
    metadata: { totalFiles: 10, totalDirectories: 1, rootPath: '/warming', analyzedAt: new Date() },
};
// Building heights come from the repo analysis, which already returns per-file
// line counts (path → count). When an analysis exists, wrap it as the panel's
// lineCounts slice; otherwise null (flat city until the user runs the analysis).
// The analysis is the sole source — no fallback to the old /api/line-counts
// route; a failed run is handled separately.
/**
 * Strip leading slash / `GitHub/` / `owner/repo/` prefixes so building paths
 * and GitHub PR `filename`s compare equal. Mirrors FileSourcePanel.
 */
function normalizeRepoRelativePath(path, owner, repo) {
    let clean = path;
    if (clean.startsWith('/'))
        clean = clean.slice(1);
    if (clean.startsWith('GitHub/'))
        clean = clean.slice('GitHub/'.length);
    const repoPrefix = `${owner}/${repo}/`;
    if (clean.startsWith(repoPrefix))
        clean = clean.slice(repoPrefix.length);
    return clean;
}
function lineCountsSlice(analysis) {
    // Slim analysis GET omits per-file lineCounts (heights deferred). Only attach
    // the slice when a non-empty map is present so the city stays flat rather
    // than treating `{}` as "zero-height everything."
    const counts = analysis?.lineCounts;
    const hasCounts = counts != null && Object.keys(counts).length > 0;
    return {
        scope: 'repository',
        name: 'lineCounts',
        data: hasCounts
            ? { lineCounts: counts, status: 'available' }
            : null,
        loading: false,
        error: null,
        refresh: async () => { },
    };
}
export function RepoExplorerPage({ owner, repo }) {
    const { theme } = useTheme();
    const { user } = useAuth();
    // Minimum time the loading overlay stays up, so it reads as a deliberate
    // beat instead of a flash on fast loads. The real tree now mounts *behind*
    // the overlay as soon as its data lands (see the render gate below), so
    // this window no longer has to cover a full WebGL warm-up — the old 2000ms
    // floor existed to give the warming FileCity3D time, and guaranteed the
    // warming→real swap was visible. See docs/nextjs-3d-rendering-issue.md.
    const [minDelayElapsed, setMinDelayElapsed] = useState(false);
    useEffect(() => {
        const t = window.setTimeout(() => setMinDelayElapsed(true), 800);
        return () => window.clearTimeout(t);
    }, []);
    // Vibe-coding detector — paths containing isRecord, set by the header
    // button's search. Drives a highlight layer on the File City map.
    const [vibeCodingPaths, setVibeCodingPaths] = useState(null);
    const [vibeCodingData, setVibeCodingData] = useState({
        fileCount: null,
        occurrenceCount: null,
        files: [],
        terms: [],
        loading: false,
        error: null,
        scanActive: false,
        scanProgress: 0,
        scanWindowPaths: [],
        scanDirectory: null,
    });
    const router = useRouter();
    // Bookmarks passport side panel.
    const [bookmarksOpen, setBookmarksOpen] = useState(false);
    // The repo currently being viewed, as a BookmarkRepo. Only owner/repo are
    // known here, so synthesize the rest and enrich stars/description from the
    // persisted recent-repos entry when one exists.
    const currentBookmarkRepo = useMemo(() => {
        const fullName = `${owner}/${repo}`;
        const base = {
            full_name: fullName,
            name: repo,
            owner: {
                login: owner,
                avatar_url: `https://github.com/${owner}.png?size=64`,
            },
        };
        const match = readRecentRepos().find((r) => r.full_name.toLowerCase() === fullName.toLowerCase());
        return match ? { ...base, ...match } : base;
    }, [owner, repo]);
    const handleNavigateBookmark = useCallback((fullName) => {
        setBookmarksOpen(false);
        router.push(`/${fullName}`);
    }, [router]);
    // Folder include/exclude config — directory paths the user has gated
    // out of the coverage / debt calculation. Persisted to localStorage
    // Folders excluded from the city + coverage stats. Hard-coded defaults for
    // now — `.repos/` and `repos/` are external package reference dirs that
    // would otherwise show up as noise in the File City guide panel. In-memory
    // only; the folder-kebab toggle can still add/remove entries for the
    // current session.
    const [excludedDirs, setExcludedDirs] = useState(() => {
        return ['.repos/', 'repos/'];
    });
    // When true, the left rail swaps the trail list for a directory tree
    // the user can use to gate folders in / out of the coverage calc.
    const [configMode, setConfigMode] = useState(false);
    // The "Trails" header doubles as a switch between the trail list and a
    // file tree of every file the trails touch (mirrors the desktop app's
    // Files tab). `selectedFilePath` lights up the picked file on the map.
    const [leftViewMode, setLeftViewMode] = useState(
    // Lead with tours so a guided tour — or, failing that, the "author a tour"
    // empty state — is the first thing a visitor lands on.
    'tours');
    // Commit picked from the Activity list — when set, the right pane shows the
    // commit as a synthesized changelog trail in the File City panel. Mutually
    // exclusive with trail/tour/file selection.
    const [selectedCommitSha, setSelectedCommitSha] = useState(null);
    // Issue picked from the Issues list — when set, the right pane shows it in the
    // File City panel's native issue mode. Mutually exclusive with
    // commit/tour/readme/file selection.
    const [selectedIssueNumber, setSelectedIssueNumber] = useState(null);
    // PR picked from the Pull requests list — when set, the right pane shows it in
    // the File City panel's native PR mode. Mutually exclusive with
    // commit/issue/tour/readme/file selection.
    const [selectedPrNumber, setSelectedPrNumber] = useState(null);
    // Commit row currently hovered in the Activity list — paints that commit's
    // files on the idle city in a distinct color over the aggregate heatmap.
    const [hoveredCommitSha, setHoveredCommitSha] = useState(null);
    // SHAs of the commits currently loaded in the Activity list, reported up from
    // RepoActivityPane so we can build the aggregate churn heatmap.
    const [activityShas, setActivityShas] = useState([]);
    // SHAs to focus the churn heatmap on — the selected contributor's commits, or
    // null when browsing the contributor list (then we paint everyone's churn).
    const [activityFocusShas, setActivityFocusShas] = useState(null);
    // SHAs of the contributor currently hovered in the Activity list (or null) —
    // previews their footprint on the city in a distinct color.
    const [activityHoverShas, setActivityHoverShas] = useState(null);
    const [selectedFilePath, setSelectedFilePath] = useState(null);
    // Which edge the file source drawer docks to. Files open on the right. (The
    // README no longer uses this drawer — it opens in the File City panel's
    // native readme mode; see `activeReadmePath`.)
    const [fileSide, setFileSide] = useState('right');
    // Tour selection. Mutually exclusive with trail/file selection — the right
    // pane swaps to the tour panel while a tour is active.
    const [selectedTourId, setSelectedTourId] = useState(null);
    // Guide mode — single enum driving the right pane between the file city
    // (idle), this-week commits, and readme views. Mutually exclusive by
    // construction: switching modes immediately nulls the other mode's data.
    const [guideMode, setGuideMode] = useState('city');
    // README path shown in the panel's native readme mode. Separate from
    // guideMode because package selection can pair a package README with the
    // focused city (not a guide-mode switch). Gated on guideMode below.
    const [activeReadmePath, setActiveReadmePath] = useState(null);
    // Small-screen flag (matches the 768px breakpoint used elsewhere). On mobile
    // the legend and README don't auto-open — they'd crowd the city — so we seed
    // the panel's `defaultLegendOpen` and skip the README auto-open below.
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    // Measured page-header height, so the right-docked file panel can start just
    // below the header instead of overlapping it at the top of the screen. A
    // callback ref (not a ref + mount effect) is required: this component returns
    // a loading screen first, so the header mounts *after* the initial commit —
    // the callback fires when the node actually attaches.
    const [headerHeight, setHeaderHeight] = useState(0);
    const headerObserver = useRef(null);
    const headerRef = useCallback((el) => {
        headerObserver.current?.disconnect();
        if (!el)
            return;
        const measure = () => setHeaderHeight(el.getBoundingClientRect().height);
        measure();
        headerObserver.current = new ResizeObserver(measure);
        headerObserver.current.observe(el);
    }, []);
    // Architecture-panel → file-city wiring. Hovering / selecting a package in
    // the left-rail composition panel lights up that package's directory subtree
    // on the idle Tour city. Repo-relative dir, normalized (no leading/trailing
    // slash); null for the monorepo root (we don't paint the whole repo).
    const [hoveredPackagePath, setHoveredPackagePath] = useState(null);
    const [selectedPackagePath, setSelectedPackagePath] = useState(null);
    // Package selected in the file city guide's package graph — drives the
    // StructurePane to show the package's README instead of the package list.
    const [graphSelectedPackage, setGraphSelectedPackage] = useState(null);
    const onPackageGraphSelect = useCallback((pkg) => {
        setGraphSelectedPackage(pkg);
    }, []);
    const packageDirFromLayer = useCallback((pkg) => {
        if (!pkg || pkg.packageData.isMonorepoRoot)
            return null;
        const dir = pkg.packageData.path.replace(/^\/+|\/+$/g, '');
        return dir.length > 0 ? dir : null;
    }, []);
    // Toggle the left rail between the commit-activity view and the default tours
    // view. Either direction clears the other surfaces' selections so a single
    // thing shows in the right pane. Driven from the About card (to enter) and the
    // activity pane's close button (to leave).
    const handleToggleActivity = useCallback(() => {
        setLeftViewMode((m) => (m === 'activity' ? 'tours' : 'activity'));
        setSelectedTourId(null);
        setSelectedFilePath(null);
        setSelectedCommitSha(null);
        setSelectedIssueNumber(null);
        setGuideMode('city');
        // Plain toggle lands on the contributor cards, not a stale drill-down.
        setActivityFocusContributor(null);
    }, []);
    // Clicking a contributor in the About card opens the Contributors view
    // straight into that person's profile. The counter bumps each click so
    // re-selecting the same contributor re-triggers the drill-in downstream.
    const contributorFocusCounter = useRef(0);
    const [activityFocusContributor, setActivityFocusContributor] = useState(null);
    const [contributorsFocus, setContributorsFocus] = useState(null);
    const handleSelectContributor = useCallback((c) => {
        contributorFocusCounter.current += 1;
        setContributorsFocus({
            token: contributorFocusCounter.current,
            login: c.login,
        });
        setLeftViewMode('contributors');
        setSelectedTourId(null);
        setSelectedFilePath(null);
        setSelectedCommitSha(null);
        setSelectedIssueNumber(null);
        setGuideMode('city');
    }, []);
    // Package composition ("Architecture" view). Reuses the warmed package cache,
    // so this adds no extra fetch. When packages exist, the left rail's "Trails"
    // collapsible becomes an Architecture / Trails switch.
    const { packages, loading: packagesLoading } = useRepoPackagesData(owner, repo);
    // Read file contents for the composition panel's manifest drill-down. Wired
    // to the existing readFile procedure — no new endpoint needed.
    const handleReadFile = useCallback((filePath) => trpc.github.readFile
        .query({ owner, repo, path: filePath })
        .then((r) => r.content), [owner, repo]);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);
    useEffect(() => {
        document.title = `${owner}/${repo}`;
    }, [owner, repo]);
    // Warm the About-card metadata the moment the page mounts — behind the
    // loading screen — so RepoOverview has it ready the instant it renders,
    // instead of the two GitHub calls only starting once the card appears.
    useEffect(() => {
        void warmRepoOverview(owner, repo);
    }, [owner, repo]);
    // Tours available for this repo. The endpoint globs the git tree for
    // `*.tour.json` and returns each fully-parsed tour, so — unlike trails —
    // there's no lazy by-id payload fetch; the list carries everything.
    const [tours, setTours] = useState([]);
    const [toursLoading, setToursLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        setTours([]);
        setToursLoading(true);
        setSelectedTourId(null);
        (async () => {
            try {
                const res = await fetch(`/api/tours/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
                if (!res.ok) {
                    if (!cancelled)
                        setTours([]);
                    return;
                }
                const data = (await res.json());
                if (cancelled)
                    return;
                const list = Array.isArray(data.tours) ? data.tours : [];
                setTours(list);
                // Always land on the idle Tour panel (colored city + file-type legend)
                // and let the visitor open a tour from the list — no auto-open, so the
                // default view is the map rather than a guided tour.
            }
            catch {
                // Tours are an optional enhancement — a fetch failure just means the
                // Tours tab shows an empty state, never blocks the trail explorer.
                if (!cancelled)
                    setTours([]);
            }
            finally {
                if (!cancelled)
                    setToursLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [owner, repo]);
    // Tour pending deletion (drives the confirm modal). Mirrors the trail delete
    // path: gated client-side to author/admin, re-checked server-side. Carries the
    // store id (the DELETE key) and the tour id (to clear an open selection).
    const [tourToDelete, setTourToDelete] = useState(null);
    const confirmDeleteTour = useCallback(async () => {
        if (!tourToDelete)
            return;
        const { storeId, tourId } = tourToDelete;
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await fetch(`/api/tours/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(storeId)}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setDeleteError(body?.error ?? `Failed to delete tour (${res.status}).`);
                return;
            }
            setTours((prev) => prev.filter((t) => t.store?.id !== storeId));
            setSelectedTourId((cur) => (cur === tourId ? null : cur));
            setTourToDelete(null);
        }
        catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'Failed to delete tour.');
        }
        finally {
            setDeleting(false);
        }
    }, [tourToDelete, owner, repo]);
    // Repo file tree — required by the panel. One fetch per owner/repo;
    // cached for the lifetime of the page.
    const [fileTree, setFileTree] = useState(null);
    const [treeError, setTreeError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        setFileTree(null);
        setTreeError(null);
        (async () => {
            try {
                // Fetch the tree via a presigned S3 URL rather than inline through
                // tRPC: a monorepo's tree (elastic/kibana ~5.7MB slimmed) can exceed
                // the ~6MB SSR response cap and truncate. S3 has no such cap, so the
                // direct fetch below reliably delivers the whole tree.
                const { url, sha } = await trpc.github.getTreeUrl.query({
                    owner,
                    repo,
                });
                if (cancelled)
                    return;
                const res = await fetch(url);
                if (!res.ok)
                    throw new Error(`tree fetch failed (${res.status})`);
                const treeData = (await res.json());
                if (cancelled)
                    return;
                const files = treeData.tree
                    .filter((entry) => entry.type === 'blob')
                    .map((entry) => ({ path: entry.path, size: entry.size || 0 }));
                const tree = new GitFileTreeBuilder().build({
                    files,
                    rootPath: `/${owner}/${repo}`,
                    commitSha: treeData.sha ?? sha,
                    branch: 'main',
                });
                if (cancelled)
                    return;
                setFileTree(tree);
            }
            catch (err) {
                if (cancelled)
                    return;
                // Retained as a safety net: a truncated/garbled tree body makes
                // `res.json()` throw a raw "Unexpected end of JSON input" DOMException.
                // Don't surface that verbatim — show a clean, retryable message instead.
                console.error('[RepoTree] Failed to load repository tree:', err);
                const raw = err instanceof Error ? err.message : '';
                const isParseError = /JSON|Unexpected end of|Unexpected token/i.test(raw);
                setTreeError(isParseError || !raw
                    ? 'This repository is too large to load right now. Refresh to try again.'
                    : raw);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [owner, repo]);
    const selectedTour = selectedTourId
        ? (tours.find((t) => t.tour.id === selectedTourId) ?? null)
        : null;
    // Deliberate, rate-limited audio generation. Driven from the tours list so
    // the user sees per-step progress; selecting a tour never generates.
    const [tourGenProgress, setTourGenProgress] = useState(() => new Map());
    const setProgress = useCallback((tourId, value) => {
        setTourGenProgress((prev) => {
            const next = new Map(prev);
            if (value)
                next.set(tourId, value);
            else
                next.delete(tourId);
            return next;
        });
    }, []);
    const handleGenerateTourAudio = useCallback(async (item) => {
        const tourId = item.tour.id;
        const base = {
            owner: item.audio.owner,
            repo: item.audio.repo,
            path: item.audio.path,
            commitSha: item.audio.commitSha ?? undefined,
        };
        const stepGuess = Array.isArray(item.tour.steps)
            ? item.tour.steps.length
            : 0;
        setProgress(tourId, { phase: 'running', done: 0, total: stepGuess });
        // Claim the hourly slot + fetch the work list. A rejection here is
        // terminal (cooldown or fetch failure) — nothing to finalize.
        let begin;
        try {
            begin = await trpc.tts.beginTourGeneration.mutate(base);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : '';
            const cooldown = /TOO_MANY_REQUESTS/i.test(message) || /generated recently/i.test(message);
            setProgress(tourId, {
                phase: 'error',
                done: 0,
                total: 0,
                error: cooldown ? 'Recently generated — try again later' : 'Generation failed',
            });
            return;
        }
        let done = begin.cachedSteps;
        const total = begin.totalSteps;
        setProgress(tourId, { phase: 'running', done, total });
        let stepFailed = false;
        for (const stepId of begin.stepIds) {
            try {
                await trpc.tts.generateTourStep.mutate({ ...base, stepId });
                done += 1;
                setProgress(tourId, { phase: 'running', done, total });
            }
            catch {
                stepFailed = true;
                break;
            }
        }
        // Always finalize to persist whatever landed and refresh the badge.
        try {
            const status = await trpc.tts.finishTourGeneration.mutate(base);
            setTours((prev) => prev.map((t) => t.tour.id === tourId ? { ...t, audioStatus: status } : t));
        }
        catch {
            // Status refresh failed; the row keeps its prior badge.
        }
        if (stepFailed) {
            setProgress(tourId, {
                phase: 'error',
                done,
                total,
                error: 'Some steps failed — try again',
            });
        }
        else {
            setProgress(tourId, null);
        }
    }, [setProgress]);
    // Sorted, deduped list of every directory in the repo, with trailing
    // slashes so Pierre's tree treats them as folders. Combined with the
    // file paths below, this is what we feed Pierre — files show in the
    // tree for context but the kebab is only enabled on folders.
    const dirPaths = useMemo(() => {
        if (!fileTree)
            return [];
        const dirs = new Set();
        for (const f of fileTree.allFiles) {
            const segments = f.path.split('/');
            let current = '';
            // Each segment except the last (the filename) contributes a dir.
            for (let i = 0; i < segments.length - 1; i++) {
                const segment = segments[i];
                if (!segment)
                    continue;
                current = current ? `${current}/${segment}` : segment;
                dirs.add(`${current}/`);
            }
        }
        return Array.from(dirs).sort();
    }, [fileTree]);
    // All file paths in the repo — feeds Pierre alongside `dirPaths`.
    const filePaths = useMemo(() => (fileTree ? fileTree.allFiles.map((f) => f.path) : []), [fileTree]);
    // Derived from guideMode — keep the old names so downstream code compiles
    // without touching every prop/usage.
    const weekActive = guideMode === 'week';
    const readmeActive = guideMode === 'readme';
    const readmePath = useMemo(() => findReadmePath(filePaths), [filePaths]);
    // Effective excluded file set — every file that lives under any
    // user-excluded directory. Computed once and reused everywhere the
    // exclusion cascade matters (coverage stats, highlight layers).
    const excludedFilePaths = useMemo(() => {
        const out = new Set();
        if (excludedDirs.length === 0 || !fileTree)
            return out;
        // Normalize: every prefix ends with '/' so startsWith won't match
        // "src/foo" against an excluded dir named "src/f".
        const prefixes = excludedDirs.map((d) => d.endsWith('/') ? d : `${d}/`);
        for (const f of fileTree.allFiles) {
            if (prefixes.some((p) => f.path.startsWith(p)))
                out.add(f.path);
        }
        return out;
    }, [excludedDirs, fileTree]);
    // Rebuilt FileTree with excluded subtrees stripped — this is what the
    // panel sees, so excluded folders disappear from the panel's internal
    // tree views (drawer, navigation) on top of the `excludedFolders`
    // prop which strips them from `cityData`. Returns the original tree
    // when nothing is excluded so we don't re-build on every render.
    const filteredFileTree = useMemo(() => {
        if (!fileTree)
            return null;
        if (excludedFilePaths.size === 0)
            return fileTree;
        const sourceInfo = (fileTree.metadata.sourceInfo ?? {});
        const files = fileTree.allFiles
            .filter((f) => !excludedFilePaths.has(f.path))
            .map((f) => ({ path: f.path, size: f.size }));
        return new GitFileTreeBuilder().build({
            files,
            commitSha: sourceInfo.commitSha ?? fileTree.sha,
            branch: sourceInfo.branch ?? 'main',
            rootPath: sourceInfo.rootPath ?? `/${owner}/${repo}`,
        });
    }, [fileTree, excludedFilePaths, owner, repo]);
    // Layer item paths must match `building.path` verbatim. Buildings
    // are constructed from `FileTree.allFiles[i].path`, which is the raw
    // input path from the GitHub tree API (repo-relative — no rootPath
    // prefix). Marker `sourcePath` is also repo-relative, so we use it
    // as-is.
    // Vibe-coding detector highlight — files containing isRecord, set by the
    // header button's code search. Painted as a semi-transparent glow on top
    // of the base trail coverage so you can spot LLM-adjacent files at a glance.
    // During the scan sweep this is the accumulated set (dim). After results
    // arrive it's the matched files (amber severity color).
    const vibeCodingHighlightLayer = useMemo(() => {
        if (!vibeCodingPaths || vibeCodingPaths.length === 0)
            return null;
        const isScanning = vibeCodingData.scanActive;
        return {
            id: 'vibe-coding-isrecord',
            name: isScanning ? 'Scanned files' : 'isRecord files',
            enabled: true,
            color: isScanning ? (theme.colors.primary ?? '#3b82f6') : (theme.colors.warning ?? '#f59e0b'),
            opacity: isScanning ? 0.2 : 0.45,
            priority: 110,
            items: vibeCodingPaths.map((path) => ({
                path,
                type: 'file',
                renderStrategy: 'fill',
            })),
            dynamic: true,
        };
    }, [vibeCodingPaths, vibeCodingData.scanActive, theme.colors.primary, theme.colors.warning]);
    // The trailing edge of the scan — the current batch being inspected.
    // Drawn at higher priority (brighter) on top of the accumulated set so
    // the user can see exactly where the scan beam is right now.
    const vibeCodingScanWindowLayer = useMemo(() => {
        if (!vibeCodingData.scanActive || vibeCodingData.scanWindowPaths.length === 0)
            return null;
        return {
            id: 'vibe-coding-scan-window',
            name: 'Scanning...',
            enabled: true,
            color: theme.colors.warning ?? '#f59e0b',
            opacity: 0.5,
            priority: 111,
            items: vibeCodingData.scanWindowPaths.map((path) => ({
                path,
                type: 'file',
                renderStrategy: 'fill',
            })),
            dynamic: true,
        };
    }, [vibeCodingData.scanActive, vibeCodingData.scanWindowPaths, theme.colors.warning]);
    // Stack base + hover. Higher priority renders on top. In debt mode
    // we swap the base layer to the undocumented set and skip the hover
    // overlay (which only makes sense over the coverage layer).
    const idleHighlightLayers = useMemo(() => {
        const layers = [];
        if (vibeCodingHighlightLayer)
            layers.push(vibeCodingHighlightLayer);
        if (vibeCodingScanWindowLayer)
            layers.push(vibeCodingScanWindowLayer);
        return layers.length > 0 ? layers : null;
    }, [vibeCodingHighlightLayer, vibeCodingScanWindowLayer]);
    // Architecture-panel highlight layers, kept independent of the trail-derived
    // `idleHighlightLayers`. Only the hover *preview* paints now — a transient
    // border around the hovered package's directory subtree. Selection no longer
    // paints a fill: it drives the panel's `idleFocusDirectory` instead (see
    // below), which collapses the idle city onto the subtree with no color over
    // the buildings' normal file-type colors. A single `type: 'directory'` item
    // covers the whole subtree — the renderer honors directory items in the idle
    // path, so there's no need to enumerate `fileTree.allFiles`.
    const packageHighlightLayers = useMemo(() => {
        if (!hoveredPackagePath || hoveredPackagePath === selectedPackagePath) {
            return null;
        }
        return [
            {
                id: `pkg-hover-${hoveredPackagePath}`,
                name: 'Hovered package',
                enabled: true,
                color: theme.colors.primary,
                borderWidth: 2,
                priority: 100,
                items: [
                    {
                        path: hoveredPackagePath,
                        type: 'directory',
                        renderStrategy: 'border',
                    },
                ],
                dynamic: true,
            },
        ];
    }, [hoveredPackagePath, selectedPackagePath, theme.colors.primary]);
    // The highlight-layers slice is "loading" until we have enough data
    // to compute a final value. Without this the panel can't tell
    // "no host layers" from "layers haven't streamed in yet" and paints
    // a one-frame flash of the unfiltered city before hide-mode kicks in.
    const highlightLayersLoading = false;
    // --- Commit activity → File City ----------------------------------------
    // Changed-file lists for the commits loaded in the Activity list, used to
    // paint an aggregate churn heatmap on the idle city (only while browsing).
    const isActivityView = leftViewMode === 'activity';
    const commitFiles = useCommitsChangedFiles(owner, repo, activityShas, {
        enabled: isActivityView,
    });
    // Aggregate churn heatmap + a distinct-colored layer for the hovered commit.
    const activityHeatmapLayers = useMemo(() => {
        if (!isActivityView)
            return null;
        // Scope the churn to the focused contributor's commits when one is open,
        // otherwise paint the aggregate across every loaded commit.
        const churnSource = activityFocusShas
            ? new Map(activityFocusShas
                .filter((sha) => commitFiles.has(sha))
                .map((sha) => [sha, commitFiles.get(sha)]))
            : commitFiles;
        const layers = buildAggregateChurnLayers(churnSource, theme.colors.primary);
        if (hoveredCommitSha) {
            const hoverFiles = commitFiles.get(hoveredCommitSha);
            if (hoverFiles) {
                const hoverLayer = buildCommitFilesLayer(hoverFiles, {
                    id: 'commit-hover',
                    color: theme.colors.accent,
                    priority: 90,
                });
                if (hoverLayer)
                    layers.push(hoverLayer);
            }
        }
        // Hovering a contributor in the list previews their footprint: an accent
        // layer over the union of files their commits touched.
        if (activityHoverShas && activityHoverShas.length > 0) {
            const seen = new Set();
            const hoverFiles = activityHoverShas
                .flatMap((sha) => commitFiles.get(sha) ?? [])
                .filter((f) => seen.has(f.filename) ? false : (seen.add(f.filename), true));
            const hoverLayer = buildCommitFilesLayer(hoverFiles, {
                id: 'contributor-hover',
                color: theme.colors.accent,
                priority: 90,
            });
            if (hoverLayer)
                layers.push(hoverLayer);
        }
        return layers.length > 0 ? layers : null;
    }, [isActivityView, commitFiles, activityFocusShas, hoveredCommitSha, activityHoverShas, theme.colors.primary, theme.colors.accent]);
    // Selected commit rendered natively by FileCityGuidePanel's commit mode
    // (header + message + changed-file list + city highlights). Only while the
    // Activity view is active.
    const { commit: selectedCommitView, loading: commitViewLoading } = useCommitView(owner, repo, isActivityView ? selectedCommitSha : null);
    // Selected issue rendered natively by FileCityGuidePanel's issue mode (header
    // + body + reporter card). Only while the Issues view is active.
    const isIssuesView = leftViewMode === 'issues';
    const { issue: selectedIssueView, loading: issueViewLoading } = useIssueView(owner, repo, isIssuesView ? selectedIssueNumber : null);
    // PR heatmap: aggregate churn across all visible PRs, plus a hover layer for
    // the PR the user is mousing over in the list.
    const isPullRequestsView = leftViewMode === 'pull-requests';
    const [visiblePrNumbers, setVisiblePrNumbers] = useState([]);
    const [hoveredPrNumber, setHoveredPrNumber] = useState(null);
    const [selectedFilePrFilter, setSelectedFilePrFilter] = useState(null);
    const prFiles = usePullRequestFiles(owner, repo, visiblePrNumbers, {
        enabled: isPullRequestsView,
    });
    // Host heatmaps only paint on the idle guide city. A selected PR/commit/
    // issue/tour/readme takes over the stage (panel ignores host layers), so
    // skip building them — cheaper, and avoids fighting takeover modes.
    const hostHeatmapEligible = isPullRequestsView &&
        selectedPrNumber == null &&
        selectedCommitSha == null &&
        selectedIssueNumber == null &&
        selectedTourId == null &&
        !activeReadmePath &&
        guideMode === 'city';
    const prHeatmapLayers = useMemo(() => {
        if (!hostHeatmapEligible || prFiles.size === 0)
            return null;
        const aggregate = new Map([...prFiles.entries()].map(([n, files]) => [String(n), files]));
        const layers = buildAggregateChurnLayers(aggregate, theme.colors.primary);
        // Accent layer for the hovered PR's files.
        if (hoveredPrNumber != null) {
            const hoverFiles = prFiles.get(hoveredPrNumber);
            if (hoverFiles) {
                const hoverLayer = buildCommitFilesLayer(hoverFiles, {
                    id: 'pr-hover',
                    color: theme.colors.accent,
                    priority: 90,
                });
                if (hoverLayer)
                    layers.push(hoverLayer);
            }
        }
        return layers.length > 0 ? layers : null;
    }, [
        hostHeatmapEligible,
        prFiles,
        hoveredPrNumber,
        theme.colors.primary,
        theme.colors.accent,
    ]);
    // Stable handler — RightPane re-subscribes to `file:open` whenever this
    // identity changes. An inline arrow (recreated every parent render) was
    // tearing down the listener on every PR hover / file-list update, which
    // can drop map clicks that fire in the same turn as a context refresh.
    const handleMapOpenFile = useCallback((rawPath) => {
        const path = normalizeRepoRelativePath(rawPath, owner, repo);
        if (!path)
            return;
        setSelectedFilePath(path);
        setFileSide('right');
        // In PR view, toggle file filter on click (same path the list matches).
        if (isPullRequestsView) {
            setSelectedFilePrFilter((prev) => {
                const prevNorm = prev
                    ? normalizeRepoRelativePath(prev, owner, repo)
                    : null;
                return prevNorm === path ? null : path;
            });
        }
    }, [owner, repo, isPullRequestsView]);
    // File-driven PR filter: when a user clicks a building in the city while in
    // PR view, narrow the PR list to only those touching the selected file.
    // Normalize both sides — building.path and GitHub `filename` should already
    // be repo-relative, but prefixes/slashes still show up from some trees.
    const filteredPrNumbers = useMemo(() => {
        if (!selectedFilePrFilter || prFiles.size === 0)
            return null;
        const want = normalizeRepoRelativePath(selectedFilePrFilter, owner, repo);
        return visiblePrNumbers.filter((pr) => prFiles.get(pr)?.some((f) => normalizeRepoRelativePath(f.filename, owner, repo) === want));
    }, [selectedFilePrFilter, prFiles, visiblePrNumbers, owner, repo]);
    // Selected PR rendered natively by FileCityGuidePanel's PR mode (header +
    // description + Files/Details tabs, changed buildings lit). Only while the
    // Pull requests view is active.
    const { pullRequest: selectedPrView, loading: prViewLoading } = usePullRequestView(owner, repo, isPullRequestsView ? selectedPrNumber : null);
    // README rendered natively by FileCityGuidePanel's readme mode (markdown left
    // + city + file-type legend). Driven by `activeReadmePath`; idle when null.
    const { readme: selectedReadmeView, loading: readmeViewLoading } = useReadme(owner, repo, weekActive ? null : activeReadmePath, 
    // Pin the README read to the same commit the file tree resolved, so it's a
    // coherent snapshot and hits the immutable SHA-keyed cache.
    fileTree?.sha ?? null);
    // Week-commits mode — loads this calendar week so far (with header progress).
    const { week: rawWeekCommitsView, loading: weekCommitsLoading } = useWeekCommits(owner, repo, weekActive, fileTree);
    // Null out immediately when week is off — the hook clears async (after paint)
    // so the panel can briefly see stale week data and show the week view for a
    // frame when switching to City / README.
    const weekCommitsView = weekActive ? rawWeekCommitsView : null;
    // Open the readme by default on first visit, unless the user previously
    // closed it (persisted per-repo). Runs once, after the file list (hence the
    // README path) is known, and only when no other surface is already selected
    // so a deep-linked tour/commit/trail still wins.
    const didAutoOpenReadme = useRef(false);
    useEffect(() => {
        if (didAutoOpenReadme.current)
            return;
        if (!readmePath)
            return; // wait for the file list to load
        didAutoOpenReadme.current = true;
        const readmePref = readReadmeOpenPref(owner, repo);
        if (readmePref === false)
            return; // user dismissed it
        // On mobile the README shouldn't open by default (it would take the whole
        // screen), but still honor an explicit prior "open" preference.
        if (isMobile && readmePref !== true)
            return;
        if (selectedTourId ||
            selectedCommitSha ||
            selectedFilePath ||
            weekActive) {
            return; // something else is already showing
        }
        setActiveReadmePath(readmePath);
        setGuideMode('readme');
    }, [
        readmePath,
        owner,
        repo,
        isMobile,
        selectedTourId,
        selectedCommitSha,
        selectedFilePath,
        weekActive,
    ]);
    // Debug: log layers + a few real file-tree paths so we can confirm
    // the LayerItem path format matches the building paths.
    useEffect(() => {
        if (!idleHighlightLayers) {
            console.log('[RepoTrailExplorer] idleHighlightLayers: null');
            return;
        }
        const samplePaths = (fileTree?.allFiles ?? []).slice(0, 5).map((f) => f.path);
        console.log('[RepoTrailExplorer] idleHighlightLayers:', {
            sampleBuildingPaths: samplePaths,
            layers: idleHighlightLayers.map((l) => ({
                id: l.id,
                name: l.name,
                color: l.color,
                opacity: l.opacity,
                priority: l.priority,
                itemCount: l.items.length,
                sampleItems: l.items.slice(0, 5),
            })),
        });
    }, [idleHighlightLayers, fileTree]);
    // Everything the real tree needs before it can mount: the trail index plus
    // the file tree (or its error — RightPane renders tree errors inline).
    const dataReady = fileTree !== null || treeError !== null;
    // Once the real tree is mounted (behind the loading overlay), give its
    // FileCity3D a short beat to init WebGL and flip cameraReady before the
    // overlay lifts. Timer-driven for now — swap for an onCityReady signal
    // plumbed up through FileCityGuidePanel once the panel packages expose one.
    const [warmGraceElapsed, setWarmGraceElapsed] = useState(false);
    useEffect(() => {
        if (!dataReady)
            return;
        const t = window.setTimeout(() => setWarmGraceElapsed(true), 500);
        return () => window.clearTimeout(t);
    }, [dataReady]);
    const showLoadingOverlay = !minDelayElapsed || !warmGraceElapsed;
    // While the data the real tree needs is still loading, warm FileCity3D's
    // WebGL pipeline behind the loading screen with sample data. The moment the
    // data lands we mount the *real* tree behind the same overlay instead (see
    // the main return) — the real panel finishes its own warm-up out of sight,
    // so the warming instance is never visibly swapped for a cold one. That
    // swap (every fresh Canvas mounts at opacity 0 until cameraReady, then
    // fades in) is what used to read as the page loading twice. Errors on the
    // tree fetch take a separate path (inline in RightPane) so we don't strand
    // the user on a never-resolving overlay.
    if (!dataReady) {
        return (_jsxs(_Fragment, { children: [_jsx("div", { style: { position: 'fixed', inset: 0, zIndex: 0 }, children: _jsx(FileCity3D, { cityData: WARMING_CITY_DATA, width: "100%", height: "100%", showControls: false }) }), _jsx("div", { style: { position: 'fixed', inset: 0, zIndex: 50 }, children: _jsx(BlockDropLoadingScreen, { message: `Loading ${repo}` }) })] }));
    }
    const singleTour = tours.length === 1 ? (tours[0] ?? null) : null;
    const singleTourActive = singleTour != null && singleTour.tour.id === selectedTourId;
    const isCityMode = !weekActive && activeReadmePath == null;
    return (_jsxs(RepoAnalysisProvider, { owner: owner, repo: repo, children: [_jsxs("div", { className: "w-screen flex flex-col overflow-hidden", style: { background: theme.colors.background, height: '100vh' }, children: [_jsx(Header, { rootRef: headerRef, owner: owner, repo: repo, selectedTour: selectedTour, tourProgress: selectedTour ? tourGenProgress.get(selectedTour.tour.id) : undefined, onGenerateTourAudio: handleGenerateTourAudio, onToggleBookmarks: () => setBookmarksOpen((v) => !v), bookmarksOpen: bookmarksOpen, repoActive: leftViewMode !== 'tours', onShowOverview: () => setLeftViewMode('tours'), singleTour: singleTour, singleTourActive: singleTourActive, onToggleSingleTour: () => {
                            const nextId = singleTourActive ? null : singleTour.tour.id;
                            setSelectedTourId(nextId);
                            if (nextId) {
                                setSelectedFilePath(null);
                                setGuideMode('city');
                            }
                        }, isCityMode: isCityMode }), _jsxs("div", { className: "flex-1 min-h-0 flex flex-col-reverse md:flex-row", children: [_jsx(TrailListPane, { owner: owner, repo: repo, viewerUserId: user?.id ?? null, viewerIsRepoAdmin: false, packages: packages, packagesLoading: packagesLoading, onReadFile: handleReadFile, onPackageHover: (pkg) => setHoveredPackagePath(packageDirFromLayer(pkg)), onPackageSelect: (pkg) => {
                                    const dir = packageDirFromLayer(pkg);
                                    setSelectedPackagePath(dir);
                                    // Pair the package focus with its own README: when the selected
                                    // package has one, show it beside the city — `idleFocusDirectory`
                                    // (below) collapses the city onto the same subtree, so the reader
                                    // gets "focus the package + read its README" in one gesture. No
                                    // package README → clear, leaving just the focused city.
                                    setActiveReadmePath(dir ? findReadmePath(filePaths, dir) : null);
                                }, configMode: configMode, onToggleConfigMode: () => {
                                    setConfigMode((m) => !m);
                                }, leftViewMode: leftViewMode, onSetViewMode: (mode) => {
                                    setLeftViewMode(mode);
                                    // Picking any other view dismisses the readme and week mode (it's
                                    // the tours-view default overlay). Doesn't touch the persisted
                                    // preference, so the README button can reopen it. Must clear
                                    // `activeReadmePath` too — guideMode alone doesn't gate the
                                    // readme slice, so leaving the path set keeps readme mode mounted
                                    // and blocks host heatmaps (PR aggregate / activity churn).
                                    setGuideMode('city');
                                    setActiveReadmePath(null);
                                    // Clear the file city guide graph selection when leaving structure.
                                    if (mode !== 'structure')
                                        setGraphSelectedPackage(null);
                                    // Switching views clears the other views' selections so the map
                                    // returns to the idle coverage layer between them. Leaving the
                                    // activity view also clears any open commit.
                                    if (mode !== 'activity')
                                        setSelectedCommitSha(null);
                                    if (mode !== 'issues')
                                        setSelectedIssueNumber(null);
                                    if (mode !== 'pull-requests') {
                                        setSelectedPrNumber(null);
                                        setSelectedFilePrFilter(null);
                                    }
                                    // The package focus (idleFocusDirectory) only belongs to the
                                    // Structure view; leaving it must release the city back to idle so
                                    // About doesn't stay zoomed on the last-clicked package.
                                    if (mode !== 'structure') {
                                        setSelectedPackagePath(null);
                                        setHoveredPackagePath(null);
                                    }
                                    if (mode === 'tours') {
                                        setSelectedFilePath(null);
                                    }
                                    else if (mode === 'activity') {
                                        setSelectedTourId(null);
                                        setSelectedFilePath(null);
                                        // Opening Activity from a nav card lands on the contributor
                                        // list, not a stale drill-down.
                                        setActivityFocusContributor(null);
                                    }
                                    else if (mode === 'issues') {
                                        setSelectedTourId(null);
                                        setSelectedFilePath(null);
                                    }
                                    else if (mode === 'pull-requests') {
                                        setSelectedTourId(null);
                                        setSelectedFilePath(null);
                                    }
                                    else {
                                        // Structure / Contributors: a clean idle right pane.
                                        setSelectedFilePath(null);
                                        setSelectedTourId(null);
                                        // Opening Contributors from a nav card lands on the list, not a
                                        // stale contributor drill-down.
                                        setContributorsFocus(null);
                                    }
                                }, onToggleActivity: handleToggleActivity, onSelectContributor: handleSelectContributor, activityFocusContributor: activityFocusContributor, contributorsFocus: contributorsFocus, selectedCommitSha: selectedCommitSha, onSelectCommit: (sha) => {
                                    setSelectedCommitSha(sha);
                                    if (sha) {
                                        setGuideMode('city');
                                    }
                                }, selectedIssueNumber: selectedIssueNumber, onSelectIssue: (issueNumber) => {
                                    setSelectedIssueNumber(issueNumber);
                                    if (issueNumber != null) {
                                        setGuideMode('city');
                                    }
                                }, selectedPrNumber: selectedPrNumber, onSelectPr: (prNumber) => {
                                    setSelectedPrNumber(prNumber);
                                    if (prNumber != null) {
                                        setGuideMode('city');
                                    }
                                }, commitFiles: commitFiles, onCommitShasChange: setActivityShas, onFocusShasChange: setActivityFocusShas, onHoverCommit: setHoveredCommitSha, onActivityHoverShasChange: setActivityHoverShas, 
                                // Guide mode switch: City | README | This week. Opening a mode
                                // collapses trails and clears competing selections so one thing
                                // drives the right pane. README pref is still persisted per-repo.
                                onOpenReadmeFile: (path) => {
                                    setGuideMode('readme');
                                    setActiveReadmePath(path);
                                    writeReadmeOpenPref(owner, repo, true);
                                    setSelectedFilePath(null);
                                    setSelectedTourId(null);
                                    setSelectedCommitSha(null);
                                    setSelectedIssueNumber(null);
                                    setSelectedPrNumber(null);
                                }, onSetWeekActive: (next) => {
                                    setGuideMode(next ? 'week' : 'city');
                                    if (next) {
                                        setActiveReadmePath(null);
                                        writeReadmeOpenPref(owner, repo, false);
                                        setSelectedFilePath(null);
                                        setSelectedTourId(null);
                                        setSelectedCommitSha(null);
                                        setSelectedIssueNumber(null);
                                        setSelectedPrNumber(null);
                                    }
                                }, onSetCityMode: () => {
                                    setGuideMode('city');
                                    setActiveReadmePath(null);
                                    writeReadmeOpenPref(owner, repo, false);
                                }, readmeActive: readmeActive, weekActive: weekActive, tours: tours, toursLoading: toursLoading, selectedTourId: selectedTourId, onSelectTour: (id) => {
                                    setSelectedTourId(id);
                                    if (id) {
                                        setSelectedFilePath(null);
                                        setGuideMode('city');
                                    }
                                }, onRequestDeleteTour: (item) => {
                                    if (!item.store)
                                        return;
                                    setTourToDelete({
                                        storeId: item.store.id,
                                        tourId: item.tour.id,
                                        title: item.tour.title,
                                    });
                                }, dirPaths: dirPaths, filePaths: filePaths, excludedDirs: excludedDirs, onExcludedDirsChange: setExcludedDirs, isMobile: isMobile, vibeCodingData: vibeCodingData, onVibeCodingClear: () => {
                                    setVibeCodingPaths(null);
                                    setVibeCodingData({
                                        fileCount: null, occurrenceCount: null, files: [], terms: [],
                                        loading: false, error: null, scanActive: false, scanProgress: 0, scanWindowPaths: [], scanDirectory: null,
                                    });
                                    setLeftViewMode('tours');
                                }, onVibeCodingClose: () => setLeftViewMode('tours'), onVisiblePrsChange: setVisiblePrNumbers, onHoverPr: setHoveredPrNumber, filteredPrNumbers: filteredPrNumbers, onClearFileFilter: () => setSelectedFilePrFilter(null), graphSelectedPackage: graphSelectedPackage, onClearGraphSelection: () => setGraphSelectedPackage(null) }), _jsx(RightPane, { owner: owner, repo: repo, fileTree: configMode ? fileTree : filteredFileTree, filteredFileTree: filteredFileTree, treeError: treeError, selectedTour: selectedTour, idleHighlightLayers: idleHighlightLayers, packageHighlightLayers: packageHighlightLayers, idleFocusDirectory: selectedPackagePath, highlightLayersLoading: highlightLayersLoading, excludedFolders: excludedDirs.map((d) => d.endsWith('/') ? d.slice(0, -1) : d), showSpatialContext: configMode, showColorLegend: true, showColorLegendToggle: true, 
                                // Mobile starts with the legend collapsed (reopenable via the toggle).
                                defaultLegendOpen: !isMobile, onCloseCommit: () => setSelectedCommitSha(null), onCloseIssue: () => setSelectedIssueNumber(null), onClosePullRequest: () => setSelectedPrNumber(null), onCloseWeekCommits: () => setGuideMode('city'), activityHeatmapLayers: activityHeatmapLayers, prHeatmapLayers: prHeatmapLayers, commitView: selectedCommitView, commitViewLoading: commitViewLoading, issueView: selectedIssueView, issueViewLoading: issueViewLoading, pullRequestView: selectedPrView, pullRequestViewLoading: prViewLoading, readmeView: selectedReadmeView, readmeViewLoading: readmeViewLoading, weekCommitsView: weekCommitsView, weekCommitsLoading: weekCommitsLoading, currentAuthor: user?.login, onOpenFile: handleMapOpenFile, vibeCodingHighlightLayer: vibeCodingHighlightLayer, vibeCodingScanWindowLayer: vibeCodingScanWindowLayer, guideMode: guideMode, activeReadmePath: activeReadmePath, packages: packages, packagesLoading: packagesLoading, leftViewMode: leftViewMode, onSetViewMode: setLeftViewMode, onPackageGraphSelect: onPackageGraphSelect })] }), _jsx(FileSourcePanel, { owner: owner, repo: repo, filePath: selectedFilePath, gitRef: undefined, topOffset: headerHeight, side: fileSide, onClose: () => setSelectedFilePath(null) }, fileSide), _jsx(BookmarksDrawer, { open: bookmarksOpen, onClose: () => setBookmarksOpen(false), currentRepo: currentBookmarkRepo, onNavigate: handleNavigateBookmark }), tourToDelete && (_jsx(ConfirmDialog, { title: "Delete tour", message: _jsxs(_Fragment, { children: ["Delete", ' ', _jsxs("strong", { style: { color: 'inherit' }, children: ["\u201C", tourToDelete.title, "\u201D"] }), "? This permanently removes the published tour for everyone. This cannot be undone.", deleteError && (_jsx("span", { className: "block mt-3", style: { color: '#dc2626' }, children: deleteError }))] }), confirmLabel: "Delete tour", destructive: true, busy: deleting, onConfirm: confirmDeleteTour, onCancel: () => {
                            if (deleting)
                                return;
                            setTourToDelete(null);
                            setDeleteError(null);
                        } }))] }), showLoadingOverlay && (_jsx("div", { style: { position: 'fixed', inset: 0, zIndex: 50 }, children: _jsx(BlockDropLoadingScreen, { message: `Loading ${repo}` }) }))] }));
}
// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
const Header = ({ rootRef, owner, repo, selectedTour, tourProgress, onGenerateTourAudio, onToggleBookmarks, bookmarksOpen, repoActive, onShowOverview, singleTour, singleTourActive, onToggleSingleTour, isCityMode, }) => {
    const { theme } = useTheme();
    return (_jsxs("header", { ref: rootRef, className: "border-b px-5 flex items-center gap-2 flex-shrink-0 relative", style: {
            background: theme.colors.surface,
            borderColor: theme.colors.border,
            paddingTop: 'calc(var(--safe-top) + 0.875rem)',
            paddingBottom: '0.875rem',
        }, children: [_jsx("style", { children: `
        @keyframes rpCrumbIn {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
      ` }), _jsxs("div", { className: "hidden md:flex items-center gap-2 min-w-0 flex-1", children: [_jsx(Link, { href: `/${owner}`, className: "flex-shrink-0 transition-opacity hover:opacity-80", title: owner, "aria-label": owner, style: { textDecoration: 'none' }, children: _jsx("img", { src: `https://github.com/${owner}.png?size=64`, alt: "", width: 28, height: 28, className: "rounded-full", style: { border: `1px solid ${theme.colors.border}` } }) }), _jsx(Link, { href: `/${owner}`, className: "transition-opacity hover:opacity-80 truncate", style: {
                            fontFamily: theme.fonts.body,
                            fontSize: theme.fontSizes[2],
                            fontWeight: theme.fontWeights.semibold,
                            color: theme.colors.text,
                            textDecoration: 'none',
                        }, children: owner }), repoActive && (_jsxs("span", { className: "flex items-center min-w-0", style: { animation: 'rpCrumbIn 240ms ease-out both' }, children: [_jsx("span", { className: "-ml-0.5 mr-1 flex-shrink-0", style: { color: theme.colors.textMuted }, "aria-hidden": "true", children: "/" }), _jsx("button", { type: "button", onClick: onShowOverview, className: "transition-opacity hover:opacity-80 truncate", title: `${repo} overview`, style: {
                                    fontFamily: theme.fonts.body,
                                    fontSize: theme.fontSizes[2],
                                    fontWeight: theme.fontWeights.semibold,
                                    color: theme.colors.primary,
                                    cursor: 'pointer',
                                }, children: repo })] }))] }), _jsxs("div", { className: "flex md:hidden items-center gap-2 min-w-0 flex-1", children: [_jsxs(Link, { href: `/${owner}`, className: "flex items-center gap-2 min-w-0 transition-opacity hover:opacity-80", style: { textDecoration: 'none' }, children: [_jsx("img", { src: `https://github.com/${owner}.png?size=64`, alt: "", width: 32, height: 32, className: "rounded-full flex-shrink-0", style: { border: `1px solid ${theme.colors.border}` } }), !repoActive && (_jsx("span", { className: "truncate", style: {
                                    fontFamily: theme.fonts.body,
                                    fontSize: theme.fontSizes[2],
                                    fontWeight: theme.fontWeights.semibold,
                                    color: theme.colors.text,
                                }, children: owner }))] }), repoActive && (_jsxs("span", { className: "flex items-center min-w-0", style: { animation: 'rpCrumbIn 240ms ease-out both' }, children: [_jsx("span", { className: "-ml-0.5 mr-1 flex-shrink-0", style: { color: theme.colors.textMuted }, "aria-hidden": "true", children: "/" }), _jsx("button", { type: "button", onClick: onShowOverview, className: "truncate transition-opacity hover:opacity-80", title: `${repo} overview`, style: {
                                    fontFamily: theme.fonts.body,
                                    fontSize: theme.fontSizes[2],
                                    fontWeight: theme.fontWeights.semibold,
                                    color: theme.colors.primary,
                                    cursor: 'pointer',
                                }, children: repo })] }))] }), singleTour && isCityMode && (_jsx("div", { className: "hidden md:flex absolute left-1/2 -translate-x-1/2", children: _jsx("button", { type: "button", onClick: onToggleSingleTour, className: "inline-flex items-center gap-2 rounded-md transition-opacity hover:opacity-90", style: {
                        padding: '6px 12px',
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        fontWeight: theme.fontWeights.semibold,
                        cursor: 'pointer',
                        ...(singleTourActive
                            ? {
                                background: 'transparent',
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                            }
                            : {
                                background: theme.colors.primary,
                                color: '#ffffff',
                                border: `1px solid ${theme.colors.primary}`,
                            }),
                    }, children: singleTourActive ? (_jsxs(_Fragment, { children: [_jsx(X, { size: 14 }), "Stop tour"] })) : (_jsxs(_Fragment, { children: [_jsx(Play, { size: 14 }), "Start tour"] })) }) })), _jsx("div", { className: "flex items-center gap-2 flex-shrink-0", children: selectedTour && (_jsx(TourAudioControl, { status: selectedTour.audioStatus, progress: tourProgress, onGenerate: () => onGenerateTourAudio(selectedTour) })) })] }));
};
// ---------------------------------------------------------------------------
// Sliding pane switcher
// ---------------------------------------------------------------------------
// Left-to-right ordering of the rail's surfaces. A transition to a later
// surface slides the new pane in from the right (and the old one out to the
// left); going back reverses it — the carousel feel for the About nav cards.
const SLIDE_ORDER = [
    'config',
    'tours',
    'activity',
    'issues',
    'pull-requests',
    'contributors',
    'structure',
    'files',
];
function slideDirection(from, to) {
    const a = SLIDE_ORDER.indexOf(from);
    const b = SLIDE_ORDER.indexOf(to);
    return b >= a ? 1 : -1;
}
// ---------------------------------------------------------------------------
// Trail list pane (left)
// ---------------------------------------------------------------------------
const TrailListPane = ({ owner, repo, viewerUserId, viewerIsRepoAdmin, packages, packagesLoading, onReadFile, onPackageHover, onPackageSelect, configMode, onToggleConfigMode, leftViewMode, onSetViewMode, onToggleActivity, onSelectContributor, activityFocusContributor, contributorsFocus, selectedCommitSha, onSelectCommit, selectedIssueNumber, onSelectIssue, selectedPrNumber, onSelectPr, commitFiles, onCommitShasChange, onFocusShasChange, onHoverCommit, onActivityHoverShasChange, onOpenReadmeFile, readmeActive, weekActive, onSetWeekActive, onSetCityMode, tours, toursLoading, selectedTourId, onSelectTour, onRequestDeleteTour, dirPaths, filePaths, excludedDirs, onExcludedDirsChange, isMobile, vibeCodingData, onVibeCodingClear, onVibeCodingClose, onVisiblePrsChange, onHoverPr, filteredPrNumbers, onClearFileFilter, graphSelectedPackage, onClearGraphSelection, }) => {
    const { theme } = useTheme();
    // Repo-root README (if any), surfaced as a button in the About overview.
    const readmePath = useMemo(() => findReadmePath(filePaths), [filePaths]);
    // Mobile: the About view sizes the rail to its content (to push the map),
    // while the other views render through the fixed-height SlidePane. Measuring
    // the About rail's height and reusing it for those views keeps the rail from
    // jumping when you drill into Contributors/etc. Tracked while the tours view
    // is mounted; the last value persists for the other views.
    const toursAsideRef = useRef(null);
    const [mobileRailHeight, setMobileRailHeight] = useState(null);
    useEffect(() => {
        if (!isMobile)
            return;
        const el = toursAsideRef.current;
        if (!el)
            return;
        const update = () => setMobileRailHeight(el.offsetHeight);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isMobile, leftViewMode, configMode]);
    const toursPane = (_jsx(ToursPane, { owner: owner, repo: repo, tours: tours, loading: toursLoading, selectedTourId: selectedTourId, onSelectTour: onSelectTour, viewerUserId: viewerUserId, viewerIsRepoAdmin: viewerIsRepoAdmin, onRequestDelete: onRequestDeleteTour, onSelectContributor: onSelectContributor, readmePath: readmePath, readmeActive: readmeActive, weekActive: weekActive, onOpenReadme: () => {
            if (readmePath)
                onOpenReadmeFile(readmePath);
        }, onSetWeekActive: onSetWeekActive, onSetCityMode: onSetCityMode, packageCount: packages.length, onOpenView: onSetViewMode, isMobile: isMobile }));
    // Mobile tours/About view: render the About card in normal flow so the rail
    // sizes to its content and *pushes the map* (RightPane is flex-1 and yields
    // the space), capping at 70% of the viewport and scrolling past that. The
    // SlidePane positions its panes `absolute inset-0`, so it can't take height
    // from content — this view bypasses it; the other mobile views keep the
    // fixed-height (h-[45%]) scroller below.
    if (isMobile && !configMode && leftViewMode === 'tours') {
        return (_jsx("aside", { ref: toursAsideRef, className: "flex flex-col shrink-0 w-full max-h-[70%] overflow-y-auto overscroll-none border-t", style: {
                background: theme.colors.background,
                borderColor: theme.colors.border,
            }, children: toursPane }));
    }
    return (_jsx("aside", { className: "flex flex-col shrink-0 w-full md:w-[25%] h-[45%] md:h-auto border-t md:border-t-0 md:border-r", style: {
            background: theme.colors.background,
            borderColor: theme.colors.border,
            // Match the height the About rail had so switching views doesn't jump
            // the rail (mobile only; desktop keeps md:h-auto). Falls back to the
            // h-[45%] class until the About view has been measured.
            ...(isMobile && mobileRailHeight != null
                ? { height: mobileRailHeight }
                : {}),
        }, children: _jsx(SlidePane, { viewKey: configMode ? 'config' : leftViewMode, resolveDirection: slideDirection, children: configMode ? (_jsx(FolderConfigPane, { dirPaths: dirPaths, filePaths: filePaths, excludedDirs: excludedDirs, onExcludedDirsChange: onExcludedDirsChange })) : leftViewMode === 'activity' ? (_jsx(RepoActivityPane, { owner: owner, repo: repo, selectedCommitSha: selectedCommitSha, onSelectCommit: onSelectCommit, commitFiles: commitFiles, onCommitShasChange: onCommitShasChange, onFocusShasChange: onFocusShasChange, onHoverCommit: onHoverCommit, onHoverShasChange: onActivityHoverShasChange, onClose: onToggleActivity, focusContributor: activityFocusContributor })) : leftViewMode === 'issues' ? (_jsx(RepoIssuesPane, { owner: owner, repo: repo, selectedIssueNumber: selectedIssueNumber, onSelectIssue: onSelectIssue, onClose: () => onSetViewMode('tours') })) : leftViewMode === 'pull-requests' ? (_jsx(RepoPullRequestsPane, { owner: owner, repo: repo, selectedPrNumber: selectedPrNumber, onSelectPr: onSelectPr, onClose: () => onSetViewMode('tours'), onVisiblePrsChange: onVisiblePrsChange, onHoverPr: onHoverPr, filteredPrNumbers: filteredPrNumbers, onClearFileFilter: onClearFileFilter })) : leftViewMode === 'structure' ? (_jsx(StructurePane, { packages: packages, packagesLoading: packagesLoading, filePaths: filePaths, owner: owner, repo: repo, graphSelectedPackage: graphSelectedPackage, onClearGraphSelection: onClearGraphSelection, onReadFile: onReadFile, onPackageHover: onPackageHover, onPackageSelect: onPackageSelect, onClose: () => onSetViewMode('tours') })) : leftViewMode === 'contributors' ? (_jsx(ContributorsPane, { owner: owner, repo: repo, focusContributor: contributorsFocus, onClose: () => onSetViewMode('tours') })) : leftViewMode === 'vibe-coding' ? (_jsx(VibeCodingPane, { fileCount: vibeCodingData.fileCount, occurrenceCount: vibeCodingData.occurrenceCount, files: vibeCodingData.files, terms: vibeCodingData.terms, loading: vibeCodingData.loading, error: vibeCodingData.error, scanActive: vibeCodingData.scanActive, scanProgress: vibeCodingData.scanProgress, scanDirectory: vibeCodingData.scanDirectory, totalRepoFiles: filePaths.length, onClear: onVibeCodingClear, onRefresh: () => { }, onClose: onVibeCodingClose })) : (toursPane) }) }));
};
// ---------------------------------------------------------------------------
// Folder configuration pane — Pierre tree of directories the user can
// gate in / out of the coverage calc. Selection in the Pierre tree is
// purely a "focus" indicator — picking a row doesn't change the gate.
// A footer shows the focused folder + an Include / Exclude toggle that
// adds or removes it from `excludedDirs`. Excluded folders are
// surfaced as a chip strip at the top with × to remove individually.
// ---------------------------------------------------------------------------
const FolderConfigPane = ({ dirPaths, filePaths, excludedDirs, onExcludedDirsChange }) => {
    const { theme } = useTheme();
    // Pierre is fed every directory and every file path so the tree
    // shows the full repo. Per-row kebabs are suppressed on file rows
    // (via `unsafeCSS` below) — only folders are toggleable, since the
    // gate semantically is "exclude this subtree."
    //
    // Pierre's `gitStatus` API surfaces exclusion state on each row:
    // excluded dirs *and* every descendant file are marked `'ignored'`,
    // which Pierre styles as a dimmed row natively. The model's
    // `setGitStatus` lets us update reactively after the initial mount
    // (the options object is otherwise snapshot-once).
    const treePaths = useMemo(() => [...dirPaths, ...filePaths], [dirPaths, filePaths]);
    const gitStatusEntries = useMemo(() => {
        const prefixes = excludedDirs.map((d) => d.endsWith('/') ? d : `${d}/`);
        const excludedFilesInTree = filePaths.filter((p) => prefixes.some((prefix) => p.startsWith(prefix)));
        return [
            ...excludedDirs.map((path) => ({ path, status: 'ignored' })),
            ...excludedFilesInTree.map((path) => ({
                path,
                status: 'ignored',
            })),
        ];
    }, [excludedDirs, filePaths]);
    // Suppress the kebab button on file rows. Pierre tags each row with
    // `data-item-type="file"` or `"folder"`, and the trigger button has
    // `data-type="context-menu-trigger"`.
    const unsafeCSS = `
    [data-item-type="file"] [data-type="context-menu-trigger"] {
      display: none !important;
    }
  `;
    const { model } = useFileTree({
        paths: treePaths,
        initialExpansion: 'closed',
        initialSelectedPaths: [],
        search: false,
        gitStatus: gitStatusEntries,
        unsafeCSS,
        composition: {
            contextMenu: {
                enabled: true,
                triggerMode: 'both',
                buttonVisibility: 'always',
            },
        },
    });
    useEffect(() => {
        model.setGitStatus(gitStatusEntries);
    }, [model, gitStatusEntries]);
    const treeStyles = useMemo(() => themeToTreeStyles({
        type: 'dark',
        bg: theme.colors.background,
        fg: theme.colors.text,
    }), [theme.colors.background, theme.colors.text]);
    return (_jsxs("div", { className: "flex flex-col flex-1 min-h-0", children: [_jsx("div", { className: "px-4 py-2 border-b flex items-center justify-between gap-2", style: {
                    borderColor: theme.colors.border,
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes[0],
                }, children: excludedDirs.length === 0 ? (_jsx("span", { children: "Click the \u22EF on any folder to exclude it. Exclusions cascade." })) : (_jsxs(_Fragment, { children: [_jsxs("span", { children: [excludedDirs.length, " folder", excludedDirs.length === 1 ? '' : 's', ' ', "excluded"] }), _jsx("button", { type: "button", onClick: () => onExcludedDirsChange([]), className: "underline-offset-2 hover:underline", style: { color: theme.colors.primary, cursor: 'pointer' }, children: "Clear all" })] })) }), _jsx("div", { className: "flex-1 min-h-0 pt-4", style: { background: theme.colors.background }, children: _jsx(PierreFileTree, { model: model, renderContextMenu: (item, context) => {
                        // Only directories are toggleable. Files reach this only
                        // via right-click since the kebab is hidden on file rows.
                        if (item.kind !== 'directory')
                            return null;
                        const path = item.path;
                        const isExcluded = excludedDirs.includes(path);
                        const toggle = () => {
                            if (isExcluded) {
                                onExcludedDirsChange(excludedDirs.filter((d) => d !== path));
                            }
                            else {
                                onExcludedDirsChange([...excludedDirs, path]);
                            }
                            context.close();
                        };
                        // Pierre's default placement anchors the menu to the right
                        // of the kebab. We portal to body and position it ourselves
                        // so the menu opens *left* of the anchor — closer to the
                        // tree row content and away from the panel edge. The
                        // data-* attribute tells Pierre's outside-click handler
                        // that clicks inside the portal are still "inside".
                        const MENU_WIDTH = 200;
                        const GAP = 8;
                        const left = Math.max(8, context.anchorRect.left - MENU_WIDTH - GAP);
                        const top = context.anchorRect.top;
                        return createPortal(_jsx("div", { "data-file-tree-context-menu-root": "true", className: "rounded-md shadow-lg", style: {
                                position: 'fixed',
                                top,
                                left,
                                width: MENU_WIDTH,
                                background: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`,
                                padding: 4,
                                zIndex: 1000,
                            }, children: _jsx("button", { type: "button", onClick: toggle, className: "w-full text-left px-3 py-2 rounded transition-colors hover:opacity-90", style: {
                                    background: 'transparent',
                                    color: isExcluded
                                        ? theme.colors.primary
                                        : theme.colors.warning ?? theme.colors.accent,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontFamily: theme.fonts.body,
                                    fontSize: theme.fontSizes[1],
                                }, children: isExcluded ? 'Include in coverage' : 'Exclude from coverage' }) }), document.body);
                    }, style: {
                        ...treeStyles,
                        height: '100%',
                        display: 'block',
                    } }) })] }));
};
// ---------------------------------------------------------------------------
// Files pane — Pierre tree of the repo's files. With trails present it lists
// just the files they touch, each row badged "×N" for how many distinct trails
// reference it (built from the union of loaded payloads' marker sourcePaths).
// With no trails to derive a subset from, it falls back to the whole file tree.
// Selecting a file lights up its building on the map; folder rows don't select.
// ---------------------------------------------------------------------------
const SHOW_FOLDER_CONFIG = false;
// Trails and Files views are hidden while we rebuild the repo learning
// experience around Tours + the repo overview. All the plumbing (the view
// switcher, trail list, files tree, folder config) is kept intact — flip this
// back to true to restore the Tours / Trails / Files segmented control.
const ListMessage = ({ children }) => {
    const { theme } = useTheme();
    return (_jsx("div", { className: "px-4 py-6 text-center", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: children }));
};
/**
 * Equal-width City | README | This week switch for the About / tours rail.
 * Matches the desktop RepoAboutCard segmented control.
 */
const GuideModeSwitch = ({ mode, readmePath, onSetCity, onOpenReadme, onSetWeek, className }) => {
    const { theme } = useTheme();
    const options = [
        {
            id: 'readme',
            label: 'README',
            title: readmePath ? `Open ${readmePath}` : 'No README found',
            icon: _jsx(FileText, { size: 14 }),
            enabled: !!readmePath,
        },
        {
            id: 'week',
            label: 'This week',
            title: "Show commits for this week so far",
            icon: _jsx(GitCommitHorizontal, { size: 14 }),
            enabled: true,
        },
        {
            id: 'city',
            label: 'City',
            title: 'Show the file city',
            icon: _jsx(Building2, { size: 14 }),
            enabled: true,
        },
    ];
    const select = (id) => {
        if (id === mode)
            return;
        if (id === 'city')
            onSetCity();
        else if (id === 'readme')
            onOpenReadme();
        else
            onSetWeek(true);
    };
    return (_jsx("div", { role: "radiogroup", "aria-label": "File City guide mode", className: className, style: {
            display: 'flex',
            width: '100%',
            alignItems: 'stretch',
            padding: 3,
            borderRadius: 8,
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.backgroundSecondary,
            gap: 2,
            boxSizing: 'border-box',
        }, children: options.map((opt) => {
            const selected = mode === opt.id;
            const disabled = !opt.enabled;
            return (_jsxs("button", { type: "button", role: "radio", "aria-checked": selected, disabled: disabled, title: opt.title, onClick: () => select(opt.id), style: {
                    flex: '1 1 0',
                    minWidth: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    padding: '6px 8px',
                    border: 'none',
                    borderRadius: 6,
                    background: selected ? theme.colors.background : 'transparent',
                    color: disabled
                        ? theme.colors.textTertiary
                        : selected
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                    boxShadow: selected
                        ? `0 0 0 1px ${theme.colors.border}, 0 1px 2px rgba(0,0,0,0.08)`
                        : 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    fontWeight: selected
                        ? (theme.fontWeights.semibold ?? 600)
                        : (theme.fontWeights.medium ?? 500),
                    opacity: disabled ? 0.5 : 1,
                    transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
                }, children: [opt.icon, _jsx("span", { style: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }, children: opt.label })] }, opt.id));
        }) }));
};
const ToursEmptyState = ({ readmePath = null, onOpenReadme, readmeActive = false, weekActive = false, onSetWeekActive, onSetCityMode, }) => {
    const guideMode = weekActive
        ? 'week'
        : readmeActive
            ? 'readme'
            : 'city';
    return (_jsx(_Fragment, { children: _jsx("div", { className: "flex flex-col gap-2", children: onOpenReadme && onSetWeekActive && onSetCityMode ? (_jsx(GuideModeSwitch, { mode: guideMode, readmePath: readmePath, onSetCity: onSetCityMode, onOpenReadme: onOpenReadme, onSetWeek: onSetWeekActive })) : null }) }));
};
// Compact "x ago" for the repo's last-push timestamp. App code (Date.now is
// fine here — the workflow-script restriction doesn't apply).
function relativeTime(iso) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then))
        return '';
    const secs = Math.max(0, (Date.now() - then) / 1000);
    if (secs < 60)
        return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7)
        return `${days}d ago`;
    if (days < 30)
        return `${Math.floor(days / 7)}w ago`;
    if (days < 365)
        return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}
// The license badge's corner radius encodes how restrictive the license is: the
// stricter the license, the sharper the corners. Permissive licenses (MIT,
// Apache, BSD…) get a full pill; copyleft squares off progressively, with AGPL
// — the strongest copyleft — fully square.
function licenseBadgeRadius(spdxId) {
    const id = spdxId.toUpperCase();
    if (id.startsWith('AGPL'))
        return 0; // strongest (network) copyleft → square
    if (id.startsWith('GPL'))
        return 3; // strong copyleft
    if (id.startsWith('LGPL') ||
        id.startsWith('MPL') ||
        id.startsWith('EPL') ||
        id.startsWith('CDDL') ||
        id.startsWith('OSL')) {
        return 7; // weak copyleft
    }
    return 9999; // permissive → full pill
}
const repoInfoCache = new Map();
const repoInfoInflight = new Map();
// Cache the FULL package result (packages + summary), not just the summary —
// the overview only reads `.summary`, but the Architecture view needs the full
// `packages` array. Sharing one cache means the slow git-tree walk runs once.
const repoPkgCache = new Map();
const repoPkgInflight = new Map();
const repoContributorsCache = new Map();
const repoContributorsInflight = new Map();
function fetchRepoInfo(owner, repo) {
    const key = `${owner}/${repo}`;
    const cached = repoInfoCache.get(key);
    if (cached)
        return Promise.resolve(cached);
    const inflight = repoInfoInflight.get(key);
    if (inflight)
        return inflight;
    const run = trpc.github.getRepoInfo
        .query({ owner, repo })
        .then((d) => {
        repoInfoCache.set(key, d);
        repoInfoInflight.delete(key);
        // Record the visit so the header opener (and the recent-repos panel) can
        // surface it later. Best-effort: never let a storage error break the page.
        try {
            addRecentRepository(d);
        }
        catch {
            // ignore
        }
        // Record the visit in the global community feed too (public repos only;
        // the server gates on the GitHub `private` flag). Fire-and-forget — this
        // is telemetry for the home "Visited by others" rail, never load-bearing.
        void fetch('/api/repos/community-visits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner, repo }),
        }).catch(() => {
            // ignore
        });
        return d;
    })
        .catch(() => {
        // Best-effort — leave uncached so a later visit retries.
        repoInfoInflight.delete(key);
        return null;
    });
    repoInfoInflight.set(key, run);
    return run;
}
function fetchRepoPkg(owner, repo) {
    const key = `${owner}/${repo}`;
    const cached = repoPkgCache.get(key);
    if (cached)
        return Promise.resolve(cached);
    const inflight = repoPkgInflight.get(key);
    if (inflight)
        return inflight;
    const run = trpc.github.getRepoPackages
        .query({ owner, repo })
        .then((d) => {
        repoPkgCache.set(key, d);
        repoPkgInflight.delete(key);
        return d;
    })
        .catch(() => {
        // Best-effort — leave uncached so a later visit retries.
        repoPkgInflight.delete(key);
        return null;
    });
    repoPkgInflight.set(key, run);
    return run;
}
function fetchRepoContributors(owner, repo) {
    const key = `${owner}/${repo}`;
    const cached = repoContributorsCache.get(key);
    if (cached)
        return Promise.resolve(cached);
    const inflight = repoContributorsInflight.get(key);
    if (inflight)
        return inflight;
    const run = trpc.github.getRepoContributors
        .query({ owner, repo })
        .then((d) => {
        repoContributorsCache.set(key, d);
        repoContributorsInflight.delete(key);
        return d;
    })
        .catch(() => {
        // Best-effort — leave uncached so a later visit retries.
        repoContributorsInflight.delete(key);
        return null;
    });
    repoContributorsInflight.set(key, run);
    return run;
}
function warmRepoOverview(owner, repo) {
    void fetchRepoInfo(owner, repo);
    void fetchRepoPkg(owner, repo);
    void fetchRepoContributors(owner, repo);
}
const emailAuthorCache = new Map();
const emailAuthorInflight = new Map();
function emailAuthorKey(owner, repo, email) {
    return `${owner}/${repo}/${email.toLowerCase()}`;
}
/**
 * Overlay GitHub identity onto a set of blame emails, via the server (GitHub's
 * commits API). Only fetches emails not already cached; returns a lowercased-
 * email → identity|null map for those resolved so far, re-rendering as batches
 * land. Pass only emails that aren't already decodable as noreply, so the call
 * set stays small.
 */
function useCommitAuthorsByEmail(owner, repo, emails, seed) {
    const [tick, setTick] = useState(0);
    // Deduped, lowercased request set — KEEPS the caller's order (highest
    // contribution first) so the most important identities resolve in the first
    // batches. Set preserves first-insertion order.
    const wanted = useMemo(() => Array.from(new Set(emails.map((e) => e.toLowerCase()))), [emails]);
    // Order-independent key so a pure reorder of the same set doesn't refire.
    const wantedKey = useMemo(() => [...wanted].sort().join(','), [wanted]);
    // Prime the module cache from the server-embedded map (GET payload) BEFORE the
    // resolve effect runs, so already-known emails never trigger a GitHub fan-out.
    // Effects fire in source order, so this lands first on mount.
    useEffect(() => {
        if (!seed)
            return;
        let changed = false;
        for (const [email, identity] of Object.entries(seed)) {
            const key = emailAuthorKey(owner, repo, email);
            if (!emailAuthorCache.has(key)) {
                emailAuthorCache.set(key, identity);
                changed = true;
            }
        }
        // Re-read so seeded identities show immediately, without waiting on a batch.
        if (changed)
            setTick((t) => t + 1);
    }, [owner, repo, seed]);
    useEffect(() => {
        if (wanted.length === 0)
            return;
        let cancelled = false;
        // The route caps `emails` at 80 (z.array().max(80)); a big repo's blame map
        // easily has more non-noreply emails than that, and a single over-cap query
        // is rejected wholesale — silently dropping every overlay. So chunk under
        // the cap, and walk the chunks SEQUENTIALLY in contribution order: the top
        // contributors resolve (and their rows light up) first, and we never fan a
        // dozen batches out at once into GitHub's secondary rate limit.
        const BATCH = 50;
        void (async () => {
            for (let i = 0; i < wanted.length && !cancelled; i += BATCH) {
                const chunk = wanted
                    .slice(i, i + BATCH)
                    .filter((e) => !emailAuthorCache.has(emailAuthorKey(owner, repo, e)));
                if (chunk.length === 0)
                    continue;
                const batchKey = `${owner}/${repo}/${chunk.join(',')}`;
                const inflight = emailAuthorInflight.get(batchKey);
                if (inflight) {
                    await inflight;
                    continue;
                }
                const run = trpc.github.getCommitAuthorsByEmail
                    .query({ owner, repo, emails: chunk })
                    .then((res) => {
                    for (const [email, identity] of Object.entries(res)) {
                        emailAuthorCache.set(emailAuthorKey(owner, repo, email), identity);
                    }
                })
                    .catch(() => {
                    /* rate-limited / private — leave these a miss, retried next mount */
                })
                    .finally(() => {
                    emailAuthorInflight.delete(batchKey);
                });
                emailAuthorInflight.set(batchKey, run);
                await run;
                // Re-render after each batch so resolved avatars appear top-down.
                if (!cancelled)
                    setTick((t) => t + 1);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [owner, repo, wanted, wantedKey]);
    return useMemo(() => {
        const out = {};
        for (const e of wanted) {
            const key = emailAuthorKey(owner, repo, e);
            if (emailAuthorCache.has(key))
                out[e] = emailAuthorCache.get(key) ?? null;
        }
        return out;
        // `tick` forces re-read after a batch resolves into the module cache.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [owner, repo, wantedKey, tick]);
}
// Per-user activity + extended profile for the contributor modal's detail pane,
// served by the existing GraphQL-backed /activity route. Keyed by login and
// lazy — only fetched when a contributor is actually selected, then cached for
// the rest of the session.
const userActivityCache = new Map();
const userActivityInflight = new Map();
function fetchUserActivity(login) {
    const cached = userActivityCache.get(login);
    if (cached)
        return Promise.resolve(cached);
    const inflight = userActivityInflight.get(login);
    if (inflight)
        return inflight;
    const run = fetch(
    // 365 days of calendar for the heatmap; activityDays=1 keeps the recent-
    // events half of the query cheap since the detail pane doesn't use it.
    `/api/github/user/${encodeURIComponent(login)}/activity?contributionDays=365&activityDays=1`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
        if (d)
            userActivityCache.set(login, d);
        userActivityInflight.delete(login);
        return d;
    })
        .catch(() => {
        userActivityInflight.delete(login);
        return null;
    });
    userActivityInflight.set(login, run);
    return run;
}
function useUserActivity(login) {
    const [data, setData] = useState(() => login ? userActivityCache.get(login) ?? null : null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (!login) {
            setData(null);
            setLoading(false);
            return;
        }
        const cached = userActivityCache.get(login) ?? null;
        setData(cached);
        setLoading(!cached);
        let cancelled = false;
        void fetchUserActivity(login).then((d) => {
            if (cancelled)
                return;
            setData(d);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [login]);
    return { data, loading };
}
function useRepoOverviewData(owner, repo) {
    const key = `${owner}/${repo}`;
    const [info, setInfo] = useState(() => repoInfoCache.get(key) ?? null);
    // True only while the first fetch is genuinely in flight. Settles to false
    // once the request resolves — success OR failure — so a failed fetch (which
    // leaves info null) falls through to the empty render instead of pulsing a
    // skeleton forever.
    const [loading, setLoading] = useState(() => !repoInfoCache.get(key));
    useEffect(() => {
        let cancelled = false;
        const cached = repoInfoCache.get(key) ?? null;
        setInfo(cached);
        setLoading(!cached);
        void fetchRepoInfo(owner, repo).then((d) => {
            if (cancelled)
                return;
            if (d)
                setInfo(d);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [owner, repo, key]);
    return { info, loading };
}
// Contributors for the overview's avatar row + "all contributors" modal. Reads
// the same cache warmed at page mount; resolves independently of the core
// metadata so a slow contributors call never holds back the rest of the card.
function useRepoContributorsData(owner, repo) {
    const key = `${owner}/${repo}`;
    const [data, setData] = useState(() => repoContributorsCache.get(key) ?? null);
    useEffect(() => {
        let cancelled = false;
        setData(repoContributorsCache.get(key) ?? null);
        void fetchRepoContributors(owner, repo).then((d) => {
            if (!cancelled && d)
                setData(d);
        });
        return () => {
            cancelled = true;
        };
    }, [owner, repo, key]);
    return data;
}
// Full package layers for the Architecture (composition) view. Reuses the same
// warmed cache as the overview above, so reading the full `packages` here does
// not trigger a second git-tree walk. `loading` is true only until the first
// result lands (or is already cached).
function useRepoPackagesData(owner, repo) {
    const key = `${owner}/${repo}`;
    const [full, setFull] = useState(() => repoPkgCache.get(key) ?? null);
    const [loading, setLoading] = useState(() => !repoPkgCache.get(key));
    useEffect(() => {
        let cancelled = false;
        const cached = repoPkgCache.get(key) ?? null;
        setFull(cached);
        setLoading(!cached);
        void fetchRepoPkg(owner, repo).then((d) => {
            if (cancelled)
                return;
            if (d)
                setFull(d);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [owner, repo, key]);
    return { packages: full?.packages ?? [], loading };
}
// ---------------------------------------------------------------------------
// Repo overview — a compact, no-AI dossier shown atop the Tours pane. Composes
// the repo's own GitHub metadata (description, language, license, stars,
// topics, fork-of, last push). Everything here is best-effort: each fetch is
// independent, and a failure just drops its row rather than blocking the tours
// list. The procedure is heavily cached server-side.
// ---------------------------------------------------------------------------
// Pick a directory's canonical README so a surface can offer to open it.
// With no `dir` (the default) this resolves the repo-root README: GitHub treats
// the root README as canonical, so we only look at top-level files (no slash).
// Pass a repo-relative `dir` to scope the search to that directory's own README
// — its immediate children only, not nested sub-packages — which is how a
// selected package surfaces its package-level README. Either way, prefer
// markdown variants.
function findReadmePath(filePaths, dir = null) {
    const prefix = dir ? `${dir.replace(/\/+$/, '')}/` : '';
    const matches = filePaths.filter((p) => {
        if (!p.startsWith(prefix))
            return false;
        const rest = p.slice(prefix.length);
        return !rest.includes('/') && /^readme(\.|$)/i.test(rest);
    });
    if (matches.length === 0)
        return null;
    return (matches.find((p) => /^readme\.md$/i.test(p)) ??
        matches.find((p) => /\.md$/i.test(p)) ??
        matches.find((p) => /\.markdown$/i.test(p)) ??
        matches[0] ??
        null);
}
// Per-repo persistence of whether the readme view auto-opens. The readme is
// shown by default; closing it writes `false` so it stays closed on return,
// and re-opening writes `true`. `null` (unset) means "never decided" → default
// open. Wrapped in try/catch so SSR / disabled storage degrades gracefully.
function readmeOpenStorageKey(owner, repo) {
    return `webade:readmeOpen:${owner}/${repo}`;
}
function readReadmeOpenPref(owner, repo) {
    try {
        const v = window.localStorage.getItem(readmeOpenStorageKey(owner, repo));
        return v === null ? null : v === 'true';
    }
    catch {
        return null;
    }
}
function writeReadmeOpenPref(owner, repo, open) {
    try {
        window.localStorage.setItem(readmeOpenStorageKey(owner, repo), open ? 'true' : 'false');
    }
    catch {
        // ignore (storage unavailable / quota)
    }
}
// Placeholder shown while the overview metadata is still loading on a cold
// cache. Mirrors the real card's container + rough block layout (title row,
// description lines, contributor faces) so the swap to real content doesn't
// shift the pane. Pulses via the shared `pulse` keyframe.
const RepoOverviewSkeleton = ({ showBorder = true, }) => {
    const { theme } = useTheme();
    const bar = (w, h, radius = 4) => ({
        width: w,
        height: h,
        borderRadius: radius,
        backgroundColor: theme.colors.border,
        animation: 'pulse 1.5s ease-in-out infinite',
    });
    return (_jsxs("div", { className: `px-5 pt-5 pb-4 flex flex-col gap-3${showBorder ? ' border-b' : ''}`, style: { borderColor: theme.colors.border }, "aria-busy": "true", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("div", { style: bar('45%', 22, 6) }), _jsx("div", { style: bar(56, 18, 6) })] }), _jsx("div", { style: bar('100%', 14) }), _jsx("div", { style: bar('70%', 14) }), _jsxs("div", { className: "flex flex-col gap-1.5 mt-1", children: [_jsx("div", { style: bar(96, 10) }), _jsx("div", { className: "flex items-stretch gap-2", children: [0, 1, 2, 3].map((i) => (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("div", { style: {
                                        width: 40,
                                        height: 40,
                                        borderRadius: '9999px',
                                        backgroundColor: theme.colors.border,
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                    } }), _jsx("div", { style: bar(40, 8) })] }, i))) })] }), _jsx("style", { children: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      ` })] }));
};
const RepoOverview = ({ owner, repo, showBorder = true, onSelectContributor, ctaSlot, }) => {
    const { theme } = useTheme();
    // Read from the shared cache, warmed at page mount (see warmRepoOverview), so
    // the metadata is typically ready the instant this card first renders.
    const { info, loading } = useRepoOverviewData(owner, repo);
    const contributors = useRepoContributorsData(owner, repo);
    // Star toggle state — only active when the user is authenticated.
    const { isAuthenticated } = useAuth();
    const [starred, setStarred] = useState(false);
    const [starLoading, setStarLoading] = useState(false);
    useEffect(() => {
        if (!isAuthenticated) {
            setStarred(false);
            setStarLoading(false);
            return;
        }
        let cancelled = false;
        fetch(`/api/github/star/${owner}/${repo}`)
            .then((r) => r.json())
            .then((data) => { if (!cancelled)
            setStarred(data.starred); })
            .catch(() => { if (!cancelled)
            setStarred(false); });
        return () => { cancelled = true; };
    }, [owner, repo, isAuthenticated]);
    const handleToggleStar = useCallback(async () => {
        if (!isAuthenticated || starLoading)
            return;
        setStarLoading(true);
        try {
            const method = starred ? 'DELETE' : 'PUT';
            const response = await fetch(`/api/github/star/${owner}/${repo}`, { method });
            if (response.ok)
                setStarred(!starred);
        }
        catch { /* ignore */ }
        finally {
            setStarLoading(false);
        }
    }, [owner, repo, starred, starLoading, isAuthenticated]);
    // Which metric the contributor cards show: GitHub commit count vs the share
    // of repo lines blamed to them. The % option (and its toggle) is only
    // surfaced when a cached blame analysis exists for this repo.
    const [metricMode, setMetricMode] = useState('commits');
    const AVATAR_LIMIT = 4;
    // Cached, server-published blame analysis. useRepoAnalysis only sets this once
    // the S3 artifact exists (`cached: true`), so a non-null value IS our "does
    // coverage exist" signal — we never run the sweep here.
    const { analysis } = useRepoAnalysis();
    // Eagerly resolve GitHub identity for the head of the blame map so the "Lines"
    // avatar row has faces the moment the Commits/Lines switch is visible — instead
    // of waiting for the Contributors pane to mount. Bounded to a small head (the
    // row only shows AVATAR_LIMIT people; the ×3 headroom covers humans split
    // across several emails), so this is one tiny batch, not the pane's full-map
    // fan-out. Seeded with the baked overlay, so a warmed repo resolves these from
    // cache and never hits GitHub. analysisContributors is lines-desc, so the first
    // emails are the biggest owners.
    const lineEmailsToResolve = useMemo(() => analysis
        ? analysisContributors(analysis)
            .filter((p) => !p.noreplyLogin)
            .slice(0, AVATAR_LIMIT * 3)
            .map((p) => p.email)
        : [], [analysis]);
    const lineIdentities = useCommitAuthorsByEmail(owner, repo, lineEmailsToResolve, analysis?.identityByEmail);
    // "Lines" people: top line-owners from the cached analysis. Emails are merged
    // into people using the live overlay above, falling back to the server-baked
    // identityByEmail map; a person GitHub can't attribute keeps a name/email key
    // and just renders without an avatar link.
    const linePeople = useMemo(() => {
        if (!analysis)
            return [];
        const identityOf = (email) => {
            const key = email.toLowerCase();
            const live = lineIdentities[key];
            if (live) {
                return {
                    login: live.login,
                    id: live.id,
                    avatarUrl: live.avatarUrl,
                    htmlUrl: live.htmlUrl,
                    name: live.name,
                };
            }
            const o = analysis.identityByEmail?.[key];
            return o
                ? { login: o.login, id: o.id, avatarUrl: o.avatarUrl, htmlUrl: o.htmlUrl, name: o.name }
                : undefined;
        };
        return mergeContributors(analysis, analysisContributors(analysis), identityOf)
            .slice()
            .sort((a, b) => b.stats.lineShare - a.stats.lineShare)
            .slice(0, AVATAR_LIMIT)
            .map((p) => ({
            // Share the GitHub-id key with the commits list so a person who leads in
            // both views reuses the same card DOM node and FLIP-slides between slots.
            key: p.githubId != null ? `gh:${p.githubId}` : p.key,
            login: p.login ?? p.name,
            name: p.name,
            hasLogin: Boolean(p.login),
            avatarUrl: p.avatarUrl,
            htmlUrl: p.htmlUrl,
            commits: p.commits,
            lines: p.stats.lines,
            lineShare: p.stats.lineShare,
        }));
    }, [analysis, lineIdentities]);
    // "Commits" people: preferred source is GitHub's contributor graph. When that
    // fails or is empty (rate limit / 403 / cold cache), fall back to the analysis
    // head so the About row still paints — the slim analysis GET always ships the
    // top line-owners with commit counts from shortlog.
    const commitPeople = useMemo(() => (contributors?.contributors ?? []).slice(0, AVATAR_LIMIT).map((c) => ({
        key: `gh:${c.id}`,
        login: c.login,
        name: c.login,
        hasLogin: true,
        avatarUrl: c.avatar_url,
        htmlUrl: c.html_url,
        commits: c.contributions,
    })), [contributors]);
    // The switch only appears when the cached analysis actually yielded owners.
    const hasCoverage = linePeople.length > 0;
    // Prefer GitHub for Commits mode; if GitHub is empty, use analysis people so
    // the whole "Top contributors" block isn't gated off by a 403.
    const commitCards = commitPeople.length > 0 ? commitPeople : linePeople;
    const cards = metricMode === 'percent' && hasCoverage ? linePeople : commitCards;
    const orderKey = cards.map((c) => c.key).join(',');
    // FLIP: snapshot each card's box, then slide any card that shares a key across
    // a mode switch from its old slot to the new one for a smooth rearrange.
    const cardRefs = useRef(new Map());
    const prevRects = useRef(new Map());
    useLayoutEffect(() => {
        const refs = cardRefs.current;
        const snapshot = new Map();
        refs.forEach((el, key) => {
            const next = el.getBoundingClientRect();
            snapshot.set(key, next); // record the true new layout box before transforming
            const prev = prevRects.current.get(key);
            const dx = prev ? prev.left - next.left : 0;
            if (dx) {
                el.style.transition = 'none';
                el.style.transform = `translateX(${dx}px)`;
                void el.offsetWidth; // force reflow so the start offset sticks
                requestAnimationFrame(() => {
                    el.style.transition = 'transform 280ms cubic-bezier(0.2, 0, 0, 1)';
                    el.style.transform = '';
                });
            }
        });
        prevRects.current = snapshot;
    }, [orderKey]);
    // While the first fetch is in flight (cold cache), show a skeleton sized to
    // the real card so the pane doesn't flash blank-then-pop. Once the fetch
    // settles with no info (e.g. a failed request), fall through to null rather
    // than pulsing forever. The tours list renders regardless (below this).
    if (!info)
        return loading ? (_jsx(RepoOverviewSkeleton, { showBorder: showBorder })) : null;
    const license = info.license?.spdx_id && info.license.spdx_id !== 'NOASSERTION'
        ? info.license.spdx_id
        : null;
    return (_jsxs("div", { className: `px-5 pt-5 pb-4 flex flex-col gap-3${showBorder ? ' border-b' : ''}`, style: { borderColor: theme.colors.border }, children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("a", { href: `https://github.com/${owner}/${repo}`, target: "_blank", rel: "noopener noreferrer", className: "min-w-0 transition-opacity hover:opacity-80", style: { textDecoration: 'none' }, title: `Open ${owner}/${repo} on GitHub`, children: _jsx("h1", { className: "min-w-0", style: {
                                margin: 0,
                                fontFamily: theme.fonts.body,
                                fontSize: theme.fontSizes[4],
                                fontWeight: theme.fontWeights.bold,
                                color: theme.colors.primary,
                                lineHeight: 1.2,
                                wordBreak: 'break-word',
                            }, children: repo }) }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: [license &&
                                (() => {
                                    // MIT gets a green treatment; everything else stays neutral.
                                    const isMit = license === 'MIT';
                                    const accent = isMit
                                        ? theme.colors.success
                                        : theme.colors.textSecondary;
                                    return (_jsx("span", { style: {
                                            padding: '2px 8px',
                                            borderRadius: licenseBadgeRadius(license),
                                            fontSize: theme.fontSizes[0],
                                            fontWeight: theme.fontWeights.medium,
                                            color: accent,
                                            background: isMit
                                                ? `color-mix(in srgb, ${theme.colors.success} 14%, transparent)`
                                                : `color-mix(in srgb, ${theme.colors.text} 8%, transparent)`,
                                            border: `1px solid ${isMit
                                                ? `color-mix(in srgb, ${theme.colors.success} 40%, transparent)`
                                                : theme.colors.border}`,
                                        }, children: license }));
                                })(), info.stargazers_count > 0 && (isAuthenticated ? (_jsxs("button", { type: "button", onClick: handleToggleStar, disabled: starLoading, className: "inline-flex items-center gap-1 transition-opacity hover:opacity-80 disabled:opacity-50", style: {
                                    fontSize: theme.fontSizes[2],
                                    color: theme.colors.textMuted,
                                    background: 'none',
                                    border: 'none',
                                    cursor: starLoading ? 'default' : 'pointer',
                                    padding: 0,
                                }, title: starred ? 'Unstar repository' : 'Star repository', children: [_jsx(Star, { size: 16, style: { color: starred ? theme.colors.warning : theme.colors.textMuted }, fill: starred ? theme.colors.warning : 'none' }), info.stargazers_count.toLocaleString()] })) : (_jsxs("span", { className: "inline-flex items-center gap-1", style: { fontSize: theme.fontSizes[2] }, children: [_jsx(Star, { size: 16, style: { color: theme.colors.warning }, fill: theme.colors.warning }), info.stargazers_count.toLocaleString()] })))] })] }), info.description ? (_jsx("p", { style: {
                    margin: 0,
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[2],
                    lineHeight: 1.4,
                }, children: info.description })) : (_jsxs(_Fragment, { children: [_jsxs("p", { style: {
                            margin: 0,
                            color: theme.colors.textMuted,
                            fontSize: theme.fontSizes[1],
                            lineHeight: 1.4,
                            fontStyle: 'italic',
                        }, children: ["No description for ", owner, "/", repo, "."] }), _jsx("a", { href: `https://github.com/${owner}/${repo}`, target: "_blank", rel: "noopener noreferrer", className: "transition-opacity hover:opacity-80", style: { color: theme.colors.primary, fontSize: theme.fontSizes[1] }, children: "Update on GitHub" })] })), _jsxs("div", { className: "flex items-center justify-between gap-2", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[2] }, children: [info?.pushed_at ? (_jsxs("span", { children: ["Updated ", relativeTime(info.pushed_at)] })) : null, _jsxs("span", { children: ["Created ", relativeTime(info.created_at)] })] }), cards.length > 0 && (_jsxs("div", { className: "flex flex-col gap-1.5 mt-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { style: {
                                    fontSize: theme.fontSizes[0],
                                    fontWeight: theme.fontWeights.semibold,
                                    color: theme.colors.textSecondary,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }, children: "Top contributors" }), hasCoverage && (_jsx("div", { className: "inline-flex items-center rounded-md p-0.5 shrink-0", style: {
                                    border: `1px solid ${theme.colors.border}`,
                                    background: theme.colors.background,
                                }, children: ['commits', 'percent'].map((m) => {
                                    const active = metricMode === m;
                                    return (_jsx("button", { type: "button", "aria-pressed": active, onClick: () => setMetricMode(m), className: "rounded transition-opacity hover:opacity-90", style: {
                                            padding: '1px 7px',
                                            minWidth: 54,
                                            textAlign: 'center',
                                            fontSize: theme.fontSizes[0],
                                            fontWeight: theme.fontWeights.medium,
                                            lineHeight: 1.5,
                                            border: 'none',
                                            cursor: 'pointer',
                                            ...(active
                                                ? { background: theme.colors.primary, color: '#ffffff' }
                                                : {
                                                    background: 'transparent',
                                                    color: theme.colors.textSecondary,
                                                }),
                                        }, children: m === 'commits' ? 'Commits' : 'Lines' }, m));
                                }) }))] }), _jsx("div", { className: "flex items-stretch gap-2", children: cards.map((c) => {
                            // Each contributor is a little card: avatar on top, name, and a
                            // metric below — commits by default, line-share % in "Lines" mode.
                            const metricText = metricMode === 'percent'
                                ? `${((c.lineShare ?? 0) * 100).toFixed(1)}%`
                                : c.commits.toLocaleString();
                            const cardInner = (_jsxs(_Fragment, { children: [c.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    _jsx("img", { src: `${c.avatarUrl}${c.avatarUrl.includes('?') ? '&' : '?'}s=80`, alt: c.login, width: 40, height: 40, className: "rounded-full block", style: { background: theme.colors.backgroundSecondary } })) : (
                                    // Unresolved blame author (no GitHub identity) → initial.
                                    _jsx("div", { className: "rounded-full flex items-center justify-center", style: {
                                            width: 40,
                                            height: 40,
                                            background: theme.colors.backgroundSecondary,
                                            color: theme.colors.textSecondary,
                                            fontSize: theme.fontSizes[1],
                                            fontWeight: theme.fontWeights.semibold,
                                        }, children: c.login.charAt(0).toUpperCase() })), _jsx("span", { className: "block truncate w-full text-center", style: {
                                            fontSize: theme.fontSizes[0],
                                            color: theme.colors.textSecondary,
                                        }, children: c.login }), _jsx("span", { className: "block truncate w-full text-center", style: {
                                            fontSize: theme.fontSizes[0],
                                            color: theme.colors.textMuted,
                                        }, children: metricText })] }));
                            const tip = c.lineShare != null
                                ? `${c.login} · ${((c.lineShare ?? 0) * 100).toFixed(1)}% of repo (${(c.lines ?? 0).toLocaleString()} lines) · ${c.commits.toLocaleString()} commits`
                                : `${c.login} · ${c.commits.toLocaleString()} commits`;
                            const cardBase = 'flex flex-1 min-w-0 flex-col items-center gap-1.5 rounded-lg px-2 py-2';
                            const cardStyle = {
                                border: `1px solid ${theme.colors.border}`,
                                background: theme.colors.backgroundSecondary,
                            };
                            // Track the card element so the FLIP effect can slide it to its
                            // new slot when the metric (and thus the order) changes.
                            const setRef = (el) => {
                                if (el)
                                    cardRefs.current.set(c.key, el);
                                else
                                    cardRefs.current.delete(c.key);
                            };
                            // Resolved contributor with a handler → opens their Contributors
                            // profile; resolved without a handler → links to GitHub; an
                            // unresolved blame author has no link target, so render it static.
                            return onSelectContributor && c.hasLogin ? (_jsx("button", { ref: setRef, type: "button", onClick: () => onSelectContributor({
                                    login: c.login,
                                    avatar_url: c.avatarUrl ?? '',
                                }), title: `${tip} — view recent activity`, className: `${cardBase} transition-transform hover:scale-105`, style: { ...cardStyle, cursor: 'pointer' }, children: cardInner }, c.key)) : c.htmlUrl ? (_jsx("a", { ref: setRef, href: c.htmlUrl, target: "_blank", rel: "noopener noreferrer", title: tip, className: `${cardBase} transition-transform hover:scale-105`, style: cardStyle, children: cardInner }, c.key)) : (_jsx("div", { ref: setRef, title: tip, className: cardBase, style: cardStyle, children: cardInner }, c.key));
                        }) })] })), ctaSlot && _jsx("div", { className: "mt-3", children: ctaSlot }), info.fork && info.parent && (_jsxs("div", { className: "inline-flex items-center gap-1 min-w-0", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: [_jsx(GitFork, { size: 14, className: "shrink-0" }), _jsx("span", { className: "shrink-0", children: "forked from" }), _jsx("a", { href: `https://github.com/${info.parent.full_name}`, target: "_blank", rel: "noopener noreferrer", className: "truncate", style: { color: theme.colors.primary }, children: info.parent.full_name })] }))] }));
};
// Full-rail Structure pane (opened from the "Structure" nav card): the package
// composition panel under a header with a close button that returns to the
// tours view. Mirrors the Activity pane's full-rail shape.
const StructurePane = ({ packages, packagesLoading, filePaths, owner, repo, graphSelectedPackage, onClearGraphSelection, onReadFile, onPackageHover, onPackageSelect, onClose, }) => {
    const { theme } = useTheme();
    const [readmeContent, setReadmeContent] = useState(null);
    const [readmeLoading, setReadmeLoading] = useState(false);
    const [readmeError, setReadmeError] = useState(null);
    // Find README path for the graph-selected package
    const readmePath = useMemo(() => {
        if (!graphSelectedPackage)
            return null;
        return findReadmePath(filePaths, graphSelectedPackage.packagePath);
    }, [graphSelectedPackage, filePaths]);
    // Fetch README content when graph-selected package changes
    useEffect(() => {
        if (!readmePath) {
            setReadmeContent(null);
            setReadmeError(null);
            return;
        }
        let cancelled = false;
        setReadmeLoading(true);
        setReadmeError(null);
        onReadFile(readmePath)
            .then((content) => {
            if (!cancelled) {
                setReadmeContent(content);
                setReadmeLoading(false);
            }
        })
            .catch((err) => {
            if (!cancelled) {
                setReadmeError(err instanceof Error ? err.message : 'Failed to load README');
                setReadmeLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [readmePath, onReadFile]);
    // Show README for the package selected in the file city guide graph
    if (graphSelectedPackage) {
        const basePath = readmePath?.includes('/')
            ? readmePath.slice(0, readmePath.lastIndexOf('/'))
            : '';
        return (_jsxs("div", { className: "flex-1 min-h-0 flex flex-col", children: [_jsx(RailPaneHeader, { icon: _jsx(FileText, { size: 14 }), label: graphSelectedPackage.packageName || graphSelectedPackage.packagePath, onClose: onClearGraphSelection, closeAsBack: true }), readmeLoading ? (_jsx("div", { className: "flex-1 min-h-0 flex items-center justify-center px-6 text-center", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: "Loading README..." })) : readmeError ? (_jsx("div", { className: "flex-1 min-h-0 flex items-center justify-center px-6 text-center", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: readmeError })) : readmeContent ? (_jsx("div", { className: "flex-1 min-h-0 overflow-auto p-4", children: _jsx(IndustryMarkdownSlide, { content: readmeContent, slideIdPrefix: `pkg-readme-${readmePath}`, slideIndex: 0, theme: theme, transparentBackground: true, disableScroll: true, containerWidth: 0, disableBasePadding: true, fontSizeScale: 1, repositoryInfo: {
                            owner,
                            repo,
                            basePath,
                        } }) })) : (_jsx("div", { className: "flex-1 min-h-0 flex items-center justify-center px-6 text-center", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: "No README found for this package." }))] }));
    }
    // Default: show package list
    return (_jsxs("div", { className: "flex-1 min-h-0 flex flex-col", children: [_jsx(RailPaneHeader, { icon: _jsx(Boxes, { size: 14 }), label: "Structure", count: packages.length || undefined, onClose: onClose, closeAsBack: true }), packages.length === 0 && !packagesLoading ? (_jsx("div", { className: "flex-1 min-h-0 flex items-center justify-center px-6 text-center", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[1] }, children: "No package structure detected for this repository." })) : (_jsx("div", { className: "flex-1 min-h-0 overflow-hidden", children: _jsx(PackageCompositionPanelContent, { packages: packages, isLoading: packagesLoading, readFile: onReadFile, onPackageHover: onPackageHover, onPackageSelect: onPackageSelect }) }))] }));
};
// Round avatar with a letter fallback when no GitHub image is known (a blame
// email that didn't resolve to an account).
const ContributorAvatar = ({ avatarUrl, name, size }) => {
    const { theme } = useTheme();
    if (avatarUrl) {
        const sep = avatarUrl.includes('?') ? '&' : '?';
        return (
        // eslint-disable-next-line @next/next/no-img-element
        _jsx("img", { src: `${avatarUrl}${sep}s=${size * 2}`, alt: name, width: size, height: size, className: "rounded-full shrink-0", style: { background: theme.colors.backgroundSecondary } }));
    }
    return (_jsx("div", { className: "rounded-full shrink-0 flex items-center justify-center", style: {
            width: size,
            height: size,
            background: theme.colors.backgroundSecondary,
            color: theme.colors.textMuted,
            fontSize: size * 0.45,
            fontWeight: 600,
        }, children: name.charAt(0).toUpperCase() }));
};
// Full-rail Contributors pane (opened from the "Contributors" nav card / the
// "+N" chip): a scrolling list that drills into one contributor's profile, with
// a back button.
//
// Source of truth: once a repo analysis has been pulled, the list is built from
// the BLAME MAP (every email that owns code at HEAD), so each row always has
// coverage and clicking it always highlights — GitHub avatar/login is overlaid
// best-effort on top. Before any analysis, it falls back to GitHub's contributor
// graph (commit counts, no coverage).
const ContributorsPane = ({ owner, repo, focusContributor, onClose }) => {
    const { theme } = useTheme();
    const { analysis, setSelectedEmails, ownershipLoading } = useRepoAnalysis();
    // Fallback source: GitHub contributor graph (used only before analysis).
    const githubData = useRepoContributorsData(owner, repo);
    const githubPeople = useMemo(() => githubData?.contributors ?? [], [githubData]);
    // Primary source: contributors derived straight from the blame map.
    const blamePeople = useMemo(() => (analysis ? analysisContributors(analysis) : []), [analysis]);
    // Overlay GitHub identity onto the non-noreply blame emails (noreply emails
    // already embed the login/id, so they need no lookup).
    const unresolvedEmails = useMemo(() => blamePeople.filter((p) => !p.noreplyLogin).map((p) => p.email), [blamePeople]);
    const emailAuthors = useCommitAuthorsByEmail(owner, repo, unresolvedEmails, analysis?.identityByEmail);
    const rows = useMemo(() => {
        if (analysis) {
            // Collapse one human's several blame emails into a single person, keyed on
            // resolved GitHub id (with a name fallback for emails GitHub can't
            // attribute). The API overlay is the resolver; noreply emails carry their
            // own id and are resolved inside mergeContributors.
            const identityOf = (email) => {
                const o = emailAuthors[email.toLowerCase()];
                return o ? { login: o.login, id: o.id, avatarUrl: o.avatarUrl, htmlUrl: o.htmlUrl, name: o.name } : undefined;
            };
            return mergeContributors(analysis, blamePeople, identityOf).map((p) => {
                const extra = p.emails.length - 1;
                return {
                    key: p.key,
                    email: p.emails[0],
                    emails: p.emails,
                    name: p.name,
                    displayName: p.name !== p.login ? p.name : undefined,
                    // When resolved, subtitle is the primary email (+N when merged);
                    // otherwise the name already headlines, so no subtitle.
                    secondary: p.login
                        ? extra > 0
                            ? `${p.emails[0]} +${extra}`
                            : p.emails[0]
                        : extra > 0
                            ? `${p.emails[0]} +${extra}`
                            : undefined,
                    avatarUrl: p.avatarUrl,
                    login: p.login,
                    htmlUrl: p.htmlUrl,
                    stats: p.stats,
                    commits: p.commits,
                };
            });
        }
        return githubPeople.map((c) => ({
            key: c.login,
            login: c.login,
            name: c.login,
            avatarUrl: c.avatar_url,
            htmlUrl: c.html_url,
            commits: c.contributions,
        }));
    }, [analysis, blamePeople, emailAuthors, githubPeople]);
    const [selectedKey, setSelectedKey] = useState(null);
    const selected = selectedKey
        ? rows.find((r) => r.key === selectedKey) ?? null
        : null;
    const clearSelection = useCallback(() => {
        setSelectedKey(null);
        setSelectedEmails(null);
    }, [setSelectedEmails]);
    // Drop the contribution highlight layer when this pane unmounts — leaving the
    // Contributors view (back to About, or any other rail view) must clear it, not
    // just the explicit back/toggle inside the pane.
    useEffect(() => () => setSelectedEmails(null), [setSelectedEmails]);
    const handleRowClick = useCallback((row) => {
        // Toggle: clicking the active row clears; otherwise highlight the union
        // of every blame email this person owns.
        const active = row.key === selectedKey;
        setSelectedKey(active ? null : row.key);
        setSelectedEmails(active ? null : row.emails ?? (row.email ? [row.email] : null));
    }, [selectedKey, setSelectedEmails]);
    // Pre-select the contributor requested from the About card. Rows resolve
    // async (GitHub identity overlays onto blame emails), so this runs whenever
    // rows change until the login matches; the applied-token ref makes it fire
    // once per click while still re-drilling when the token bumps.
    const appliedFocusToken = useRef(null);
    useEffect(() => {
        if (!focusContributor)
            return;
        if (appliedFocusToken.current === focusContributor.token)
            return;
        const target = focusContributor.login.toLowerCase();
        const match = rows.find((r) => r.login?.toLowerCase() === target);
        if (!match)
            return; // login not resolved onto a row yet — wait for rows
        appliedFocusToken.current = focusContributor.token;
        setSelectedKey(match.key);
        setSelectedEmails(match.emails ?? (match.email ? [match.email] : null));
    }, [focusContributor, rows, setSelectedEmails]);
    return (_jsxs("div", { className: "flex-1 min-h-0 flex flex-col", children: [_jsx(RailPaneHeader, { icon: _jsx(Users, { size: 14 }), label: "Contributors", count: selected ? undefined : rows.length || undefined, onClose: onClose, onBack: selected ? clearSelection : undefined, closeAsBack: true, crumb: selected
                    ? selected.login
                        ? `@${selected.login}`
                        : selected.name
                    : undefined }), ownershipLoading && !selected && (_jsx("div", { className: "h-0.5 w-full shrink-0", style: { background: theme.colors.primary, opacity: 0.6 } })), _jsx(SlidePane, { viewKey: selected ? selected.key : 'list', resolveDirection: (_from, to) => (to === 'list' ? -1 : 1), children: selected ? (_jsx("div", { className: "flex-1 min-h-0 overflow-y-auto", children: _jsx(ContributorProfile, { identity: {
                            login: selected.login,
                            name: selected.name,
                            avatarUrl: selected.avatarUrl,
                            htmlUrl: selected.htmlUrl,
                            emails: selected.emails,
                            commits: selected.commits,
                        }, repo: repo, coverage: selected.stats ?? null }, selected.key) })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex-1 min-h-0 overflow-y-auto", children: rows.length === 0 ? (_jsx(ListMessage, { children: analysis ? 'No attributed contributors.' : 'Loading contributors…' })) : (rows.map((row) => {
                                const active = row.key === selectedKey;
                                const share = row.stats?.lineShare ?? 0;
                                return (_jsxs("button", { type: "button", onClick: () => handleRowClick(row), className: "flex w-full flex-col gap-1.5 px-4 py-3 text-left border-b transition-colors", style: {
                                        borderColor: theme.colors.border,
                                        color: theme.colors.text,
                                        background: active
                                            ? theme.colors.backgroundSecondary
                                            : 'transparent',
                                        boxShadow: active
                                            ? `inset 3px 0 0 ${theme.colors.primary}`
                                            : undefined,
                                    }, onMouseEnter: (e) => {
                                        if (!active)
                                            e.currentTarget.style.background =
                                                theme.colors.backgroundSecondary;
                                        // Preview this contributor's highlight on hover — no
                                        // click needed. Rows in analysis mode carry `emails`;
                                        // fallback (GitHub-graph) rows have none and nothing to
                                        // highlight anyway. Hover only previews while nothing is
                                        // pinned; once a row is selected it owns the highlight and
                                        // stray enter/leave events during the slide-to-profile
                                        // handoff must not disturb it.
                                        if (!selected)
                                            setSelectedEmails(row.emails ?? null);
                                    }, onMouseLeave: (e) => {
                                        if (!active)
                                            e.currentTarget.style.background = 'transparent';
                                        // Clearing the preview only makes sense while nothing is
                                        // pinned. Clicking a row sets `selectedKey` and slides the
                                        // pane to the profile; the trailing mouseleave that fires
                                        // as this button slides out from under the cursor must NOT
                                        // null the highlight, or the just-pinned selection would
                                        // blink off. The selection now owns it (handleRowClick set
                                        // selectedEmails); leave it alone.
                                        if (!selected)
                                            setSelectedEmails(null);
                                    }, children: [_jsxs("div", { className: "flex w-full items-center gap-3", children: [_jsx(ContributorAvatar, { avatarUrl: row.avatarUrl, name: row.name, size: 36 }), _jsx("div", { className: "min-w-0 flex flex-col", children: _jsx("span", { className: "truncate", style: {
                                                            fontSize: theme.fontSizes[2],
                                                            fontWeight: theme.fontWeights.semibold,
                                                        }, children: row.displayName ?? row.login ?? row.name }) }), _jsx("span", { className: "ml-auto shrink-0 text-right tabular-nums", style: {
                                                        color: theme.colors.textMuted,
                                                        fontSize: theme.fontSizes[1],
                                                    }, title: row.stats
                                                        ? `${row.stats.lines.toLocaleString()} lines · ${row.stats.files.toLocaleString()} files`
                                                        : undefined, children: row.stats
                                                        ? `${(share * 100).toFixed(1)}%`
                                                        : (row.commits ?? 0).toLocaleString() })] }), row.stats && (_jsx("div", { className: "h-1 w-full rounded-full overflow-hidden", style: { background: theme.colors.border }, children: _jsx("div", { className: "h-full rounded-full", style: {
                                                    width: `${Math.max(2, share * 100)}%`,
                                                    background: theme.colors.primary,
                                                } }) }))] }, row.key));
                            })) }), !analysis && (_jsx("a", { href: `https://github.com/${owner}/${repo}/graphs/contributors`, target: "_blank", rel: "noopener noreferrer", className: "px-4 py-2.5 border-t text-center transition-colors hover:opacity-80 shrink-0", style: {
                                borderColor: theme.colors.border,
                                color: theme.colors.primary,
                                fontSize: theme.fontSizes[1],
                            }, children: "View all on GitHub" }))] })) })] }));
};
// A labeled progress bar for one coverage metric in the contributor overview
// (lines attributed / files covered). `fraction` is in [0,1].
const CoverageMetric = ({ label, fraction, detail, color }) => {
    const { theme } = useTheme();
    const pct = Math.max(0, Math.min(1, fraction)) * 100;
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsxs("div", { className: "flex items-baseline justify-between", style: { color: theme.colors.text, fontSize: theme.fontSizes[1] }, children: [_jsx("span", { children: label }), _jsxs("span", { className: "tabular-nums", style: { fontWeight: theme.fontWeights.semibold }, children: [pct.toFixed(1), "%"] })] }), _jsx("div", { className: "h-1.5 w-full rounded-full overflow-hidden", style: { background: theme.colors.border }, children: _jsx("div", { className: "h-full rounded-full", style: { width: `${Math.max(2, pct)}%`, background: color } }) }), _jsx("div", { className: "tabular-nums", style: { color: theme.colors.textMuted, fontSize: theme.fontSizes[0] }, children: detail })] }));
};
// Detail pane: the selected contributor's extended profile (contact info) plus
// a year's contribution heatmap, lazy-loaded from the /activity route.
const ContributorProfile = ({ identity, repo, coverage }) => {
    const { theme } = useTheme();
    const { data, loading } = useUserActivity(identity.login ?? null);
    const activityData = useMemo(() => {
        const m = new Map();
        for (const d of data?.contributions ?? [])
            m.set(d.date, d.count);
        return m;
    }, [data]);
    const profile = data?.user;
    const displayName = profile?.name || identity.name;
    const muted = theme.colors.textMuted;
    // One contact row — icon + value (optionally a link) — rendered only when the
    // field is present, so the pane stays tight on sparse profiles.
    const metaRow = (icon, value, href) => (_jsxs("div", { className: "flex items-center gap-2 min-w-0", style: { color: muted, fontSize: theme.fontSizes[1] }, children: [_jsx("span", { className: "shrink-0", children: icon }), href ? (_jsx("a", { href: href, target: "_blank", rel: "noopener noreferrer", className: "truncate transition-opacity hover:opacity-80", style: { color: theme.colors.primary }, children: value })) : (_jsx("span", { className: "truncate", children: value }))] }));
    return (_jsxs("div", { className: "flex flex-col gap-3 p-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(ContributorAvatar, { avatarUrl: identity.avatarUrl, name: identity.name, size: 56 }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate", style: {
                                    fontSize: theme.fontSizes[3],
                                    fontWeight: theme.fontWeights.bold,
                                    color: theme.colors.text,
                                }, children: displayName }), identity.login && (_jsxs("a", { href: identity.htmlUrl ?? `https://github.com/${identity.login}`, target: "_blank", rel: "noopener noreferrer", className: "truncate block transition-opacity hover:opacity-80", style: { color: theme.colors.primary, fontSize: theme.fontSizes[1] }, children: ["@", identity.login] }))] })] }), identity.emails && identity.emails.length > 0 && (_jsx("div", { className: "flex flex-col gap-1.5", children: identity.emails.map((email) => (_jsx(Fragment, { children: metaRow(_jsx(Mail, { size: 14 }), email, `mailto:${email}`) }, email))) })), identity.commits != null && identity.commits > 0 && (_jsxs("div", { style: {
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[1],
                }, children: [_jsx("span", { style: { fontWeight: theme.fontWeights.semibold }, children: identity.commits.toLocaleString() }), ' ', identity.commits === 1 ? 'commit' : 'commits', " to ", repo] })), coverage && (_jsxs("div", { className: "flex flex-col gap-2.5", children: [_jsx(CoverageMetric, { label: "Lines attributed", fraction: coverage.lineShare, detail: `${coverage.lines.toLocaleString()} / ${coverage.totalLines.toLocaleString()} lines`, color: theme.colors.primary }), _jsx(CoverageMetric, { label: "Files covered", fraction: coverage.fileCoverage, detail: `${coverage.files.toLocaleString()} / ${coverage.totalFiles.toLocaleString()} files`, color: theme.colors.accent })] })), profile?.bio && (_jsx("p", { style: {
                    margin: 0,
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[1],
                    lineHeight: 1.4,
                }, children: profile.bio })), profile && (_jsxs("div", { className: "flex flex-col gap-1.5", children: [profile.company &&
                        metaRow(_jsx(Building2, { size: 14 }), profile.company), profile.location &&
                        metaRow(_jsx(MapPin, { size: 14 }), profile.location), profile.websiteUrl &&
                        metaRow(_jsx(Globe, { size: 14 }), profile.websiteUrl.replace(/^https?:\/\//, ''), profile.websiteUrl.startsWith('http')
                            ? profile.websiteUrl
                            : `https://${profile.websiteUrl}`), profile.twitterUsername &&
                        metaRow(_jsx(Twitter, { size: 14 }), `@${profile.twitterUsername}`, `https://x.com/${profile.twitterUsername}`), metaRow(_jsx(Users, { size: 14 }), `${profile.followersCount.toLocaleString()} followers · ${profile.followingCount.toLocaleString()} following`)] })), identity.login && (_jsxs("div", { className: "mt-1", children: [_jsx("div", { className: "mb-1.5", style: { color: muted, fontSize: theme.fontSizes[0] }, children: "Contributions in the last year" }), loading && !data ? (_jsx("div", { className: "flex items-center justify-center", style: { height: 120, color: muted }, children: _jsx(InlineTrailLoader, { size: 18 }) })) : data ? (_jsx("div", { className: "rounded-md overflow-hidden", children: _jsx(ActivityHeatmap, { activityData: activityData, bannerHeight: 132 }) })) : (_jsx("div", { style: { color: muted, fontSize: theme.fontSizes[1] }, children: "Activity unavailable." }))] }))] }));
};
// Nav cards rendered under the About card in the tours view: a compact grid of
// icon + label + count tiles, each swapping the rail to a full-rail view
// (Trails / Structure / Contributors / Activity) the same way Recent Activity
// does. Structure is hidden when no packages were detected.
const RepoNavCards = ({ owner, repo, packageCount, onOpenView }) => {
    const { theme } = useTheme();
    const contributors = useRepoContributorsData(owner, repo);
    const contributorCount = contributors?.contributors.length ?? 0;
    const cards = [
        ...(packageCount > 0
            ? [
                {
                    mode: 'structure',
                    icon: _jsx(Boxes, { size: 18 }),
                    label: 'Structure',
                    description: 'Packages and how the repo is laid out',
                    count: packageCount,
                },
            ]
            : []),
        {
            mode: 'contributors',
            icon: _jsx(Users, { size: 18 }),
            label: 'Contributors',
            description: 'The people who build this repo',
            count: contributorCount || undefined,
        },
        {
            mode: 'pull-requests',
            icon: _jsx(GitPullRequest, { size: 18 }),
            label: 'Pull requests',
            description: 'Open PRs and what they change',
        },
        {
            mode: 'issues',
            icon: _jsx(CircleDot, { size: 18 }),
            label: 'Issues',
            description: 'Open issues and recent reports',
        },
    ];
    return (_jsx("div", { className: "flex flex-col gap-2 px-4 py-3", children: cards.map((card) => (_jsxs("button", { type: "button", onClick: () => onOpenView(card.mode), className: "flex items-center gap-3 rounded-md px-3 py-2.5 border text-left transition-colors border-[var(--card-border)] hover:border-[var(--card-border-hover)]", style: {
                background: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                '--card-border': theme.colors.border,
                '--card-border-hover': theme.colors.primary,
            }, title: `Open ${card.label.toLowerCase()}`, children: [_jsx("span", { className: "shrink-0", style: { color: theme.colors.textSecondary }, children: card.icon }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { style: {
                                        fontSize: theme.fontSizes[2],
                                        fontWeight: theme.fontWeights.semibold,
                                    }, children: card.label }), card.count !== undefined && (_jsx("span", { style: {
                                        fontSize: theme.fontSizes[1],
                                        color: theme.colors.textMuted,
                                    }, children: card.count }))] }), _jsx("div", { className: "truncate", style: {
                                fontSize: theme.fontSizes[1],
                                color: theme.colors.textMuted,
                                lineHeight: 1.3,
                            }, children: card.description })] }), _jsx(ChevronRight, { size: 16, className: "shrink-0", style: { color: theme.colors.textMuted } })] }, card.mode))) }));
};
const ToursPane = ({ owner, repo, tours, loading, selectedTourId, onSelectTour, viewerUserId, viewerIsRepoAdmin, onRequestDelete, onSelectContributor, readmePath, onOpenReadme, readmeActive, weekActive, onSetWeekActive, onSetCityMode, packageCount, onOpenView, isMobile, }) => {
    const { theme } = useTheme();
    // With exactly one tour we collapse the list into a single "Start tour" CTA
    // (SingleTourCta) rather than a one-row list.
    const single = tours.length === 1 ? tours[0] : null;
    const singleCanDelete = single != null &&
        single.store != null &&
        viewerUserId !== null &&
        (viewerIsRepoAdmin ||
            String(single.store.createdBy.githubId) === String(viewerUserId));
    const guideMode = weekActive
        ? 'week'
        : readmeActive
            ? 'readme'
            : 'city';
    // Action block under the overview description: tour CTA + guide mode switch.
    const cta = single ? (_jsx(SingleTourCta, { canDelete: singleCanDelete, onDelete: () => onRequestDelete(single), readmePath: readmePath, onOpenReadme: onOpenReadme, readmeActive: readmeActive, weekActive: weekActive, onSetWeekActive: onSetWeekActive, onSetCityMode: onSetCityMode })) : !loading && tours.length === 0 ? (_jsx(ToursEmptyState, { readmePath: readmePath, onOpenReadme: onOpenReadme, readmeActive: readmeActive, weekActive: weekActive, onSetWeekActive: onSetWeekActive, onSetCityMode: onSetCityMode })) : (_jsx(GuideModeSwitch, { mode: guideMode, readmePath: readmePath, onSetCity: onSetCityMode, onOpenReadme: onOpenReadme, onSetWeek: onSetWeekActive }));
    // Mobile bottom rail: just the About card, with a Contributors button in
    // place of the tour CTA. The nav cards, tours list, and analysis footer are
    // dropped to keep the small-screen rail focused. Rendered in normal flow (no
    // flex-1 / internal scroller) so the enclosing rail sizes to this card's
    // content and pushes the map; the rail itself caps the height and scrolls.
    if (isMobile) {
        return (_jsx(RepoOverview, { owner: owner, repo: repo, showBorder: false, onSelectContributor: onSelectContributor, ctaSlot: _jsxs("button", { type: "button", onClick: () => onOpenView('contributors'), className: "w-full inline-flex items-center justify-center gap-2 rounded-md transition-opacity hover:opacity-90", style: {
                    padding: '10px 14px',
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    fontWeight: theme.fontWeights.semibold,
                    cursor: 'pointer',
                    background: theme.colors.primary,
                    color: '#ffffff',
                    border: `1px solid ${theme.colors.primary}`,
                }, children: [_jsx(Users, { size: 16 }), "Contributors"] }) }));
    }
    return (_jsxs("div", { className: "flex-1 min-h-0 flex flex-col", children: [_jsxs("div", { className: "shrink-0", children: [_jsx(RepoOverview, { owner: owner, repo: repo, onSelectContributor: onSelectContributor, ctaSlot: cta }), _jsx(RepoNavCards, { owner: owner, repo: repo, packageCount: packageCount, onOpenView: onOpenView })] }), _jsx("div", { className: "flex-1 min-h-0 overflow-y-auto overscroll-none flex flex-col", children: _jsx("div", { className: "shrink-0", children: !single &&
                        (loading ? (_jsx(ListMessage, { children: "Loading tours\u2026" })) : (tours.map((item) => (_jsx(TourRow, { tour: item.tour, selected: item.tour.id === selectedTourId, onSelect: () => onSelectTour(item.tour.id === selectedTourId ? null : item.tour.id), 
                            // Only store-backed tours are deletable; gate on the validated
                            // session, mirroring trails (author-or-repo-admin).
                            canDelete: item.store != null &&
                                viewerUserId !== null &&
                                (viewerIsRepoAdmin ||
                                    String(item.store.createdBy.githubId) ===
                                        String(viewerUserId)), onDelete: () => onRequestDelete(item) }, item.tour.id))))) }) })] }));
};
const TourRow = ({ tour, selected, onSelect, canDelete, onDelete, }) => {
    const { theme } = useTheme();
    const stepCount = Array.isArray(tour.steps) ? tour.steps.length : 0;
    // `audience` is an optional, loosely-typed field on the tour schema — read
    // defensively so a missing/non-string value just drops the eyebrow.
    const audienceRaw = tour.audience;
    const audience = typeof audienceRaw === 'string' ? audienceRaw : null;
    return (_jsxs("div", { className: "relative border-b transition-colors", style: {
            background: selected
                ? `color-mix(in srgb, ${theme.colors.surface} 50%, ${theme.colors.background})`
                : 'transparent',
            borderColor: theme.colors.border,
            color: theme.colors.text,
        }, children: [_jsx("button", { type: "button", onClick: onSelect, className: "w-full text-left px-4 pt-3", style: { background: 'transparent', color: 'inherit' }, children: _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "break-words", style: {
                                fontSize: theme.fontSizes[2],
                                fontWeight: theme.fontWeights.semibold,
                                paddingRight: canDelete ? 28 : 0,
                            }, children: tour.title }), _jsxs("div", { className: "mt-1.5 flex items-center gap-3", style: {
                                color: theme.colors.textMuted,
                                fontSize: theme.fontSizes[0],
                            }, children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Compass, { size: 12 }), stepCount, " ", stepCount === 1 ? 'step' : 'steps'] }), audience && _jsx("span", { className: "truncate", children: audience })] }), tour.description && (_jsx("div", { className: "mt-1 break-words", style: {
                                color: theme.colors.textMuted,
                                fontSize: theme.fontSizes[0],
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }, children: tour.description }))] }) }), canDelete && (_jsx("button", { type: "button", onClick: (e) => {
                    e.stopPropagation();
                    onDelete();
                }, "aria-label": `Delete tour “${tour.title}”`, title: "Delete tour", className: "absolute top-2.5 right-2.5 w-7 h-7 rounded-md flex items-center justify-center transition-opacity opacity-60 hover:opacity-100", style: {
                    background: 'transparent',
                    color: theme.colors.error ?? theme.colors.textMuted,
                }, children: _jsx(Trash2, { size: 14 }) }))] }));
};
/**
 * Audio status badge + Generate/Regenerate button for the active tour, rendered
 * inline in the header while a tour is selected. Shows live per-step progress
 * while generating, and disables the button while the tour is inside its
 * once-per-hour cooldown.
 */
const TourAudioControl = ({ status, progress, onGenerate }) => {
    const { theme } = useTheme();
    const muted = theme.colors.textMuted;
    const accent = theme.colors.primary ?? '#3b82f6';
    const cooldownMinutes = useMemo(() => {
        if (!status.canGenerateAt)
            return 0;
        const ms = new Date(status.canGenerateAt).getTime() - Date.now();
        return ms > 0 ? Math.ceil(ms / 60000) : 0;
    }, [status.canGenerateAt]);
    const rowStyle = 'flex items-center gap-2';
    const labelStyle = { fontSize: theme.fontSizes[0] };
    // Active generation — show per-step progress, no button.
    if (progress?.phase === 'running') {
        return (_jsxs("div", { className: rowStyle, style: { color: muted, ...labelStyle }, children: [_jsx(InlineTrailLoader, { size: 12 }), _jsxs("span", { children: ["Generating audio\u2026 ", progress.done, "/", progress.total] })] }));
    }
    const generateButton = (label) => {
        const disabled = cooldownMinutes > 0;
        return (_jsxs("button", { type: "button", disabled: disabled, title: disabled
                ? `Audio was generated recently — available again in ~${cooldownMinutes}m`
                : undefined, onClick: (e) => {
                e.stopPropagation();
                if (!disabled)
                    onGenerate();
            }, className: "inline-flex items-center gap-1 rounded px-2 py-1 border transition-colors", style: {
                fontSize: theme.fontSizes[0],
                borderColor: theme.colors.border,
                color: disabled ? muted : accent,
                opacity: disabled ? 0.6 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }, children: [_jsx(Mic, { size: 12 }), disabled ? `Available in ${cooldownMinutes}m` : label] }));
    };
    if (progress?.phase === 'error') {
        return (_jsxs("div", { className: rowStyle, children: [_jsxs("span", { className: "inline-flex items-center gap-1", style: { color: '#dc2626', ...labelStyle }, children: [_jsx(AlertTriangle, { size: 12 }), progress.error ?? 'Generation failed'] }), generateButton('Retry')] }));
    }
    if (status.state === 'ready') {
        return (_jsxs("div", { className: rowStyle, style: { color: muted, ...labelStyle }, children: [_jsx(Volume2, { size: 12, style: { color: accent } }), _jsx("span", { children: "Audio ready" })] }));
    }
    if (status.state === 'outdated') {
        return (_jsxs("div", { className: rowStyle, children: [_jsxs("span", { className: "inline-flex items-center gap-1", style: { color: muted, ...labelStyle }, children: [_jsx(AlertTriangle, { size: 12 }), "Audio outdated"] }), generateButton('Regenerate')] }));
    }
    // 'none' or 'partial' — no complete audio yet.
    return (_jsxs("div", { className: rowStyle, children: [_jsx("span", { style: { color: muted, ...labelStyle }, children: status.state === 'partial'
                    ? `Partial audio (${status.readySteps}/${status.totalSteps})`
                    : 'No audio' }), generateButton('Generate')] }));
};
// ---------------------------------------------------------------------------
// Single-tour CTA. When a repo has exactly one tour, the Tours pane shows the
// guide-mode switch and a delete link. The Start/Stop tour button lives in the
// page header (Header component) so it's always accessible.
// ---------------------------------------------------------------------------
const SingleTourCta = ({ canDelete, onDelete, readmePath = null, onOpenReadme, readmeActive = false, weekActive = false, onSetWeekActive, onSetCityMode, }) => {
    const { theme } = useTheme();
    const guideMode = weekActive
        ? 'week'
        : readmeActive
            ? 'readme'
            : 'city';
    return (_jsxs("div", { className: "flex flex-col gap-2", children: [onOpenReadme && onSetWeekActive && onSetCityMode ? (_jsx(GuideModeSwitch, { mode: guideMode, readmePath: readmePath, onSetCity: onSetCityMode, onOpenReadme: onOpenReadme, onSetWeek: onSetWeekActive })) : null, canDelete && (_jsxs("button", { type: "button", onClick: onDelete, className: "self-start inline-flex items-center gap-1 transition-opacity opacity-70 hover:opacity-100", style: {
                    background: 'transparent',
                    color: theme.colors.error ?? theme.colors.textMuted,
                    fontSize: theme.fontSizes[0],
                    cursor: 'pointer',
                }, children: [_jsx(Trash2, { size: 12 }), "Delete tour"] }))] }));
};
// ---------------------------------------------------------------------------
// Explored-file → trails overlay. Floats over the panel listing every trail
// that touches the file picked in the Explored Files tree. Clicking a row
// opens that trail in the panel behind it; the backdrop or × dismisses.
// Mirrors the desktop app's TrailFileTrailsOverlay.
// ---------------------------------------------------------------------------
// Author chip for the file-trails overlay rows. Split out so it can resolve
// the GitHub display name via the useGithubDisplayName hook (rows are rendered
// in an inline .map, where a hook can't be called directly).
const RightPane = ({ owner, repo, fileTree, filteredFileTree, treeError, selectedTour, idleHighlightLayers, packageHighlightLayers, idleFocusDirectory, highlightLayersLoading, excludedFolders, showSpatialContext, showColorLegend, showColorLegendToggle, defaultLegendOpen, onCloseCommit, onCloseIssue, onClosePullRequest, onCloseWeekCommits, activityHeatmapLayers, prHeatmapLayers, commitView, commitViewLoading, issueView, issueViewLoading, pullRequestView, pullRequestViewLoading, readmeView, readmeViewLoading, weekCommitsView, weekCommitsLoading, currentAuthor, onOpenFile, vibeCodingHighlightLayer, vibeCodingScanWindowLayer, guideMode, activeReadmePath, packages, packagesLoading, leftViewMode, onSetViewMode, onPackageGraphSelect, }) => {
    const { theme } = useTheme();
    // Contribution-coverage highlight for the contributor picked in the
    // RepoAnalysisButton — blended into whichever panel is showing below.
    const { analysis, contributionLayers } = useRepoAnalysis();
    const events = useMemo(() => new PanelEventBus(), []);
    // Map / list open → source drawer (+ PR file filter). Prefer a typed
    // `file:open` subscription; keep `file:opened` for older emitters.
    // `onOpenFile` must be stable (parent uses useCallback) so this effect
    // doesn't unsubscribe mid-hover when PR heatmap context refreshes.
    useEffect(() => {
        const handle = (e) => {
            if (e.type !== 'file:open' && e.type !== 'file:opened')
                return;
            const path = e.payload?.path;
            if (typeof path === 'string' && path)
                onOpenFile(path);
        };
        const unsubOpen = events.on('file:open', handle);
        const unsubOpened = events.on('file:opened', handle);
        return () => {
            unsubOpen();
            unsubOpened();
        };
    }, [events, onOpenFile]);
    // Listen for package selection from the file city guide's package graph
    // and forward to the parent so it can show the README in the left panel.
    useEffect(() => {
        const unsub = events.on('package:select', (e) => {
            const payload = e.payload;
            onPackageGraphSelect(payload?.packagePath ? { packagePath: payload.packagePath, packageName: payload.packageName ?? '' } : null);
        });
        return unsub;
    }, [events, onPackageGraphSelect]);
    // Tour panel wiring. The tour panel takes one IntroductionTour at a time
    // and draws its own step UI.
    const tourRepository = useMemo(() => ({ id: `${owner}/${repo}`, owner, name: repo }), [owner, repo]);
    // Audio narration: fetch all step URLs upfront via the TTS backend, keyed by
    // step id (the panel looks up `audioUrls.get(step.id)`). The panel passes the
    // `tourAudioContext` we supply below straight back into this action.
    const tourActions = useMemo(() => ({
        openFile: (filePath) => onOpenFile(filePath),
        fetchAudioUrls: async (ctx) => {
            const data = await trpc.tts.batchGenerate.mutate({
                owner: ctx.owner,
                repo: ctx.repo,
                path: ctx.path,
                commitSha: ctx.commitSha,
                cacheOnly: ctx.cacheOnly,
            });
            const urls = new Map();
            for (const step of data.steps) {
                if (step.status === 'ready')
                    urls.set(step.stepId, step.audioUrl);
            }
            return urls;
        },
        // The commit mode's ✕ returns to the idle city by clearing the selection.
        closeCommit: () => onCloseCommit(),
        // The issue mode's ✕ does the same for a selected issue.
        closeIssue: () => onCloseIssue(),
        // And the PR mode's ✕ for a selected pull request.
        closePullRequest: () => onClosePullRequest(),
        // Week mode's ✕ returns to the idle city.
        closeWeekCommits: () => onCloseWeekCommits(),
        // Package graph mode's ✕ returns to the idle city.
        closePackageGraph: () => onSetViewMode('tours'),
    }), [
        onOpenFile,
        onCloseCommit,
        onCloseIssue,
        onClosePullRequest,
        onCloseWeekCommits,
        onSetViewMode,
    ]);
    // Coordinates the TTS backend needs to look up this tour's cached audio.
    // Points at the source the tour was discovered in (repo or fork).
    const tourAudioContext = useMemo(() => selectedTour
        ? {
            owner: selectedTour.audio.owner,
            repo: selectedTour.audio.repo,
            path: selectedTour.audio.path,
            commitSha: selectedTour.audio.commitSha ?? undefined,
            // Always cache-only: selecting a tour plays whatever audio already
            // exists and never triggers generation. Generation is a deliberate,
            // rate-limited action from the tours list (the Generate button).
            cacheOnly: true,
        }
        : undefined, [selectedTour]);
    const tourContext = useMemo(() => {
        const fileTreeSlice = {
            scope: 'repository',
            name: 'fileTree',
            data: filteredFileTree ?? null,
            loading: fileTree === null,
            error: null,
            refresh: async () => { },
        };
        const tourSlice = {
            scope: 'repository',
            name: 'tour',
            data: selectedTour?.tour ?? null,
            loading: false,
            error: null,
            refresh: async () => { },
        };
        return {
            currentScope: { type: 'repository' },
            refresh: async () => { },
            fileTree: fileTreeSlice,
            lineCounts: lineCountsSlice(analysis),
            tour: tourSlice,
            // Picking a commit in the Activity list flips the panel into its native
            // commit mode (city framed top-right + header/message/file-list chrome).
            commit: {
                scope: 'repository',
                name: 'commit',
                data: commitView,
                loading: commitViewLoading,
                error: null,
                refresh: async () => { },
            },
            // Picking an issue flips the panel into its native issue mode (header +
            // body + reporter card, city framed top-right).
            issue: {
                scope: 'repository',
                name: 'issue',
                data: issueView,
                loading: issueViewLoading,
                error: null,
                refresh: async () => { },
            },
            // Picking a PR flips the panel into its native PR mode (header +
            // description + Files/Details tabs, changed buildings lit top-right).
            pullRequest: {
                scope: 'repository',
                name: 'pullRequest',
                data: pullRequestView,
                loading: pullRequestViewLoading,
                error: null,
                refresh: async () => { },
            },
            // Opening the repo README flips the panel into its native readme mode
            // (markdown left + city framed top-right + file-type legend bottom-right).
            // Suppressed while a tour is open (panel ranks readme above tour) or
            // during vibe-coding highlights. Also suppressed while week mode is
            // active (mutually exclusive). Package selection can set
            // activeReadmePath without entering guide readme mode.
            readme: {
                scope: 'repository',
                name: 'readme',
                data: !activeReadmePath ||
                    selectedTour?.tour ||
                    vibeCodingHighlightLayer !== null ||
                    weekCommitsView
                    ? null
                    : readmeView,
                loading: readmeViewLoading,
                error: null,
                refresh: async () => { },
            },
            // Week-commits mode — this calendar week so far. Suppressed while a tour
            // is open so tour chrome wins. Gated on guideMode === 'week'.
            weekCommits: {
                scope: 'repository',
                name: 'weekCommits',
                data: guideMode !== 'week' || selectedTour?.tour ? null : weekCommitsView,
                loading: weekCommitsLoading,
                error: null,
                refresh: async () => { },
            },
            // While a tour is open the panel sources highlights from the active
            // step and ignores this slice. In the idle/no-tour state (the default
            // right pane) it honors host layers — that's where the Architecture
            // panel's package directory highlight and the Activity churn heatmap land.
            highlightLayers: {
                scope: 'repository',
                name: 'highlightLayers',
                data: packageHighlightLayers || activityHeatmapLayers || prHeatmapLayers || contributionLayers || vibeCodingHighlightLayer || vibeCodingScanWindowLayer
                    ? [
                        ...(packageHighlightLayers ?? []),
                        ...(activityHeatmapLayers ?? []),
                        ...(prHeatmapLayers ?? []),
                        ...(contributionLayers ?? []),
                        ...(vibeCodingHighlightLayer ? [vibeCodingHighlightLayer] : []),
                        ...(vibeCodingScanWindowLayer ? [vibeCodingScanWindowLayer] : []),
                    ]
                    : null,
                loading: false,
                error: null,
                refresh: async () => { },
            },
            // Package data for the panel's internal package-directory fill layers.
            // The panel builds semi-transparent highlight layers from this and
            // exposes a toggle — the host just passes the data.
            packages: {
                scope: 'repository',
                name: 'packages',
                data: packages.length > 0
                    ? { packages, summary: { isMonorepo: packages.length > 1, totalPackages: packages.length, workspacePackages: packages.map(p => ({ name: p.packageData.name, path: p.packageData.path })), totalDependencies: packages.reduce((sum, p) => sum + Object.keys(p.packageData.dependencies).length, 0), totalDevDependencies: packages.reduce((sum, p) => sum + Object.keys(p.packageData.devDependencies).length, 0), availableScripts: [] } }
                    : null,
                loading: packagesLoading,
                error: null,
                refresh: async () => { },
            },
            // Package-graph mode: the React Flow dependency graph overlay that
            // takes over the canvas when the Structure nav card is active.
            packageGraph: {
                scope: 'repository',
                name: 'packageGraph',
                data: leftViewMode === 'structure' && packages.length > 0
                    ? { packages: { packages, summary: { isMonorepo: packages.length > 1, totalPackages: packages.length, workspacePackages: packages.map(p => ({ name: p.packageData.name, path: p.packageData.path })), totalDependencies: packages.reduce((sum, p) => sum + Object.keys(p.packageData.dependencies).length, 0), totalDevDependencies: packages.reduce((sum, p) => sum + Object.keys(p.packageData.devDependencies).length, 0), availableScripts: [] } } }
                    : null,
                loading: packagesLoading,
                error: null,
                refresh: async () => { },
            },
            repository: tourRepository,
        };
    }, [
        fileTree,
        filteredFileTree,
        selectedTour,
        tourRepository,
        packageHighlightLayers,
        activityHeatmapLayers,
        prHeatmapLayers,
        contributionLayers,
        vibeCodingHighlightLayer,
        vibeCodingScanWindowLayer,
        guideMode,
        activeReadmePath,
        commitView,
        commitViewLoading,
        issueView,
        issueViewLoading,
        pullRequestView,
        pullRequestViewLoading,
        readmeView,
        readmeViewLoading,
        weekCommitsView,
        weekCommitsLoading,
        analysis,
        packages,
        packagesLoading,
        leftViewMode,
    ]);
    // A fresh FileCity3D canvas is blank until cameraReady, so branching the
    // tree on trailsExpanded — unmounting one panel and cold-mounting the other
    // on every Trails expand/collapse — repainted a visible city from scratch
    // each time. Instead, keep each panel mounted once it has shown and flip
    // visibility between the two layers. The trail explorer only mounts after
    // the rail first expands, so visitors who never open Trails pay nothing.
    if (treeError) {
        return (_jsx("main", { className: "flex-1 min-w-0 flex items-center justify-center px-6", style: { background: theme.colors.background, color: theme.colors.textMuted }, children: _jsx("div", { className: "text-center max-w-md", style: { fontSize: theme.fontSizes[1] }, children: treeError }) }));
    }
    if (!fileTree) {
        return (_jsx("main", { className: "flex-1 min-w-0 flex items-center justify-center", style: { background: theme.colors.background, color: theme.colors.textMuted }, children: _jsx("div", { style: { fontSize: theme.fontSizes[1] }, children: "Loading repository\u2026" }) }));
    }
    // The tour panel is the default right-pane layer: idle colored city +
    // file-type legend when nothing is picked, tour chrome once a tour is open,
    // and the native commit view once a commit is selected (driven by the
    // `commit` slice). The Trail explorer layer (with its file overlay + share
    // modal) covers it while the left-rail Trails section is expanded.
    return (_jsx("main", { className: "flex-1 min-w-0 min-h-0 relative", style: { background: theme.colors.background }, children: _jsx("div", { style: { position: 'absolute', inset: 0 }, children: _jsx(FileCityGuidePanel, { context: tourContext, actions: tourActions, events: events, tourAudioContext: tourAudioContext, autoAdvanceOnAudioEnd: true, defaultIsolationMode: "hide", excludedFolders: excludedFolders, showColorLegend: showColorLegend, showColorLegendToggle: showColorLegendToggle, defaultLegendOpen: defaultLegendOpen, showFileTreeToggle: true, idleFocusDirectory: idleFocusDirectory, readmeMarkdownWidth: 0.66, defaultSkipWelcome: true }) }) }));
};
