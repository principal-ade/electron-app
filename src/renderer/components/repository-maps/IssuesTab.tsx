import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import { Github, AlertCircle, Copy, CheckCircle2, ExternalLink, Tag, Calendar, MessageSquare, Loader2, Plus, X, Edit, Check } from 'lucide-react';
import { GithubService } from '../../main-process-api/GithubService';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  comments: number;
  user: {
    login: string;
    avatar_url: string;
  };
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
}

interface IssuesTabProps {
  repository: {
    name: string;
    owner: string;
  };
  ghOwner?: string;
  ghRepo?: string;
}

export const IssuesTab: React.FC<IssuesTabProps> = ({ repository, ghOwner, ghRepo }) => {
  const { theme } = useTheme();
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [issueFilter, setIssueFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isClosingIssue, setIsClosingIssue] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: '',
    body: '',
    labels: [] as string[],
    assignees: [] as string[]
  });
  const [labelInput, setLabelInput] = useState('');
  const [assigneeInput, setAssigneeInput] = useState('');

  const owner = ghOwner || repository.owner;
  const repo = ghRepo || repository.name;

  const fetchIssues = async () => {
      if (!owner || !repo) {
        setError('Repository information not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setAuthRequired(false);
        
        const data = await GithubService.getIssues(owner, repo);
        
        // Check if the response is an authentication error
        if (data && data.length === 1 && data[0].requiresAuth) {
          setAuthRequired(true);
          setError(data[0].message);
          setIssues([]);
        } else if (!data || data.length === 0) {
          // No issues found
          setIssues([]);
        } else {
          // Filter out pull requests (they have a pull_request property)
          setIssues(data.filter((issue: any) => !issue.hasOwnProperty('pull_request') && !issue.error));
        }
      } catch (err) {
        console.error('Error fetching issues:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch issues');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchIssues();
  }, [owner, repo]);

  const filteredIssues = issues.filter(issue => {
    if (issueFilter === 'all') return true;
    return issue.state === issueFilter;
  });

  const handleSelectAll = () => {
    if (selectedIssues.size === filteredIssues.length) {
      setSelectedIssues(new Set());
    } else {
      setSelectedIssues(new Set(filteredIssues.map(i => i.number)));
    }
  };

  const handleToggleIssue = (issueNumber: number, event?: React.MouseEvent) => {
    // Prevent modal from opening when clicking checkbox
    if (event) {
      event.stopPropagation();
    }
    const newSelected = new Set(selectedIssues);
    if (newSelected.has(issueNumber)) {
      newSelected.delete(issueNumber);
    } else {
      newSelected.add(issueNumber);
    }
    setSelectedIssues(newSelected);
  };

  const handleIssueClick = (issue: GitHubIssue, event: React.MouseEvent) => {
    // Don't open modal if clicking on checkbox or external link
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('a')) {
      return;
    }
    setSelectedIssue(issue);
    setShowIssueModal(true);
  };

  const handleCloseIssue = async () => {
    if (!selectedIssue) return;
    
    setIsClosingIssue(true);
    try {
      // Open GitHub page to close the issue
      // We can't close directly via API without auth token
      const closeUrl = `${selectedIssue.html_url}#issue-comment`;
      window.open(closeUrl, '_blank');
      
      // Refresh issues after a delay
      setTimeout(() => {
        fetchIssues();
        setShowIssueModal(false);
        setSelectedIssue(null);
      }, 2000);
    } finally {
      setIsClosingIssue(false);
    }
  };

  const handleNewIssue = () => {
    setShowCreateModal(true);
    setNewIssue({
      title: '',
      body: '',
      labels: [],
      assignees: []
    });
  };

  const handleCreateIssue = async () => {
    if (!newIssue.title.trim()) {
      alert('Please enter a title for the issue');
      return;
    }

    setIsCreatingIssue(true);
    try {
      const result = await GithubService.createIssue(owner, repo, newIssue);
      
      if (result?.success) {
        // Refresh the issues list
        await fetchIssues();
        setShowCreateModal(false);
        setNewIssue({ title: '', body: '', labels: [], assignees: [] });
        
        // Optionally open the created issue
        if (result.issue?.html_url) {
          const openInBrowser = confirm('Issue created successfully! Do you want to view it on GitHub?');
          if (openInBrowser) {
            window.open(result.issue.html_url, '_blank');
          }
        }
      } else {
        alert(result?.error || 'Failed to create issue');
      }
    } catch (error) {
      console.error('Error creating issue:', error);
      alert('Failed to create issue. Please check your GitHub CLI authentication.');
    } finally {
      setIsCreatingIssue(false);
    }
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && !newIssue.labels.includes(labelInput.trim())) {
      setNewIssue(prev => ({
        ...prev,
        labels: [...prev.labels, labelInput.trim()]
      }));
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setNewIssue(prev => ({
      ...prev,
      labels: prev.labels.filter(l => l !== label)
    }));
  };

  const handleAddAssignee = () => {
    if (assigneeInput.trim() && !newIssue.assignees.includes(assigneeInput.trim())) {
      setNewIssue(prev => ({
        ...prev,
        assignees: [...prev.assignees, assigneeInput.trim()]
      }));
      setAssigneeInput('');
    }
  };

  const handleRemoveAssignee = (assignee: string) => {
    setNewIssue(prev => ({
      ...prev,
      assignees: prev.assignees.filter(a => a !== assignee)
    }));
  };

  const generatePrompt = () => {
    const selectedIssueData = issues.filter(i => selectedIssues.has(i.number));
    
    if (selectedIssueData.length === 0) return '';

    let prompt = `I'm working on the GitHub repository ${owner}/${repo}. Here are the issues I need help with:\n\n`;
    
    selectedIssueData.forEach(issue => {
      prompt += `## Issue #${issue.number}: ${issue.title}\n`;
      prompt += `- Status: ${issue.state}\n`;
      prompt += `- URL: ${issue.html_url}\n`;
      
      if (issue.labels.length > 0) {
        prompt += `- Labels: ${issue.labels.map(l => l.name).join(', ')}\n`;
      }
      
      if (issue.body) {
        prompt += `- Description:\n${issue.body}\n`;
      }
      
      prompt += '\n';
    });

    prompt += `Please help me understand and address these issues.`;
    
    return prompt;
  };

  const handleCopyPrompt = async () => {
    const prompt = generatePrompt();
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '16px',
        color: theme.colors.textSecondary
      }}>
        <Loader2 size={32} className="animate-spin" />
        <span>Loading issues from GitHub...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '16px',
        padding: '24px',
        textAlign: 'center'
      }}>
        <AlertCircle size={48} color={authRequired ? theme.colors.warning || '#f59e0b' : theme.colors.error} />
        <div>
          <h3 style={{ color: theme.colors.text, marginBottom: '8px' }}>
            {authRequired ? 'Authentication Required' : 'Failed to Load Issues'}
          </h3>
          <p style={{ color: theme.colors.textSecondary, maxWidth: '500px', marginBottom: '16px' }}>
            {error}
          </p>
          {authRequired && (
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: theme.colors.backgroundLight,
              border: `1px solid ${theme.colors.border}`,
              textAlign: 'left',
              maxWidth: '400px'
            }}>
              <p style={{ 
                fontFamily: 'monospace', 
                fontSize: '14px',
                color: theme.colors.text,
                marginBottom: '8px'
              }}>
                gh auth login
              </p>
              <p style={{ 
                fontSize: '12px', 
                color: theme.colors.textSecondary 
              }}>
                Run this command in your terminal to authenticate with GitHub CLI
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundLight
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['open', 'closed', 'all'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setIssueFilter(filter)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: issueFilter === filter ? 'none' : `1px solid ${theme.colors.border}`,
                  backgroundColor: issueFilter === filter ? theme.colors.primary : theme.colors.background,
                  color: issueFilter === filter ? theme.colors.background : theme.colors.text,
                  fontSize: '13px',
                  fontWeight: issueFilter === filter ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {filter === 'all' ? 'All' : filter === 'open' ? 'Open' : 'Closed'}
                <span style={{ marginLeft: '6px', opacity: 0.8 }}>
                  ({issues.filter(i => filter === 'all' || i.state === filter).length})
                </span>
              </button>
            ))}
          </div>
          
          {filteredIssues.length > 0 && (
            <button
              onClick={handleSelectAll}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.textSecondary,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {selectedIssues.size === filteredIssues.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleNewIssue}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
            New Issue
          </button>
          
          <button
            onClick={handleCopyPrompt}
          disabled={selectedIssues.size === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: selectedIssues.size > 0 ? theme.colors.primary : theme.colors.backgroundTertiary,
            color: selectedIssues.size > 0 ? theme.colors.background : theme.colors.textSecondary,
            fontSize: '14px',
            fontWeight: 600,
            cursor: selectedIssues.size > 0 ? 'pointer' : 'not-allowed',
            opacity: selectedIssues.size > 0 ? 1 : 0.5
          }}
        >
          {copiedPrompt ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          {copiedPrompt ? 'Copied!' : `Copy Prompt (${selectedIssues.size})`}
        </button>
      </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {filteredIssues.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '16px',
            color: theme.colors.textSecondary
          }}>
            <Github size={48} />
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: theme.colors.text, marginBottom: '8px' }}>No Issues Found</h3>
              <p>There are no {issueFilter !== 'all' ? issueFilter : ''} issues in this repository.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredIssues.map(issue => (
              <div
                key={issue.id}
                onClick={(e) => handleIssueClick(issue, e)}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${selectedIssues.has(issue.number) ? theme.colors.primary : theme.colors.border}`,
                  backgroundColor: selectedIssues.has(issue.number) 
                    ? theme.colors.primary + '11' 
                    : theme.colors.background,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIssues.has(issue.number)}
                    onChange={() => handleToggleIssue(issue.number)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: issue.state === 'open' ? '#22c55e22' : '#6b728022',
                        color: issue.state === 'open' ? '#22c55e' : '#6b7280',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {issue.state}
                      </span>
                      
                      <span style={{ color: theme.colors.textSecondary, fontSize: '13px' }}>
                        #{issue.number}
                      </span>
                      
                      <a
                        href={issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: theme.colors.primary,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    
                    <h4 style={{ 
                      color: theme.colors.text, 
                      marginBottom: '8px',
                      fontSize: '15px',
                      fontWeight: 600
                    }}>
                      {issue.title}
                    </h4>
                    
                    {issue.labels.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {issue.labels.map(label => (
                          <span
                            key={label.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: `#${label.color}22`,
                              color: `#${label.color}`,
                              fontSize: '11px',
                              fontWeight: 500
                            }}
                          >
                            <Tag size={10} />
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '16px',
                      fontSize: '12px',
                      color: theme.colors.textSecondary
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <img 
                          src={issue.user.avatar_url} 
                          alt={issue.user.login}
                          style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                        />
                        {issue.user.login}
                      </span>
                      
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        {formatDate(issue.created_at)}
                      </span>
                      
                      {issue.comments > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MessageSquare size={12} />
                          {issue.comments} {issue.comments === 1 ? 'comment' : 'comments'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue Detail Modal */}
      {showIssueModal && selectedIssue && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: theme.colors.background,
            borderRadius: '12px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: `1px solid ${theme.colors.border}`
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px',
              borderBottom: `1px solid ${theme.colors.border}`
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    backgroundColor: selectedIssue.state === 'open' ? '#22c55e22' : '#6b728022',
                    color: selectedIssue.state === 'open' ? '#22c55e' : '#6b7280',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}>
                    {selectedIssue.state}
                  </span>
                  <span style={{ color: theme.colors.textSecondary, fontSize: '14px' }}>
                    #{selectedIssue.number}
                  </span>
                </div>
                <h2 style={{
                  color: theme.colors.text,
                  fontSize: '20px',
                  fontWeight: 600,
                  margin: 0
                }}>
                  {selectedIssue.title}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowIssueModal(false);
                  setSelectedIssue(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }}>
              {/* Issue Metadata */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '20px',
                fontSize: '13px',
                color: theme.colors.textSecondary
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img 
                    src={selectedIssue.user.avatar_url} 
                    alt={selectedIssue.user.login}
                    style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                  />
                  <strong>{selectedIssue.user.login}</strong> opened
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} />
                  {formatDate(selectedIssue.created_at)}
                </span>
                {selectedIssue.comments > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MessageSquare size={14} />
                    {selectedIssue.comments} {selectedIssue.comments === 1 ? 'comment' : 'comments'}
                  </span>
                )}
              </div>

              {/* Labels */}
              {selectedIssue.labels.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                  {selectedIssue.labels.map(label => (
                    <span
                      key={label.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '16px',
                        backgroundColor: `#${label.color}22`,
                        color: `#${label.color}`,
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      <Tag size={12} />
                      {label.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Issue Body */}
              {selectedIssue.body && (
                <div style={{
                  backgroundColor: theme.colors.backgroundLight,
                  borderRadius: '8px',
                  padding: '16px',
                  border: `1px solid ${theme.colors.border}`
                }}>
                  <h3 style={{
                    color: theme.colors.text,
                    fontSize: '14px',
                    fontWeight: 600,
                    marginTop: 0,
                    marginBottom: '12px'
                  }}>
                    Description
                  </h3>
                  <div style={{
                    color: theme.colors.text,
                    fontSize: '14px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {selectedIssue.body}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px',
              borderTop: `1px solid ${theme.colors.border}`
            }}>
              <a
                href={selectedIssue.html_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: theme.colors.primary,
                  textDecoration: 'none',
                  fontSize: '14px'
                }}
              >
                <ExternalLink size={14} />
                View on GitHub
              </a>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedIssue.state === 'open' && (
                  <button
                    onClick={handleCloseIssue}
                    disabled={isClosingIssue}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: isClosingIssue ? 'not-allowed' : 'pointer',
                      opacity: isClosingIssue ? 0.5 : 1
                    }}
                  >
                    <Check size={14} />
                    {isClosingIssue ? 'Opening GitHub...' : 'Close Issue'}
                  </button>
                )}
                <button
                  onClick={() => {
                    window.open(`${selectedIssue.html_url}/edit`, '_blank');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background,
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <Edit size={14} />
                  Edit Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Issue Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: theme.colors.background,
            borderRadius: '12px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: `1px solid ${theme.colors.border}`
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px',
              borderBottom: `1px solid ${theme.colors.border}`
            }}>
              <h2 style={{
                color: theme.colors.text,
                fontSize: '20px',
                fontWeight: 600,
                margin: 0
              }}>
                Create New Issue
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }}>
              {/* Title Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px'
                }}>
                  Title <span style={{ color: theme.colors.error }}>*</span>
                </label>
                <input
                  type="text"
                  value={newIssue.title}
                  onChange={(e) => setNewIssue(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Issue title"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundLight,
                    color: theme.colors.text,
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Body Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px'
                }}>
                  Description
                </label>
                <textarea
                  value={newIssue.body}
                  onChange={(e) => setNewIssue(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Describe the issue..."
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundLight,
                    color: theme.colors.text,
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Labels Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px'
                }}>
                  Labels
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddLabel()}
                    placeholder="Add a label"
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundLight,
                      color: theme.colors.text,
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={handleAddLabel}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background,
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {newIssue.labels.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {newIssue.labels.map(label => (
                      <span
                        key={label}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          backgroundColor: theme.colors.primary + '22',
                          color: theme.colors.primary,
                          fontSize: '12px'
                        }}
                      >
                        {label}
                        <button
                          onClick={() => handleRemoveLabel(label)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: theme.colors.primary,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignees Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: '8px'
                }}>
                  Assignees
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={assigneeInput}
                    onChange={(e) => setAssigneeInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddAssignee()}
                    placeholder="GitHub username"
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundLight,
                      color: theme.colors.text,
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={handleAddAssignee}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background,
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
                {newIssue.assignees.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {newIssue.assignees.map(assignee => (
                      <span
                        key={assignee}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          backgroundColor: theme.colors.textSecondary + '22',
                          color: theme.colors.text,
                          fontSize: '12px'
                        }}
                      >
                        @{assignee}
                        <button
                          onClick={() => handleRemoveAssignee(assignee)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: theme.colors.text,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '20px',
              borderTop: `1px solid ${theme.colors.border}`
            }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateIssue}
                disabled={isCreatingIssue || !newIssue.title.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isCreatingIssue || !newIssue.title.trim() 
                    ? theme.colors.backgroundTertiary 
                    : theme.colors.primary,
                  color: isCreatingIssue || !newIssue.title.trim()
                    ? theme.colors.textSecondary
                    : theme.colors.background,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isCreatingIssue || !newIssue.title.trim() ? 'not-allowed' : 'pointer',
                  opacity: isCreatingIssue || !newIssue.title.trim() ? 0.5 : 1
                }}
              >
                {isCreatingIssue ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create Issue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};