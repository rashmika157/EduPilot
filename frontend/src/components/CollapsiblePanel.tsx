import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsiblePanelProps {
  storageKey: string;
  title: string | React.ReactNode;
  icon?: React.ReactNode;
  defaultCollapsed?: boolean;
  collapsedWidth?: string | number;
  expandedWidth?: string | number;
  className?: string;
  wrapperStyle?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  children?: React.ReactNode;
  onCollapseChange?: (collapsed: boolean) => void;
  actionButtons?: React.ReactNode;
}

export const getSessionValue = (key: string, defaultValue: boolean) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return defaultValue;
  const stored = window.sessionStorage.getItem(key);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return defaultValue;
};

export const useSessionPanelState = (key: string, defaultCollapsed: boolean) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => getSessionValue(key, defaultCollapsed));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(key, collapsed ? 'true' : 'false');
  }, [key, collapsed]);

  return [collapsed, setCollapsed] as const;
};

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  storageKey,
  title,
  icon,
  defaultCollapsed = false,
  collapsedWidth,
  expandedWidth,
  className,
  wrapperStyle,
  headerStyle,
  contentStyle,
  children,
  onCollapseChange,
  actionButtons
}) => {
  const [collapsed, setCollapsed] = useSessionPanelState(storageKey, defaultCollapsed);

  const widthStyle = useMemo<React.CSSProperties>(() => {
    if (collapsed && collapsedWidth !== undefined) return { width: collapsedWidth, minWidth: collapsedWidth };
    if (!collapsed && expandedWidth !== undefined) return { width: expandedWidth, minWidth: expandedWidth };
    return {};
  }, [collapsed, collapsedWidth, expandedWidth]);

  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...widthStyle,
    ...wrapperStyle
  };

  const contentStyles: React.CSSProperties = {
    maxHeight: collapsed ? '0px' : '2000px',
    opacity: collapsed ? 0 : 1,
    overflow: 'hidden',
    transition: 'max-height 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms ease, padding 250ms ease',
    ...contentStyle
  };

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      if (onCollapseChange) onCollapseChange(next);
      return next;
    });
  };

  return (
    <div className={className} style={panelStyle}>
      <div
        style={{
          padding: '16px 18px',
          borderBottom: collapsed ? 'none' : '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'border-bottom 250ms ease',
          ...headerStyle
        }}
        onClick={toggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
          {icon}
          {typeof title === 'string' ? (
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </span>
          ) : (
            title
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {actionButtons && !collapsed && (
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
              {actionButtons}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            aria-label={collapsed ? `Expand` : `Collapse`}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              flexShrink: 0
            }}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
      <div style={contentStyles}>{children}</div>
    </div>
  );
};

export default CollapsiblePanel;
