import React, { useState } from 'react';
import {
  Brain,
  Settings,
  Save,
  Code,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';

interface ExampleNote {
  type: 'pattern' | 'gotcha' | 'decision' | 'explanation';
  content: string;
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
}

const EXAMPLE_NOTES: ExampleNote[] = [
  {
    type: 'pattern',
    content: 'Always use the @Authenticated decorator for protected endpoints, not middleware',
    tags: ['authentication', 'api', 'security'],
    confidence: 'high',
  },
  {
    type: 'gotcha',
    content: 'Redis connection pool is limited to 10 - rate limiter uses dedicated pool to avoid exhaustion',
    tags: ['redis', 'performance', 'rate-limiting'],
    confidence: 'high',
  },
  {
    type: 'decision',
    content: 'We cache JWT validation for 5 minutes to reduce auth service load. Trade-off: revoked tokens work briefly',
    tags: ['authentication', 'caching', 'performance'],
    confidence: 'medium',
  },
  {
    type: 'explanation',
    content: 'Webhook endpoints need higher rate limits (1000/hour) since external services retry on failure',
    tags: ['webhooks', 'rate-limiting', 'api'],
    confidence: 'high',
  },
];

export const PrincipalIntroPanel: React.FC = () => {
  const { theme } = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [conceptExpanded, setConceptExpanded] = useState(true);

  const handleNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pattern':
        return <Code size={18} color={theme.colors.primary} />;
      case 'gotcha':
        return <AlertTriangle size={18} color="#f59e0b" />;
      case 'decision':
        return <Lightbulb size={18} color="#10b981" />;
      case 'explanation':
        return <BookOpen size={18} color="#3b82f6" />;
      default:
        return <Code size={18} />;
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return '#10b981';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#ef4444';
      default:
        return theme.colors.textSecondary;
    }
  };

  const steps = [
    {
      title: 'Configure Your LLM',
      description: 'Choose your preferred LLM model (GPT-4, Claude, or local models) and set the temperature for response creativity.',
    },
    {
      title: 'Set Response Style',
      description: 'Choose the conversational tone: Mentor (educational), Peer (collaborative), or Expert (authoritative).',
    },
    {
      title: 'Start Saving Notes',
      description: 'As you work with AI agents, save tribal knowledge using the repository_note tool. Tag your notes with relevant keywords.',
    },
    {
      title: 'Query Your Principal',
      description: 'Your AI agents can now ask the principal engineer for guidance. The more notes you save, the smarter the responses!',
    },
  ];

  return (
    <div style={{
      height: '100%',
      width: '100%',
      overflow: 'auto',
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      padding: '40px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '12px',
          }}>
            <Brain size={40} color={theme.colors.primary} />
            <h1 style={{
              fontSize: '36px',
              fontWeight: 700,
              margin: 0,
              color: theme.colors.text,
            }}>
              Principal MCP: Your AI Development Mentor
            </h1>
          </div>
          <p style={{
            fontSize: '18px',
            color: theme.colors.textSecondary,
            maxWidth: '800px',
            margin: '0 auto',
          }}>
            Capture and share tribal knowledge to make your AI agents smarter about your codebase
          </p>
        </div>

        {/* The Concept Section */}
        <div style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          border: `1px solid ${theme.colors.border}`,
        }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: conceptExpanded ? '20px' : '0',
            }}
            onClick={() => setConceptExpanded(!conceptExpanded)}
          >
            <Sparkles size={24} color={theme.colors.primary} style={{ marginRight: '12px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 600, flex: 1, margin: 0 }}>
              The Concept
            </h2>
            {conceptExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>

          {conceptExpanded && (
            <div>
              <p style={{ marginBottom: '16px', lineHeight: 1.6 }}>
                <strong>The Problem:</strong> AI agents are powerful but lack context about your specific codebase - 
                its patterns, decisions, gotchas, and tribal knowledge that experienced developers know.
              </p>
              
              <p style={{ marginBottom: '20px', lineHeight: 1.6 }}>
                <strong>The Solution:</strong> Principal MCP acts as a virtual principal engineer that learns from 
                notes saved during development. It uses a set-based approach where knowledge naturally overlaps and 
                connects through shared paths and tags.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* How It Works */}
                <div style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '8px',
                  padding: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <Users size={20} color={theme.colors.primary} style={{ marginRight: '8px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>How It Works</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <Check size={16} color="#10b981" style={{ marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>Agent asks for advice</div>
                        <div style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                          Queries the principal engineer for guidance
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <Check size={16} color="#10b981" style={{ marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>Principal searches notes</div>
                        <div style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                          Finds relevant tribal knowledge from overlapping sets
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <Check size={16} color="#10b981" style={{ marginRight: '8px', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>Provides answer or guidance</div>
                        <div style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                          Either shares knowledge or encourages note-saving
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Example When Knowledge Exists */}
                <div style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '8px',
                  padding: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <Check size={20} color="#10b981" style={{ marginRight: '8px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>When Knowledge Exists</h3>
                  </div>
                  <div style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: '6px',
                    padding: '12px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: theme.colors.primary }}>Agent:</strong> "How should I handle rate limiting for webhooks?"
                    </div>
                    <div>
                      <strong style={{ color: '#10b981' }}>Principal:</strong> "Based on our patterns, webhook endpoints need 
                      higher limits (1000/hour) since external services retry. Also, always validate 
                      signatures BEFORE rate limit checks to prevent DoS. See similar implementation in /src/api/webhooks."
                    </div>
                  </div>
                </div>
              </div>

              {/* Second row of examples */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                {/* Example When No Knowledge */}
                <div style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '8px',
                  padding: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <Lightbulb size={20} color="#f59e0b" style={{ marginRight: '8px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>When Knowledge Missing</h3>
                  </div>
                  <div style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: '6px',
                    padding: '12px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ color: theme.colors.primary }}>Agent:</strong> "How should I structure the payment provider integration?"
                    </div>
                    <div>
                      <strong style={{ color: '#f59e0b' }}>Principal:</strong> "I don't have notes about payment providers yet. 
                      After you figure this out, please save a note with: your approach, any gotchas you found, 
                      and patterns you established. This will help the next person!"
                    </div>
                  </div>
                </div>

                {/* Note Saving Format */}
                <div style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '8px',
                  padding: '20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <Save size={20} color={theme.colors.primary} style={{ marginRight: '8px' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Agent Saves Knowledge</h3>
                  </div>
                  <div style={{
                    backgroundColor: theme.colors.background,
                    borderRadius: '6px',
                    padding: '12px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}>
                    <div>
                      <strong style={{ color: theme.colors.primary }}>repository_note</strong>({'{'}<br />
                      &nbsp;&nbsp;note: "Use provider abstraction pattern",<br />
                      &nbsp;&nbsp;path: "/src/services/payment",<br />
                      &nbsp;&nbsp;tags: ["payment", "architecture"],<br />
                      &nbsp;&nbsp;type: "pattern",<br />
                      &nbsp;&nbsp;confidence: "high"<br />
                      {'}'})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Types of Tribal Knowledge */}
        <div style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          border: `1px solid ${theme.colors.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <Save size={24} color={theme.colors.primary} style={{ marginRight: '12px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
              Types of Tribal Knowledge
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {EXAMPLE_NOTES.map((note, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '8px',
                  padding: '16px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
                  {getTypeIcon(note.type)}
                  <div style={{ marginLeft: '12px', flex: 1 }}>
                    <div style={{
                      fontWeight: 600,
                      marginBottom: '6px',
                      textTransform: 'capitalize',
                    }}>
                      {note.type}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      lineHeight: 1.5,
                      marginBottom: '8px',
                    }}>
                      {note.content}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '12px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: theme.colors.background,
                            border: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      <span
                        style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: getConfidenceColor(note.confidence),
                          color: 'white',
                        }}
                      >
                        {note.confidence}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Setup Guide */}
        <div style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          border: `1px solid ${theme.colors.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <Settings size={24} color={theme.colors.primary} style={{ marginRight: '12px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
              Quick Setup Guide
            </h2>
          </div>

          {/* Progress bar */}
          <div style={{
            height: '4px',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '2px',
            marginBottom: '24px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${((activeStep + 1) / steps.length) * 100}%`,
              backgroundColor: theme.colors.primary,
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Steps */}
          <div>
            {steps.map((step, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '20px',
                  opacity: index === activeStep ? 1 : 0.5,
                  transition: 'opacity 0.3s ease',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: index <= activeStep ? theme.colors.primary : theme.colors.backgroundTertiary,
                    color: index <= activeStep ? 'white' : theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '14px',
                    marginRight: '12px',
                  }}>
                    {index < activeStep ? <Check size={16} /> : index + 1}
                  </div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    margin: 0,
                  }}>
                    {step.title}
                  </h3>
                </div>
                {index === activeStep && (
                  <div style={{
                    marginLeft: '40px',
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    lineHeight: 1.5,
                  }}>
                    {step.description}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Navigation buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '24px',
            marginLeft: '40px',
          }}>
            {activeStep > 0 && (
              <button
                onClick={handleBack}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  color: theme.colors.text,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.border;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                }}
              >
                Back
              </button>
            )}
            {activeStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Continue
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => window.alert('Configuration panel coming soon!')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Settings size={16} />
                Open Configuration
              </button>
            )}
          </div>
        </div>

        {/* Coming Soon - Interactive Mode */}
        <div style={{
          backgroundColor: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1))',
          backgroundImage: `linear-gradient(135deg, ${theme.colors.primary}15, #10b98115)`,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          border: `2px dashed ${theme.colors.primary}`,
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Sparkles size={24} color={theme.colors.primary} style={{ marginRight: '12px' }} />
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: 600, 
              margin: 0,
              background: `linear-gradient(135deg, ${theme.colors.primary}, #10b981)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Coming Soon: Interactive Mode
            </h2>
            <Sparkles size={24} color="#10b981" style={{ marginLeft: '12px' }} />
          </div>
          <p style={{ 
            fontSize: '16px', 
            lineHeight: 1.6,
            maxWidth: '800px',
            margin: '0 auto',
            color: theme.colors.text,
          }}>
            When the Principal doesn't have an answer, you'll be able to <strong>receive the question directly</strong> and 
            provide real-time guidance to your AI agents. Your answers automatically become tribal knowledge, 
            building a living documentation that grows smarter with every interaction.
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '32px',
            marginTop: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#f59e0b" />
              <span style={{ fontSize: '14px' }}>Agent asks question</span>
            </div>
            <ChevronRight size={20} color={theme.colors.textSecondary} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color={theme.colors.primary} />
              <span style={{ fontSize: '14px' }}>Routed to you</span>
            </div>
            <ChevronRight size={20} color={theme.colors.textSecondary} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} color="#10b981" />
              <span style={{ fontSize: '14px' }}>Saved as knowledge</span>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}>
          <div style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid ${theme.colors.border}`,
            textAlign: 'center',
          }}>
            <BookOpen size={40} color={theme.colors.primary} style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Continuous Learning
            </h3>
            <p style={{ fontSize: '14px', color: theme.colors.textSecondary, margin: 0 }}>
              Every note makes your AI agents smarter about your specific codebase and its unique patterns.
            </p>
          </div>

          <div style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid ${theme.colors.border}`,
            textAlign: 'center',
          }}>
            <Users size={40} color={theme.colors.primary} style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Team Knowledge Sharing
            </h3>
            <p style={{ fontSize: '14px', color: theme.colors.textSecondary, margin: 0 }}>
              Tribal knowledge is preserved and shared across your team, reducing onboarding time.
            </p>
          </div>

          <div style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid ${theme.colors.border}`,
            textAlign: 'center',
          }}>
            <Sparkles size={40} color={theme.colors.primary} style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Natural Connections
            </h3>
            <p style={{ fontSize: '14px', color: theme.colors.textSecondary, margin: 0 }}>
              No complex graphs - knowledge naturally connects through overlapping sets of paths and tags.
            </p>
          </div>
        </div>

        {/* Self-Managing Cleanup */}
        <div style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '40px',
          border: `1px solid ${theme.colors.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <Settings size={24} color={theme.colors.primary} style={{ marginRight: '12px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
              Self-Managing Knowledge Base
            </h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: theme.colors.text }}>
                🧹 Automatic Cleanup
              </h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: theme.colors.textSecondary, margin: 0 }}>
                When files are deleted or refactored, associated notes are automatically archived or flagged for review. 
                Your knowledge base stays relevant without manual maintenance.
              </p>
            </div>
            
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: theme.colors.text }}>
                📁 Path-Based Lifecycle
              </h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: theme.colors.textSecondary, margin: 0 }}>
                Notes are tied to file paths and directories. As your codebase evolves, outdated knowledge naturally 
                phases out while relevant patterns persist across refactors.
              </p>
            </div>
          </div>
          
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: theme.colors.backgroundTertiary,
            borderRadius: '8px',
            borderLeft: `4px solid ${theme.colors.primary}`,
          }}>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              <strong>No maintenance burden:</strong> Unlike traditional documentation that goes stale, the Principal's knowledge 
              base self-manages through your natural development workflow. Delete old code? The notes go with it. 
              Refactor a module? Notes get reviewed and updated. It's documentation that evolves with your code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};