import React from 'react';
import { Bot, Database, Brain } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import {
  getAgentInfo,
  type SupportedAgent,
} from '@principal-ai/agent-monitoring';
import { WindowService } from '../../../main-process-api/WindowService';

interface AgentConnectionVisualizerProps {
  agentType: SupportedAgent;
  isInstalled: boolean;
  hasHooks: boolean;
  hasMCP?: boolean;
  className?: string;
}

export const AgentConnectionVisualizer: React.FC<
  AgentConnectionVisualizerProps
> = ({ agentType, isInstalled, hasHooks, hasMCP = false, className = '' }) => {
  const { theme } = useTheme();
  const agentConfig = getAgentInfo(agentType);
  const [isHoveringPrincipalADE, setIsHoveringPrincipalADE] = React.useState(false);
  const [selectedComponent, setSelectedComponent] = React.useState<
    'agent' | 'principal-ade' | 'mcp' | null
  >(null);

  const AgentIcon = Bot;

  // Always show MCP server circle so users can click on it
  const showMCPServer = true;

  return (
    <div
      className={`relative ${className}`}
      style={{ height: '100%', width: '100%' }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 450 260"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* Agent Circle */}
        <g
          transform="translate(70, 160)"
          onClick={() => setSelectedComponent('agent')}
          style={{ cursor: 'pointer' }}
        >
          <circle
            cx="0"
            cy="0"
            r="40"
            fill={isInstalled ? agentConfig.ui.color : theme.colors.border}
            fillOpacity={isInstalled ? 0.2 : 0.1}
            stroke={isInstalled ? agentConfig.ui.color : theme.colors.border}
            strokeWidth="2"
            className="transition-all duration-500"
          />
          <foreignObject x="-20" y="-20" width="40" height="40">
            <div className="flex items-center justify-center w-full h-full">
              <AgentIcon
                size={24}
                className="transition-all duration-500"
                style={{
                  color: isInstalled
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                }}
              />
            </div>
          </foreignObject>
        </g>

        {/* Connection between Agent and Principal ADE */}
        {hasHooks && isInstalled && (
          <g>
            {/* Line from Agent to Principal ADE */}
            <line
              x1="103"
              y1="135"
              x2="185"
              y2="70"
              stroke={agentConfig.ui.color}
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.6"
            />

            {/* Flowing dots animation from Agent to Principal ADE */}
            {[0, 1, 2].map((index) => (
              <circle
                key={index}
                r="3"
                fill={agentConfig.ui.color}
                opacity="0.8"
              >
                <animateMotion
                  dur="3s"
                  repeatCount="indefinite"
                  begin={`${index * 1}s`}
                >
                  <mpath href="#agentToSpektorPath" />
                </animateMotion>
              </circle>
            ))}

            {/* Path for dots to follow from Agent to Principal ADE */}
            <path
              id="agentToSpektorPath"
              d="M 103 135 L 185 70"
              stroke="none"
              fill="none"
            />
          </g>
        )}

        {/* Principal ADE Circle (moved to top middle where MCP was) */}
        <g
          transform="translate(225, 60)"
          onMouseEnter={() => setIsHoveringPrincipalADE(true)}
          onMouseLeave={() => setIsHoveringPrincipalADE(false)}
          onClick={() => setSelectedComponent('principal-ade')}
          style={{ cursor: 'pointer' }}
        >
          <circle
            cx="0"
            cy="0"
            r="40"
            fill={
              isHoveringPrincipalADE && hasHooks && isInstalled
                ? `${theme.colors.primary}20`
                : theme.colors.backgroundSecondary
            }
            stroke={
              hasHooks && isInstalled
                ? theme.colors.primary
                : theme.colors.border
            }
            strokeWidth={
              isHoveringPrincipalADE && hasHooks && isInstalled ? '3' : '2'
            }
            style={{ transition: 'all 0.2s' }}
          />
          <foreignObject
            x="-30"
            y="-28"
            width="60"
            height="50"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="flex flex-col items-center justify-center w-full h-full"
              style={{ paddingTop: '4px' }}
            >
              <Database
                size={isHoveringPrincipalADE && hasHooks && isInstalled ? 22 : 20}
                className="transition-all duration-200"
                style={{
                  color:
                    hasHooks && isInstalled
                      ? theme.colors.primary
                      : theme.colors.textSecondary,
                  transform:
                    isHoveringPrincipalADE && hasHooks && isInstalled
                      ? 'translateY(-1px)'
                      : 'translateY(0)',
                }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  marginTop: '2px',
                  color:
                    hasHooks && isInstalled
                      ? theme.colors.primary
                      : theme.colors.textSecondary,
                  fontWeight:
                    isHoveringPrincipalADE && hasHooks && isInstalled ? 600 : 500,
                }}
              >
                Principal ADE
              </span>
            </div>
          </foreignObject>

          {/* Pulse effect when receiving */}
          {hasHooks && isInstalled && (
            <circle
              cx="0"
              cy="0"
              r="45"
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth="1"
              opacity="0"
            >
              <animate
                attributeName="r"
                from="45"
                to="60"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                from="0.6"
                to="0"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </g>

        {/* Connection between Agent and MCP - drawn first so it appears behind circles */}
        {showMCPServer && hasMCP && (
          <g>
            {/* Line from Agent to MCP (top line) */}
            <line
              x1="110"
              y1="155"
              x2="340"
              y2="155"
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.6"
            />

            {/* Line from MCP to Agent (bottom line) */}
            <line
              x1="340"
              y1="165"
              x2="110"
              y2="165"
              stroke={theme.colors.primary}
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.6"
            />

            {/* Flowing dots from Agent to MCP */}
            {[0, 1, 2].map((index) => (
              <circle
                key={`agent-to-mcp-${index}`}
                r="3"
                fill="#ef4444"
                opacity="0.8"
              >
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  begin={`${index * 1.3}s`}
                >
                  <mpath href="#agentToMcpPath" />
                </animateMotion>
              </circle>
            ))}

            {/* Flowing dots from MCP to Agent */}
            {[0, 1, 2].map((index) => (
              <circle
                key={`mcp-to-agent-${index}`}
                r="3"
                fill={theme.colors.primary}
                opacity="0.8"
              >
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  begin={`${index * 1.3 + 0.65}s`}
                >
                  <mpath href="#mcpToAgentPath" />
                </animateMotion>
              </circle>
            ))}

            {/* Path for dots to follow from Agent to MCP */}
            <path
              id="agentToMcpPath"
              d="M 110 155 L 340 155"
              stroke="none"
              fill="none"
            />

            {/* Path for dots to follow from MCP to Agent */}
            <path
              id="mcpToAgentPath"
              d="M 340 165 L 110 165"
              stroke="none"
              fill="none"
            />
          </g>
        )}

        {/* MCP Server Circle (moved to right where Principal ADE was) - shown when hooks are configured */}
        {showMCPServer && (
          <g
            transform="translate(380, 160)"
            onClick={() => setSelectedComponent('mcp')}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx="0"
              cy="0"
              r="40"
              fill={theme.colors.backgroundSecondary}
              fillOpacity={hasMCP ? 0.8 : 0.5}
              stroke={theme.colors.border}
              strokeWidth="2"
              strokeDasharray={hasMCP ? '0' : '5,5'}
              className="transition-all duration-500"
            />
            <foreignObject x="-30" y="-22" width="60" height="50">
              <div className="flex flex-col items-center justify-center w-full h-full">
                <Brain
                  size={18}
                  style={{
                    color: theme.colors.textSecondary,
                    marginBottom: '2px',
                  }}
                />
                <div className="text-center">
                  <div
                    className="text-xs font-medium"
                    style={{
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Principal
                  </div>
                  <div
                    className="text-[10px] font-medium"
                    style={{
                      color: theme.colors.textSecondary,
                    }}
                  >
                    MCP
                  </div>
                </div>
              </div>
            </foreignObject>
          </g>
        )}

        {/* Status Labels */}
        <g transform="translate(225, 215)">
          {!selectedComponent && (
            <text
              textAnchor="middle"
              className="text-xs italic"
              style={{ fill: theme.colors.textSecondary }}
            >
              Click on a component to learn more
            </text>
          )}

          {selectedComponent === 'agent' && (
            <>
              <text
                textAnchor="middle"
                className="text-xs font-semibold"
                y="-5"
                style={{ fill: theme.colors.text }}
              >
                Agent
              </text>
              <text
                textAnchor="middle"
                className="text-xs"
                y="10"
                style={{ fill: theme.colors.textSecondary }}
              >
                The {agentConfig.name} agent that processes and responds to your
                requests
              </text>
            </>
          )}

          {selectedComponent === 'principal-ade' && (
            <>
              <text
                textAnchor="middle"
                className="text-xs font-semibold"
                y="-5"
                style={{ fill: theme.colors.text }}
              >
                Principal ADE
              </text>
              <text
                textAnchor="middle"
                className="text-xs"
                y="10"
                style={{ fill: theme.colors.textSecondary }}
              >
                Event monitoring and debugging tool
              </text>
              {hasHooks && isInstalled && (
                <foreignObject x="-50" y="20" width="100" height="35">
                  <button
                    className="px-3 py-1 text-xs rounded"
                    style={{
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background,
                    }}
                    onClick={async () => {
                      try {
                        await WindowService.openStoreViewer({
                          agent: agentType,
                          namespace: 'events',
                        });
                      } catch (error) {
                        console.error('Failed to open store viewer:', error);
                      }
                    }}
                  >
                    Open Store Viewer
                  </button>
                </foreignObject>
              )}
            </>
          )}

          {selectedComponent === 'mcp' && (
            <>
              <text
                textAnchor="middle"
                className="text-xs font-semibold"
                y="-5"
                style={{ fill: theme.colors.text }}
              >
                Principle MCP
              </text>
              <text
                textAnchor="middle"
                className="text-xs"
                y="10"
                style={{ fill: theme.colors.textSecondary }}
              >
                Model Context Protocol server for custom tools
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
};
