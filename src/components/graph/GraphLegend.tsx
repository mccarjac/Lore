import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/styles/theme';
import type { GraphNodeType } from '@utils/relationshipGraph';
import type { RelationshipRole } from '@/ruleset/relationships';
import { nodeTypeColor, nodeTypeLabel, standingEdgeColor } from './graphColors';

const NODE_TYPES: GraphNodeType[] = ['character', 'faction', 'location'];

// The generalized form of the old fixed five-value standing list: a ruleset
// declares its own relationship-type vocabulary and labels
// (`RelationshipTypeEntry.label`), but every one of those entries carries a
// `role` from this same closed three-value set, so the legend key stays
// role-based rather than trying to enumerate a ruleset's entries with no
// graph data to know which are actually in use.
const ROLES: { role: RelationshipRole; label: string }[] = [
  { role: 'positive', label: 'Positive' },
  { role: 'neutral', label: 'Neutral' },
  { role: 'negative', label: 'Negative' },
];

export const GraphLegend: React.FC = () => {
  return (
    <View style={styles.container} accessibilityLabel="Graph legend">
      <View style={styles.row}>
        {NODE_TYPES.map(type => (
          <View key={type} style={styles.item}>
            <View
              style={[styles.dot, { backgroundColor: nodeTypeColor(type) }]}
            />
            <Text style={styles.label}>{nodeTypeLabel(type)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        {ROLES.map(({ role, label }) => (
          <View key={role} style={styles.item}>
            <View
              style={[
                styles.line,
                { backgroundColor: standingEdgeColor(role) },
              ]}
            />
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
  },
  line: {
    width: 14,
    height: 3,
    borderRadius: borderRadius.sm,
  },
  label: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
});
