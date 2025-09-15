import React from 'react';
import { useTheme } from 'themed-markdown';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { FileCollision } from '../../utils/sessionCollisionDetector';

interface AgentSessionCollisionIndicatorProps {
  collisions: FileCollision[];
  sessionNames?: Map<string, string>; // sessionId -> name mapping
  onFileClick?: (filePath: string) => void;
}

export const AgentSessionCollisionIndicator: React.FC<AgentSessionCollisionIndicatorProps> = ({
  collisions,
  sessionNames = new Map(),
  onFileClick
}) => {
  const { theme } = useTheme();
  
  if (collisions.length === 0) {
    return null;
  }
  
  // Group collisions by severity
  const highSeverity = collisions.filter(c => c.severity === 'high');
  const mediumSeverity = collisions.filter(c => c.severity === 'medium');
  const lowSeverity = collisions.filter(c => c.severity === 'low');
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#ef4444'; // Red
      case 'medium': return '#f59e0b'; // Amber
      case 'low': return '#3b82f6'; // Blue
      default: return theme.colors.textSecondary;
    }
  };
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle size={14} />;
      case 'medium': return <AlertCircle size={14} />;
      case 'low': return <Info size={14} />;
      default: return null;
    }
  };
  
  const formatPath = (path: string) => {
    const parts = path.split('/');
    return parts.length > 3 ? `.../${parts.slice(-2).join('/')}` : path;
  };
  
  const renderCollisionGroup = (
    title: string,
    items: FileCollision[],
    severity: 'high' | 'medium' | 'low'
  ) => {
    if (items.length === 0) return null;
    
    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '6px',
          color: getSeverityColor(severity),
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {getSeverityIcon(severity)}
          <span>{title} ({items.length})</span>
        </div>
        
        <div style={{
          maxHeight: '120px',
          overflowY: 'auto',
          paddingLeft: '20px',
        }}>
          {items.slice(0, 5).map((collision, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '4px',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            >
              <div
                style={{
                  color: theme.colors.text,
                  cursor: onFileClick ? 'pointer' : 'default',
                  textDecoration: onFileClick ? 'underline' : 'none',
                }}
                onClick={() => onFileClick?.(collision.path)}
              >
                {formatPath(collision.path)}
              </div>
              <div style={{
                color: theme.colors.textSecondary,
                fontSize: '10px',
                marginTop: '2px',
              }}>
                {collision.sessions.map(s => {
                  const name = sessionNames.get(s.sessionId) || s.sessionId.substring(0, 8);
                  const ops = Array.from(s.operations).join('+');
                  return `${name}(${ops})`;
                }).join(' ↔ ')}
              </div>
            </div>
          ))}
          {items.length > 5 && (
            <div style={{
              fontSize: '10px',
              color: theme.colors.textSecondary,
              fontStyle: 'italic',
            }}>
              ...and {items.length - 5} more
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div style={{
      padding: '12px',
      backgroundColor: theme.colors.backgroundSecondary,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '6px',
      marginBottom: '12px',
    }}>
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: theme.colors.text,
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <AlertTriangle size={16} color="#f59e0b" />
        File Collisions Detected
      </div>
      
      <div style={{
        fontSize: '11px',
        color: theme.colors.textSecondary,
        marginBottom: '12px',
      }}>
        {collisions.length} file{collisions.length !== 1 ? 's' : ''} accessed by multiple sessions
      </div>
      
      {renderCollisionGroup('Critical - Write Conflicts', highSeverity, 'high')}
      {renderCollisionGroup('Warning - Mixed Access', mediumSeverity, 'medium')}
      {renderCollisionGroup('Info - Read Overlaps', lowSeverity, 'low')}
    </div>
  );
};