import type { GraphNodeType } from '@utils/relationshipGraph';
import { roleColor, type RelationshipRole } from '@/ruleset/relationships';
import { colors } from '@/styles/theme';

/**
 * Edge color by relationship role — the generalized form of the old
 * per-`RelationshipStanding`-value switch. A `GraphEdge` only carries a
 * resolved `role`, not the full ruleset entry, so this defers to
 * `roleColor` rather than `resolveRelationshipColor` (which also honors a
 * per-entry color override, not available at this layer).
 */
export const standingEdgeColor = (role: RelationshipRole): string =>
  roleColor(role, colors);

export const nodeTypeColor = (type: GraphNodeType): string => {
  switch (type) {
    case 'character':
      return colors.accent.primary;
    case 'faction':
      return colors.accent.secondary;
    case 'location':
      return colors.accent.info;
    default:
      return colors.accent.primary;
  }
};

export const nodeTypeLabel = (type: GraphNodeType): string => {
  switch (type) {
    case 'character':
      return 'Character';
    case 'faction':
      return 'Faction';
    case 'location':
      return 'Location';
    default:
      return type;
  }
};
