import React, { useState, useEffect, useRef } from 'react';
import type {
  PanelComponentProps,
  AgentPanelActions,
  SkillsPanelContext,
} from './types';
import { useSkillsData } from './skills/hooks/useSkillsData';
import type { Skill } from './skills/hooks/useSkillsData';
import { SkillMarkdown, type SkillMarkdownProps } from './skills/components/SkillMarkdown';
import type { PartialParsedSkill, ValidationWarning } from '@principal-ade/markdown-utils';
import { useTheme } from '@principal-ade/industry-theme';
import { usePanelFocusListener } from '@principal-ade/panel-layouts';
import './SkillDetailPanel.css';

export interface SkillDetailPanelProps extends PanelComponentProps<AgentPanelActions, SkillsPanelContext> {
  /**
   * Optional skill ID to display.
   * If provided, this takes precedence over event-based selection.
   * This allows the host to control panel state via props instead of events.
   */
  selectedSkillId?: string | null;
  /**
   * Optional skill object to display.
   * If provided, bypasses useSkillsData loading for instant display.
   * This provides better performance when the skill data is already available.
   */
  skill?: Skill | null;
  /**
   * Install button configuration to pass through to SkillMarkdown
   */
  installConfig?: SkillMarkdownProps['installConfig'];
  /**
   * Hide the Edit and MDX Editor buttons (default: false)
   */
  hideEditButtons?: boolean;
}

export const SkillDetailPanel: React.FC<SkillDetailPanelProps> = ({
  context,
  events,
  actions,
  selectedSkillId: selectedSkillIdProp,
  skill: skillProp,
  installConfig,
  hideEditButtons = false,
}) => {
  const { theme } = useTheme();
  const { skills, isLoading, error } = useSkillsData({ context });
  const [selectedSkillIdState, setSelectedSkillIdState] = useState<string | null>(null);
  const [skillState, setSkillState] = useState<Skill | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Determine the effective selected skill ID (prop takes precedence over state)
  const selectedSkillId = selectedSkillIdProp !== undefined ? selectedSkillIdProp : selectedSkillIdState;

  // Use skill from prop if provided, otherwise use state
  const skill = skillProp !== undefined ? skillProp : skillState;

  // Listen for panel focus events
  usePanelFocusListener(
    'skill-detail',
    events,
    () => panelRef.current?.focus()
  );

  // Listen for skill selection events (only if not controlled by prop)
  useEffect(() => {
    // If controlled by prop, don't listen to events
    if (selectedSkillIdProp !== undefined) {
      return;
    }

    const unsubscribe = events.on('skill:selected', (event) => {
      const payload = event.payload as { skillId?: string } | undefined;
      const skillId = payload?.skillId;
      if (skillId) {
        setSelectedSkillIdState(skillId);
      }
    });

    return unsubscribe;
  }, [events, selectedSkillIdProp]);

  // Update selected skill when skills load or selection changes
  // Only runs when skill is NOT provided via prop
  useEffect(() => {
    // If skill is provided via prop, don't override it
    if (skillProp !== undefined) {
      return;
    }

    if (selectedSkillId && skills.length > 0) {
      const foundSkill = skills.find((s) => s.id === selectedSkillId);
      setSkillState(foundSkill || null);
    } else if (!selectedSkillId) {
      setSkillState(null);
    }
  }, [selectedSkillId, skills, skillProp]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '2rem',
          backgroundColor: theme.colors.background,
          color: theme.colors.error,
          fontFamily: theme.fonts.body,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          Error loading skills: {error}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
        }}
      >
        Loading skills...
      </div>
    );
  }

  if (!skill) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '2rem',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
          fontFamily: theme.fonts.body,
          textAlign: 'center',
        }}
      >

        <h2
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes[4],
            fontFamily: theme.fonts.heading,
            fontWeight: theme.fontWeights.heading,
            marginBottom: '0.5rem',
          }}
        >
          No Skill Selected
        </h2>
        <p>Select a skill from the list to view its details</p>
      </div>
    );
  }

  const handleParsed = (parsedSkill: PartialParsedSkill) => {
    if (parsedSkill.warnings.length > 0) {
      console.warn('Skill has warnings:', parsedSkill.warnings);
    }
  };

  const handleWarnings = (warnings: ValidationWarning[]) => {
    console.warn('Skill validation warnings:', warnings);
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      style={{
        height: '100%',
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
      }}
    >
      {skill.content ? (
        <>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <SkillMarkdown
              content={skill.content}
              theme={theme}
              onParsed={handleParsed}
              onWarnings={handleWarnings}
              structure={{
                hasScripts: skill.hasScripts,
                hasReferences: skill.hasReferences,
                hasAssets: skill.hasAssets,
                scriptFiles: skill.scriptFiles,
                referenceFiles: skill.referenceFiles,
                assetFiles: skill.assetFiles,
              }}
              skill={skill}
              actions={actions}
              events={events}
              installConfig={installConfig}
              hideEditButtons={hideEditButtons}
            />
          </div>
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.body,
          }}
        >
          <p>No content available for this skill</p>
        </div>
      )}
    </div>
  );
};
