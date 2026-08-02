import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Text,
  Image,
  Modal,
} from 'react-native';
import { GameCharacter, FactionMembership } from '@models/types';
import {
  loadCharacters,
  updateCharacter,
  getFactionDescription,
  migrateFactionDescriptions,
  loadFactions,
  deleteFactionCompletely,
  type FactionRelationship,
} from '@utils/characterStorage';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  RouteProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import {
  BaseDetailScreen,
  Section,
  CollapsibleSection,
  ErrorBoundary,
} from '@/components';
import { Picker } from '@react-native-picker/picker';
import Markdown from 'react-native-markdown-display';
import { useLabels, useRuleset } from '@/ruleset';
import { getPrimaryFacetLabel } from '@/ruleset/facets';
import {
  findRelationshipCollectionForPair,
  findRelationshipEntry,
  isPositiveRelationship,
  isNegativeRelationship,
  relationshipLabel,
  resolveRelationshipColor,
  type RelationshipTypeEntry,
} from '@/ruleset/relationships';

type FactionDetailsRouteProp = RouteProp<RootStackParamList, 'FactionDetails'>;
type FactionDetailsNavigationProp = StackNavigationProp<RootStackParamList>;

interface FactionMemberInfo {
  character: GameCharacter;
  faction: FactionMembership;
}

export const FactionDetailsScreen: React.FC = () => {
  const route = useRoute<FactionDetailsRouteProp>();
  const navigation = useNavigation<FactionDetailsNavigationProp>();
  const label = useLabels();
  const { ruleset } = useRuleset();
  const { factionName } = route.params || {};

  const [members, setMembers] = useState<FactionMemberInfo[]>([]);
  const [nonMembers, setNonMembers] = useState<GameCharacter[]>([]);
  const [factionDescription, setFactionDescription] = useState<string>('');
  const [factionImageUris, setFactionImageUris] = useState<string[]>([]);
  const [factionRelationships, setFactionRelationships] = useState<
    FactionRelationship[]
  >([]);
  const [showStandingModal, setShowStandingModal] = useState(false);
  const [selectedMember, setSelectedMember] =
    useState<FactionMemberInfo | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const { colors: themeColors } = useTheme();

  const characterFactionStanding = useMemo(
    () => findRelationshipCollectionForPair(ruleset, ['character', 'faction']),
    [ruleset]
  );
  const factionFactionRelationship = useMemo(
    () => findRelationshipCollectionForPair(ruleset, ['faction', 'faction']),
    [ruleset]
  );
  const defaultRelationshipTypeId =
    characterFactionStanding?.defaultEntryId ??
    characterFactionStanding?.entries[0]?.id ??
    '';
  const [selectedStanding, setSelectedStanding] = useState<string>(
    defaultRelationshipTypeId
  );
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        statsGrid: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 20,
        },
        statCard: {
          ...commonStyles.card.base,
          alignItems: 'center',
          flex: 1,
          marginHorizontal: 4,
        },
        statValue: {
          fontSize: 24,
          fontWeight: '700',
          color: themeColors.text.primary,
          marginBottom: 4,
        },
        statLabel: {
          fontSize: 12,
          color: themeColors.text.muted,
          textAlign: 'center',
        },
        standingDistribution: {
          ...commonStyles.card.base,
        },
        sectionSubtitle: {
          ...commonStyles.text.h3,
          marginBottom: 12,
        },
        standingGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        standingCard: {
          padding: 12,
          borderRadius: 8,
          alignItems: 'center',
          minWidth: 70,
        },
        standingCardCount: {
          fontSize: 18,
          fontWeight: '700',
          marginBottom: 2,
        },
        standingCardLabel: {
          fontSize: 11,
          fontWeight: '600',
        },
        sectionDescription: {
          fontSize: 14,
          color: themeColors.text.secondary,
          marginBottom: 16,
          lineHeight: 20,
        },
        membersList: {
          // Remove maxHeight constraint since we're using ScrollView now
        },
        memberCard: {
          ...commonStyles.card.base,
          marginBottom: 12,
          overflow: 'hidden',
        },
        memberContainer: {
          padding: 16,
        },
        memberName: {
          fontSize: 16,
          fontWeight: '600',
          color: themeColors.text.primary,
          marginBottom: 12,
        },
        memberActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        removeIconButton: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: themeColors.accent.danger,
          alignItems: 'center',
          justifyContent: 'center',
        },
        removeIconText: {
          color: themeColors.text.primary,
          fontSize: 24,
          fontWeight: '700',
          lineHeight: 24,
        },
        addMemberForm: {
          ...commonStyles.card.base,
          padding: 16,
        },
        formLabel: {
          ...commonStyles.text.label,
          marginBottom: 8,
          marginTop: 12,
        },
        pickerContainer: {
          backgroundColor: themeColors.elevated,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: themeColors.border,
          overflow: 'hidden',
        },
        picker: {
          color: themeColors.text.primary,
          height: 50,
        },
        addButton: {
          ...commonStyles.button.primary,
          marginTop: 20,
          paddingVertical: 12,
        },
        addButtonDisabled: {
          opacity: 0.5,
          backgroundColor: themeColors.interactive.disabled,
        },
        addButtonText: {
          color: themeColors.text.primary,
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
        },
        noCharactersText: {
          fontSize: 14,
          color: themeColors.text.secondary,
          textAlign: 'center',
          padding: 20,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        },
        modalContent: {
          backgroundColor: themeColors.surface,
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        modalTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: themeColors.text.primary,
          marginBottom: 8,
          textAlign: 'center',
        },
        modalSubtitle: {
          fontSize: 16,
          color: themeColors.text.secondary,
          marginBottom: 24,
          textAlign: 'center',
        },
        modalButtons: {
          gap: 10,
          marginBottom: 20,
        },
        modalStandingButton: {
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: 'center',
        },
        modalStandingText: {
          fontSize: 16,
          fontWeight: '600',
        },
        modalCancelButton: {
          paddingVertical: 12,
          alignItems: 'center',
        },
        modalCancelText: {
          fontSize: 16,
          color: themeColors.text.secondary,
          fontWeight: '600',
        },
        standingBadge: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          alignItems: 'center',
        },
        standingText: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        standingTextLight: {
          color: themeColors.text.primary,
        },
        standingTextDark: {
          color: themeColors.text.primary,
        },
        // Faction Header Styles
        factionHeader: {
          ...commonStyles.card.base,
          padding: 20,
          marginBottom: 24,
        },
        factionName: {
          ...commonStyles.text.h1,
          textAlign: 'center',
          marginBottom: 16,
        },

        // Description Styles
        descriptionSection: {
          marginTop: 8,
        },
        descriptionLabel: {
          ...commonStyles.text.label,
          marginBottom: 12,
        },
        descriptionDisplay: {
          backgroundColor: themeColors.elevated,
          padding: 16,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: themeColors.border,
          minHeight: 80,
        },
        descriptionText: {
          fontSize: 14,
          color: themeColors.text.primary,
          lineHeight: 20,
        },

        // Image Gallery Styles
        imageGallerySection: {
          marginTop: 16,
          marginBottom: 16,
        },
        imageGalleryLabel: {
          ...commonStyles.text.label,
          marginBottom: 12,
        },
        imageGallery: {
          flexDirection: 'row',
        },
        factionImage: {
          width: 150,
          height: 150,
          borderRadius: 12,
          marginRight: 12,
          backgroundColor: themeColors.surface,
        },
        relationshipsContainer: {
          gap: 8,
        },
        relationshipCard: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 14,
          borderRadius: 10,
        },
        relationshipCardContent: {
          flex: 1,
        },
        relationshipCardName: {
          fontSize: 16,
          fontWeight: '600',
          color: themeColors.text.primary,
          marginBottom: 4,
        },
        relationshipCardType: {
          fontSize: 12,
          fontWeight: '500',
        },
        relationshipCardArrow: {
          fontSize: 20,
          fontWeight: '600',
          marginLeft: 12,
        },
      }),
    [commonStyles, themeColors]
  );

  const markdownStyles = useMemo(
    () => ({
      body: {
        color: themeColors.text.primary,
        fontSize: 14,
        lineHeight: 20,
      },
      heading1: {
        color: themeColors.text.primary,
        fontSize: 20,
        fontWeight: '700' as const,
        marginBottom: 8,
      },
      heading2: {
        color: themeColors.text.primary,
        fontSize: 18,
        fontWeight: '600' as const,
        marginBottom: 6,
      },
      heading3: {
        color: themeColors.text.primary,
        fontSize: 16,
        fontWeight: '600' as const,
        marginBottom: 4,
      },
      paragraph: {
        color: themeColors.text.primary,
        marginBottom: 10,
      },
      strong: {
        fontWeight: '700' as const,
      },
      em: {
        fontStyle: 'italic' as const,
      },
      link: {
        color: themeColors.accent.primary,
      },
      list_item: {
        color: themeColors.text.primary,
      },
      bullet_list: {
        marginBottom: 10,
      },
      ordered_list: {
        marginBottom: 10,
      },
      code_inline: {
        backgroundColor: themeColors.elevated,
        color: themeColors.accent.info,
        fontFamily: 'monospace' as const,
        padding: 2,
        borderRadius: 4,
      },
      code_block: {
        backgroundColor: themeColors.elevated,
        color: themeColors.text.primary,
        fontFamily: 'monospace' as const,
        padding: 10,
        borderRadius: 6,
        marginBottom: 10,
      },
    }),
    [themeColors]
  );

  // Guard against missing factionName param
  React.useEffect(() => {
    if (!factionName) {
      Alert.alert(
        'Error',
        `${label('faction.singular')} name is missing. Please try again.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [factionName, navigation]);

  const loadData = useCallback(async () => {
    // Run migration on first load (idempotent operation)
    await migrateFactionDescriptions();

    const characters = await loadCharacters();

    // Find faction members and non-members
    const factionMembers: FactionMemberInfo[] = [];
    const factionNonMembers: GameCharacter[] = [];

    characters.forEach(character => {
      const faction = character.factions.find(f => f.name === factionName);
      if (faction) {
        // Show all relationships, but distinguish members from contacts
        factionMembers.push({ character, faction });
      } else {
        factionNonMembers.push(character);
      }
    });

    setMembers(
      factionMembers.sort((a, b) =>
        a.character.name.localeCompare(b.character.name)
      )
    );
    setNonMembers(
      factionNonMembers.sort((a, b) => a.name.localeCompare(b.name))
    );

    // Get the faction description and images from centralized faction storage
    const description = await getFactionDescription(factionName);
    setFactionDescription(description);

    // Load faction images, relationships, and retired status
    const factions = await loadFactions();
    const faction = factions.find(f => f.name === factionName);
    if (faction) {
      setFactionImageUris(faction.imageUris || []);
      setFactionRelationships(faction.relationships || []);
    } else {
      setFactionImageUris([]);
      setFactionRelationships([]);
    }
  }, [factionName]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRemoveMember = async (character: GameCharacter) => {
    Alert.alert(
      'Remove Member',
      `Remove ${character.name} from ${factionName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedFactions = character.factions.filter(
                f => f.name !== factionName
              );
              const result = await updateCharacter(character.id, {
                factions: updatedFactions,
              });

              if (result) {
                // Update local state immediately to provide immediate feedback
                setMembers(prevMembers =>
                  prevMembers.filter(m => m.character.id !== character.id)
                );
                setNonMembers(prevNonMembers =>
                  [...prevNonMembers, result].sort((a, b) =>
                    a.name.localeCompare(b.name)
                  )
                );
              } else {
                throw new Error('Failed to update character');
              }
            } catch (error) {
              console.error('Error removing member from faction:', error);
              Alert.alert(
                'Error',
                'Failed to remove member from faction. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleAddMember = async (
    character: GameCharacter,
    relationshipTypeId: string
  ) => {
    const newFaction: FactionMembership = {
      name: factionName,
      relationshipTypeId,
      description: '', // Description is managed centrally now
    };

    const updatedFactions = [...character.factions, newFaction];
    const result = await updateCharacter(character.id, {
      factions: updatedFactions,
    });

    if (result) {
      // Update local state immediately
      setNonMembers(prevNonMembers =>
        prevNonMembers.filter(c => c.id !== character.id)
      );
      setMembers(prevMembers =>
        [...prevMembers, { character: result, faction: newFaction }].sort(
          (a, b) => a.character.name.localeCompare(b.character.name)
        )
      );
    }

    // Keep the add members section open for adding multiple members
    // setShowAddMember(false); // Removed to allow adding multiple members easily
  };

  const handleUpdateStanding = async (
    character: GameCharacter,
    newRelationshipTypeId: string
  ) => {
    try {
      const updatedFactions = character.factions.map(f =>
        f.name === factionName
          ? { ...f, relationshipTypeId: newRelationshipTypeId }
          : f
      );
      const result = await updateCharacter(character.id, {
        factions: updatedFactions,
      });

      if (result) {
        // Update local state immediately
        setMembers(prevMembers =>
          prevMembers.map(member =>
            member.character.id === character.id
              ? {
                  ...member,
                  faction: {
                    ...member.faction,
                    relationshipTypeId: newRelationshipTypeId,
                  },
                }
              : member
          )
        );
      }
    } catch (error) {
      console.error('Error updating standing:', error);
      Alert.alert(
        'Error',
        'Failed to update relationship standing. Please try again.'
      );
    }
  };

  const characterFactionEntry = (
    relationshipTypeId: string
  ): RelationshipTypeEntry | undefined =>
    findRelationshipEntry(characterFactionStanding, relationshipTypeId);

  const getStandingStyle = (entry: RelationshipTypeEntry | undefined) => ({
    backgroundColor: resolveRelationshipColor(entry, themeColors),
  });

  const getStandingTextStyle = (entry: RelationshipTypeEntry | undefined) =>
    entry?.role === 'neutral' || !entry
      ? styles.standingTextDark
      : styles.standingTextLight;

  const getStats = () => {
    // Only count positive relationships as actual members
    const actualMembers = members.filter(member =>
      isPositiveRelationship(
        characterFactionEntry(member.faction.relationshipTypeId)
      )
    );

    const totalMembers = actualMembers.length;
    const standingCounts: Record<string, number> = {};

    // Count all standings for display purposes (including neutral/negative)
    members.forEach(member => {
      standingCounts[member.faction.relationshipTypeId] =
        (standingCounts[member.faction.relationshipTypeId] || 0) + 1;
    });

    return { totalMembers, standingCounts };
  };

  const renderMember = ({ item }: { item: FactionMemberInfo }) => (
    <View style={styles.memberCard}>
      <TouchableOpacity
        style={styles.memberContainer}
        onPress={() =>
          navigation.navigate('CharacterDetail', { character: item.character })
        }
      >
        <Text style={styles.memberName}>{item.character.name}</Text>
        <View style={styles.memberActions}>
          <TouchableOpacity
            style={[
              styles.standingBadge,
              getStandingStyle(
                characterFactionEntry(item.faction.relationshipTypeId)
              ),
            ]}
            onPress={e => {
              e.stopPropagation();
              setSelectedMember(item);
              setShowStandingModal(true);
            }}
          >
            <Text
              style={[
                styles.standingText,
                getStandingTextStyle(
                  characterFactionEntry(item.faction.relationshipTypeId)
                ),
              ]}
            >
              {characterFactionEntry(item.faction.relationshipTypeId)
                ? relationshipLabel(
                    characterFactionEntry(item.faction.relationshipTypeId)!
                  )
                : item.faction.relationshipTypeId}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeIconButton}
            onPress={e => {
              e.stopPropagation();
              handleRemoveMember(item.character);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.removeIconText}>×</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );

  const handleAddMemberFromForm = async () => {
    if (!selectedCharacter) {
      Alert.alert('Error', 'Please select a character to add.');
      return;
    }

    const character = nonMembers.find(c => c.id === selectedCharacter);
    if (character) {
      await handleAddMember(character, selectedStanding);
      // Reset form
      setSelectedCharacter('');
      setSelectedStanding(defaultRelationshipTypeId);
    }
  };

  const stats = getStats();

  // Memoize positive and negative member lists
  const positiveMembers = useMemo(
    () =>
      members.filter(member =>
        isPositiveRelationship(
          characterFactionEntry(member.faction.relationshipTypeId)
        )
      ),
    [members, characterFactionStanding]
  );

  const negativeMembers = useMemo(
    () =>
      members.filter(member =>
        isNegativeRelationship(
          characterFactionEntry(member.faction.relationshipTypeId)
        )
      ),
    [members, characterFactionStanding]
  );

  return (
    <BaseDetailScreen
      onEditPress={() =>
        navigation.navigate('FactionForm', {
          factionName: factionName,
        })
      }
      deleteConfig={{
        itemName: `"${factionName}"`,
        onDelete: async () => {
          const result = await deleteFactionCompletely(factionName);
          if (result.success && result.charactersUpdated > 0) {
            Alert.alert(
              'Success',
              `Faction "${factionName}" deleted successfully. Removed from ${result.charactersUpdated} character(s).`
            );
          } else if (!result.success) {
            throw new Error('Failed to delete faction');
          }
        },
        confirmMessage: `Are you sure you want to delete "${factionName}"? This will remove it from all characters and cannot be undone.`,
      }}
    >
      {/* Faction Header */}
      <View style={styles.factionHeader}>
        <Text style={styles.factionName}>{factionName}</Text>

        {/* Faction Images */}
        {factionImageUris && factionImageUris.length > 0 && (
          <View style={styles.imageGallerySection}>
            <Text style={styles.imageGalleryLabel}>
              {label('faction.singular')} Images
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageGallery}
            >
              {factionImageUris.map((uri, index) => (
                <Image
                  key={index}
                  source={{ uri }}
                  style={styles.factionImage}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {factionDescription && (
          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionLabel}>Description</Text>
            <View style={styles.descriptionDisplay}>
              <ErrorBoundary
                fallback={
                  <Text style={styles.descriptionText}>
                    {factionDescription}
                  </Text>
                }
              >
                <Markdown style={markdownStyles}>{factionDescription}</Markdown>
              </ErrorBoundary>
            </View>
          </View>
        )}
      </View>

      {/* Faction Statistics */}
      <Section title="Statistics">
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalMembers}</Text>
            <Text style={styles.statLabel}>Active Members</Text>
          </View>
        </View>

        {/* Standing Distribution */}
        <View style={styles.standingDistribution}>
          <Text style={styles.sectionSubtitle}>Standing Distribution</Text>
          <View style={styles.standingGrid}>
            {Object.entries(stats.standingCounts).map(
              ([relationshipTypeId, count]) => {
                const entry = characterFactionEntry(relationshipTypeId);
                return (
                  <View
                    key={relationshipTypeId}
                    style={[styles.standingCard, getStandingStyle(entry)]}
                  >
                    <Text
                      style={[
                        styles.standingCardCount,
                        getStandingTextStyle(entry),
                      ]}
                    >
                      {count}
                    </Text>
                    <Text
                      style={[
                        styles.standingCardLabel,
                        getStandingTextStyle(entry),
                      ]}
                    >
                      {entry ? relationshipLabel(entry) : relationshipTypeId}
                    </Text>
                  </View>
                );
              }
            )}
          </View>
        </View>
      </Section>

      {/* Faction Relationships */}
      {factionRelationships.length > 0 && (
        <CollapsibleSection
          title={`${label('faction.singular')} Relationships`}
          defaultCollapsed={true}
        >
          <View style={styles.relationshipsContainer}>
            {factionRelationships.map((relationship, index) => {
              const entry = findRelationshipEntry(
                factionFactionRelationship,
                relationship.relationshipTypeId
              );
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.relationshipCard, getStandingStyle(entry)]}
                  onPress={() =>
                    navigation.navigate('FactionDetails', {
                      factionName: relationship.factionName,
                    })
                  }
                >
                  <View style={styles.relationshipCardContent}>
                    <Text style={styles.relationshipCardName}>
                      {relationship.factionName}
                    </Text>
                    <Text
                      style={[
                        styles.relationshipCardType,
                        getStandingTextStyle(entry),
                      ]}
                    >
                      {entry
                        ? relationshipLabel(entry, relationship.direction)
                        : relationship.relationshipTypeId}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.relationshipCardArrow,
                      getStandingTextStyle(entry),
                    ]}
                  >
                    →
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </CollapsibleSection>
      )}

      {/* Positive Relationships Section */}
      {positiveMembers.length > 0 && (
        <CollapsibleSection
          title={`Positive Relationships (${positiveMembers.length})`}
          defaultCollapsed={true}
        >
          <Text style={styles.sectionDescription}>
            Characters with a positive relationship to this{' '}
            {label('faction.singular').toLowerCase()}. These count as members in
            statistics.
          </Text>
          <View style={styles.membersList}>
            {positiveMembers.map(item => (
              <View key={item.character.id}>{renderMember({ item })}</View>
            ))}
          </View>
        </CollapsibleSection>
      )}

      {/* Negative Relationships Section */}
      {negativeMembers.length > 0 && (
        <CollapsibleSection
          title={`Negative Relationships (${negativeMembers.length})`}
          defaultCollapsed={true}
        >
          <Text style={styles.sectionDescription}>
            Characters with a negative relationship to this{' '}
            {label('faction.singular').toLowerCase()}. These do not count as
            members in statistics.
          </Text>
          <View style={styles.membersList}>
            {negativeMembers.map(item => (
              <View key={item.character.id}>{renderMember({ item })}</View>
            ))}
          </View>
        </CollapsibleSection>
      )}

      {/* Add Members Section */}
      <Section title="Add Members">
        {nonMembers.length > 0 ? (
          <View style={styles.addMemberForm}>
            <Text style={styles.formLabel}>
              Select {label('character.singular')}
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedCharacter}
                onValueChange={itemValue => setSelectedCharacter(itemValue)}
                style={styles.picker}
                dropdownIconColor={themeColors.text.primary}
              >
                <Picker.Item label="Choose a character..." value="" />
                {nonMembers.map(character => (
                  <Picker.Item
                    key={character.id}
                    label={`${character.name} (${getPrimaryFacetLabel(character, ruleset) ?? '—'})`}
                    value={character.id}
                  />
                ))}
              </Picker>
            </View>

            <Text style={styles.formLabel}>Select Standing</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedStanding}
                onValueChange={itemValue => setSelectedStanding(itemValue)}
                style={styles.picker}
                dropdownIconColor={themeColors.text.primary}
              >
                {(characterFactionStanding?.entries ?? []).map(entry => (
                  <Picker.Item
                    key={entry.id}
                    label={relationshipLabel(entry)}
                    value={entry.id}
                  />
                ))}
              </Picker>
            </View>

            <TouchableOpacity
              style={[
                styles.addButton,
                !selectedCharacter && styles.addButtonDisabled,
              ]}
              onPress={handleAddMemberFromForm}
              disabled={!selectedCharacter}
            >
              <Text style={styles.addButtonText}>Add Member</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.noCharactersText}>
            All characters are already members of this faction.
          </Text>
        )}
      </Section>

      {/* Standing Selection Modal */}
      <Modal
        visible={showStandingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStandingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Standing</Text>
            <Text style={styles.modalSubtitle}>
              {selectedMember?.character.name}
            </Text>

            <View style={styles.modalButtons}>
              {(characterFactionStanding?.entries ?? []).map(entry => (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.modalStandingButton, getStandingStyle(entry)]}
                  onPress={async () => {
                    if (selectedMember) {
                      await handleUpdateStanding(
                        selectedMember.character,
                        entry.id
                      );
                      setShowStandingModal(false);
                      setSelectedMember(null);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.modalStandingText,
                      getStandingTextStyle(entry),
                    ]}
                  >
                    {relationshipLabel(entry)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowStandingModal(false);
                setSelectedMember(null);
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </BaseDetailScreen>
  );
};
