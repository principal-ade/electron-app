import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useTheme } from '@a24z/industry-theme';
import { RotateCcw } from 'lucide-react';

interface ColorPickerInputProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  onReset?: () => void;
  defaultValue?: string;
}

export const ColorPickerInput: React.FC<ColorPickerInputProps> = ({
  label,
  value,
  onChange,
  onReset,
  defaultValue,
}) => {
  const { theme } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync input value when value prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setInputValue(newColor);

    // Only propagate valid complete hex colors
    if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      onChange(newColor);
    }
  };

  const handlePickerChange = (newColor: string) => {
    setInputValue(newColor);
    onChange(newColor);
  };

  // Ensure we always have a valid color for the picker
  const pickerColor = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
        position: 'relative',
      }}
    >
      <div
        style={{
          flex: '0 0 140px',
          fontSize: '13px',
          color: theme.colors.textSecondary,
        }}
      >
        {label}
      </div>

      {/* Color preview/button */}
      <div
        onClick={() => setShowPicker(!showPicker)}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          border: `2px solid ${theme.colors.border}`,
          backgroundColor: pickerColor,
          cursor: 'pointer',
          transition: 'transform 0.15s',
          boxShadow: `0 2px 4px rgba(0, 0, 0, 0.2)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      />

      {/* Hex input */}
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="#000000"
        style={{
          flex: 1,
          padding: '8px 12px',
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontSize: '13px',
          fontFamily: 'monospace',
        }}
      />

      {/* Reset button */}
      {onReset && defaultValue && value !== defaultValue && (
        <button
          onClick={onReset}
          title="Reset to default"
          style={{
            padding: '8px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.background;
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <RotateCcw size={16} />
        </button>
      )}

      {/* Color picker popover */}
      {showPicker && (
        <div
          ref={pickerRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: '140px',
            marginTop: '8px',
            zIndex: 1000,
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            boxShadow: `0 8px 24px rgba(0, 0, 0, 0.4)`,
          }}
        >
          <HexColorPicker color={pickerColor} onChange={handlePickerChange} />
        </div>
      )}
    </div>
  );
};
