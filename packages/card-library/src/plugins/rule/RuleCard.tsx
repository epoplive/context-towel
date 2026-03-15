import { memo } from 'react'
import {
  Shield, Code, Building, Type, TestTube, Lock, Zap, FileText, TrendingUp, Hash,
} from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { RuleData } from './types'
import { ruleTypeColors } from './types'

/** Rule card — renders a rule block at different detail levels */
export const RuleCard = memo(function RuleCard({
  data,
  detail,
  theme,
}: BlockRenderProps<RuleData>) {
  const ruleType = data.ruleType || 'coding_pattern'
  const ruleColor = ruleTypeColors[ruleType] || ruleTypeColors.coding_pattern
  const RuleIcon = getRuleIcon(ruleType)
  const priority = data.priority ?? 5

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${ruleColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <RuleIcon size={10} color={ruleColor} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '0.95em',
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {data.name}
        </span>
        <PriorityBadge priority={priority} />
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        borderLeft: `3px solid ${ruleColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <RuleIcon size={10} color={ruleColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '0.95em',
            color: theme.textPrimary,
            fontWeight: 600,
            flex: 1,
          }}>
            {data.name}
          </span>
          <TypeBadge type={ruleType} color={ruleColor} />
          <PriorityBadge priority={priority} />
        </div>

        {/* Auto-apply indicator */}
        {data.autoApply && (
          <div style={{
            fontSize: '0.75em',
            fontWeight: 700,
            color: theme.success,
            marginBottom: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}>
            <span style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: theme.success,
              display: 'inline-block',
            }} />
            AUTO-APPLY
          </div>
        )}

        {/* Description preview */}
        {data.description && (
          <div style={{
            fontSize: '0.85em',
            color: theme.textSecondary,
            lineHeight: 1.4,
          }}>
            {data.description}
          </div>
        )}
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      borderLeft: `3px solid ${ruleColor}`,
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <RuleIcon size={12} color={ruleColor} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '1em',
          color: theme.textPrimary,
          fontWeight: 600,
          flex: 1,
        }}>
          {data.name}
        </span>
        <TypeBadge type={ruleType} color={ruleColor} />
        <PriorityBadge priority={priority} />
      </div>

      {/* Auto-apply + confidence */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
        {data.autoApply && (
          <div style={{
            fontSize: '0.75em',
            fontWeight: 700,
            color: theme.success,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}>
            <span style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: theme.success,
              display: 'inline-block',
            }} />
            AUTO-APPLY
          </div>
        )}
        {data.confidenceThreshold !== undefined && (
          <span style={{ fontSize: '0.8em', color: theme.textMuted }}>
            Confidence: {(data.confidenceThreshold * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Description */}
      {data.description && (
        <div style={{
          fontSize: '0.9em',
          color: theme.textSecondary,
          marginBottom: 6,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}>
          {data.description}
        </div>
      )}

      {/* Guidance Text */}
      {data.guidanceText && (
        <div style={{
          fontSize: '0.85em',
          color: theme.textSecondary,
          padding: '4px 6px',
          borderLeft: `2px solid ${theme.borderPrimary}`,
          marginBottom: 6,
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          fontStyle: 'italic',
        }}>
          {data.guidanceText}
        </div>
      )}

      {/* Trigger Patterns */}
      {data.triggerPatterns && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: '0.8em', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            Trigger Patterns
          </div>
          {data.triggerPatterns.files && data.triggerPatterns.files.length > 0 && (
            <div style={{ marginBottom: 3 }}>
              <span style={{ fontSize: '0.8em', color: theme.textMuted }}>Files: </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                {data.triggerPatterns.files.map((pattern, i) => (
                  <code key={i} style={{
                    fontSize: '0.8em',
                    padding: '1px 4px',
                    borderRadius: 2,
                    background: theme.bgTertiary,
                    color: theme.textPrimary,
                    fontFamily: theme.fontMono,
                  }}>
                    {pattern}
                  </code>
                ))}
              </div>
            </div>
          )}
          {data.triggerPatterns.components && data.triggerPatterns.components.length > 0 && (
            <div style={{ marginBottom: 3 }}>
              <span style={{ fontSize: '0.8em', color: theme.textMuted }}>Components: </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                {data.triggerPatterns.components.map((pattern, i) => (
                  <code key={i} style={{
                    fontSize: '0.8em',
                    padding: '1px 4px',
                    borderRadius: 2,
                    background: theme.bgTertiary,
                    color: theme.textPrimary,
                    fontFamily: theme.fontMono,
                  }}>
                    {pattern}
                  </code>
                ))}
              </div>
            </div>
          )}
          {data.triggerPatterns.relationships && data.triggerPatterns.relationships.length > 0 && (
            <div>
              <span style={{ fontSize: '0.8em', color: theme.textMuted }}>Relationships: </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                {data.triggerPatterns.relationships.map((pattern, i) => (
                  <code key={i} style={{
                    fontSize: '0.8em',
                    padding: '1px 4px',
                    borderRadius: 2,
                    background: theme.bgTertiary,
                    color: theme.textPrimary,
                    fontFamily: theme.fontMono,
                  }}>
                    {pattern}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Semantic Triggers */}
      {data.semanticTriggers && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: '0.8em', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            Semantic Triggers
          </div>
          {data.semanticTriggers.patterns && data.semanticTriggers.patterns.length > 0 && (
            <div style={{ marginBottom: 3 }}>
              <span style={{ fontSize: '0.8em', color: theme.textMuted }}>Patterns: </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                {data.semanticTriggers.patterns.map((pattern, i) => (
                  <span key={i} style={{
                    fontSize: '0.8em',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: `${theme.accent}22`,
                    color: theme.accent,
                  }}>
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.semanticTriggers.businessDomains && data.semanticTriggers.businessDomains.length > 0 && (
            <div style={{ marginBottom: 3 }}>
              <span style={{ fontSize: '0.8em', color: theme.textMuted }}>Domains: </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                {data.semanticTriggers.businessDomains.map((domain, i) => (
                  <span key={i} style={{
                    fontSize: '0.8em',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: `${theme.accent}22`,
                    color: theme.accent,
                  }}>
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.semanticTriggers.architecturalLayers && data.semanticTriggers.architecturalLayers.length > 0 && (
            <div>
              <span style={{ fontSize: '0.8em', color: theme.textMuted }}>Layers: </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                {data.semanticTriggers.architecturalLayers.map((layer, i) => (
                  <span key={i} style={{
                    fontSize: '0.8em',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: `${theme.accent}22`,
                    color: theme.accent,
                  }}>
                    {layer}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Code Template */}
      {data.codeTemplate && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: '0.8em', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 }}>
            Code Template
          </div>
          <pre style={{
            fontSize: '0.8em',
            padding: '4px 6px',
            borderRadius: 3,
            background: theme.bgTertiary,
            color: theme.textPrimary,
            fontFamily: theme.fontMono,
            overflow: 'auto',
            margin: 0,
            lineHeight: 1.4,
          }}>
            {data.codeTemplate}
          </pre>
        </div>
      )}

      {/* Usage Analytics */}
      {(data.usageCount !== undefined || data.effectivenessScore !== undefined || data.lastApplied) && (
        <div style={{ marginBottom: 6 }}>
          <div style={{
            fontSize: '0.8em',
            color: theme.textMuted,
            textTransform: 'uppercase',
            marginBottom: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <TrendingUp size={8} />
            Analytics
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: '0.8em', color: theme.textSecondary }}>
            {data.usageCount !== undefined && (
              <span>Used: {data.usageCount}x</span>
            )}
            {data.effectivenessScore !== undefined && (
              <span>Effectiveness: {(data.effectivenessScore * 100).toFixed(0)}%</span>
            )}
            {data.lastApplied && (
              <span>Last: {data.lastApplied}</span>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <Hash size={8} color={theme.textMuted} style={{ flexShrink: 0 }} />
          {data.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: '0.8em',
              padding: '1px 5px',
              borderRadius: 3,
              background: `${theme.accent}22`,
              color: theme.accent,
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

// --- Subcomponents ---

function TypeBadge({ type, color }: { type: string; color: string }) {
  return (
    <span style={{
      fontSize: '0.75em',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '1px 5px',
      borderRadius: 3,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {type.replace('_', ' ')}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: number }) {
  const color = getPriorityColor(priority)
  return (
    <span style={{
      fontSize: '0.75em',
      fontWeight: 700,
      padding: '1px 5px',
      borderRadius: 3,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap',
    }}>
      P{priority}
    </span>
  )
}

function getPriorityColor(priority: number): string {
  if (priority >= 8) return '#ef4444'  // critical
  if (priority >= 5) return '#f97316'  // high
  if (priority >= 3) return '#eab308'  // medium
  return '#6b7280'  // low
}

function getRuleIcon(ruleType: string) {
  switch (ruleType) {
    case 'coding_pattern': return Code
    case 'architectural': return Building
    case 'naming': return Type
    case 'testing': return TestTube
    case 'security': return Lock
    case 'performance': return Zap
    case 'documentation': return FileText
    default: return Shield
  }
}
