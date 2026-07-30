import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Button,
  Alert,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import {
  RouteProp,
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';
import {
  CharacterFormData,
  GameCharacter,
  GameLocation,
  Relationship,
  RelationshipStanding,
  Modification,
} from '@models/types';
import {
  addCharacter,
  updateCharacter,
  loadCharacters,
  saveCharacters,
  loadFactions,
  loadLocations,
} from '@utils/characterStorage';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import { BaseFormScreen } from '@/components';
import { useLabels, useRuleset, useFeature } from '@/ruleset';
import { roleOf, type AttributeDefinition } from '@/ruleset/attributes';

/**
 * A modification's numeric deltas are a flat attribute-id -> delta map since
 * #22 (a cap is simply another attribute), so these keep the per-input update
 * readable — the editor loops over the ruleset's attribute definitions and
 * calls these per input.
 */
const setAttributeDelta = (
  modification: Modification,
  attributeId: string,
  numValue: number | undefined
): Modification => {
  const existing = modification.modifier ?? {};
  const deltas = { ...(existing.attributeDeltas ?? {}) };

  if (numValue === undefined) {
    delete deltas[attributeId];
  } else {
    deltas[attributeId] = numValue;
  }

  return {
    ...modification,
    modifier: {
      ...existing,
      attributeDeltas: Object.keys(deltas).length > 0 ? deltas : undefined,
    },
  };
};

const setCategoryModifiers = (
  modification: Modification,
  categoryDeltas: Record<string, number>
): Modification => ({
  ...modification,
  modifier: {
    ...(modification.modifier ?? {}),
    categoryDeltas:
      Object.keys(categoryDeltas).length > 0 ? categoryDeltas : undefined,
  },
});

/**
 * Numeric modification inputs are laid out two per row. `derived.ts` applies a
 * modification's deltas to `resource` and `cap` attributes only, so those are
 * exactly the ones worth an input — a capability flag would get a meaningless
 * numeric field.
 */
const modifiableAttributeRows = (
  attributes: AttributeDefinition[]
): AttributeDefinition[][] => {
  const modifiable = attributes.filter(
    attribute => roleOf(attribute) === 'resource' || roleOf(attribute) === 'cap'
  );

  const rows: AttributeDefinition[][] = [];
  for (let index = 0; index < modifiable.length; index += 2) {
    rows.push(modifiable.slice(index, index + 2));
  }
  return rows;
};

type CharacterFormRouteProp = RouteProp<RootStackParamList, 'CharacterForm'>;

export const CharacterFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CharacterFormRouteProp>();
  const label = useLabels();
  const { ruleset } = useRuleset();
  const maxQualities = ruleset.limits?.maxQualities ?? 3;
  const editingCharacter = route.params?.character;
  const modificationsEnabled = useFeature('modifications');
  const attributeRows = modifiableAttributeRows(ruleset.attributes);
  const archetypeLabel = (id: string): string =>
    ruleset.archetypes.find(archetype => archetype.id === id)?.label ?? id;
  const categoryLabel = (id: string): string =>
    ruleset.traitCategories.find(category => category.id === id)?.label ?? id;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [allCharacters, setAllCharacters] = useState<GameCharacter[]>([]);
  const [availableFactions, setAvailableFactions] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<GameLocation[]>(
    []
  );
  const [showCustomFactionInput, setShowCustomFactionInput] = useState<{
    [key: number]: boolean;
  }>({});
  const [perksExpanded, setPerksExpanded] = useState<boolean>(false);
  const [distinctionsExpanded, setDistinctionsExpanded] =
    useState<boolean>(false);
  const { colors: themeColors } = useTheme();
  const commonStyles = useCommonStyles();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        imageGalleryContainer: {
          ...commonStyles.image.container,
        },
        imageGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 12,
        },
        imageItemContainer: {
          position: 'relative',
          width: 100,
          height: 100,
        },
        characterImageThumbnail: {
          width: 100,
          height: 100,
          borderRadius: 8,
          backgroundColor: themeColors.surface,
        },
        removeImageButton: {
          position: 'absolute',
          top: -8,
          right: -8,
          backgroundColor: themeColors.status.error,
          borderRadius: 12,
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
        },
        removeImageButtonText: {
          color: themeColors.text.primary,
          fontSize: 16,
          fontWeight: '700',
          lineHeight: 20,
        },
        placeholderImage: commonStyles.image.placeholder,
        imagePickerButton: commonStyles.image.pickerButton,
        imagePickerButtonText: {
          ...commonStyles.button.text,
          textAlign: 'center',
        },
        filterContainer: {
          ...commonStyles.layout.section,
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
          padding: 16,
        },
        filterLabel: {
          ...commonStyles.text.label,
          marginRight: 12,
          marginBottom: 0,
        },
        picker: commonStyles.input.picker,
        perkContainer: {
          flexDirection: 'column',
          marginBottom: 4,
        },
        perkHeaderContainer: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        perkBadgeContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        tagText: {
          ...commonStyles.badge.text,
          ...commonStyles.badge.tag,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        speciesText: {
          ...commonStyles.badge.text,
          ...commonStyles.badge.species,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        speciesSpecificItem: {
          borderLeftWidth: 4,
          borderLeftColor: themeColors.status.info,
          backgroundColor: themeColors.elevated,
        },
        descriptionText: {
          ...commonStyles.text.description,
          marginTop: 6,
          lineHeight: 20,
        },
        formSection: commonStyles.layout.formSection,
        label: commonStyles.text.label,
        input: commonStyles.input.base,
        notesInput: {
          ...commonStyles.input.base,
          ...commonStyles.input.multiline,
        },
        statusButton: {
          ...commonStyles.button.base,
          ...commonStyles.button.success,
        },
        statusButtonRetired: {
          backgroundColor: themeColors.status.error,
          borderColor: themeColors.status.error,
        },
        statusButtonText: commonStyles.button.text,
        statusButtonTextRetired: commonStyles.button.text,
        selectionItem: {
          backgroundColor: themeColors.elevated,
          padding: 16,
          borderRadius: 12,
          marginVertical: 6,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        selectedItem: {
          backgroundColor: themeColors.interactive.hover,
          borderColor: themeColors.accent.primary,
        },
        itemName: {
          fontSize: 16,
          color: themeColors.text.primary,
          fontWeight: '500',
        },
        factionContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        },
        factionInput: {
          ...commonStyles.input.base,
          padding: 12,
          borderRadius: 8,
          flex: 1,
        },
        customFactionContainer: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        backToDropdownButton: {
          backgroundColor: themeColors.interactive.hover,
          padding: 8,
          borderRadius: 6,
          minWidth: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },
        backToDropdownText: {
          color: themeColors.text.primary,
          fontSize: 16,
          fontWeight: '600',
        },
        factionStanding: {
          width: '35%',
        },
        relationshipGroup: {
          marginBottom: 16,
          padding: 12,
          backgroundColor: themeColors.elevated,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        relationshipContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
        },
        relationshipPickerContainer: {
          flex: 1,
        },
        relationshipNamePicker: {
          ...commonStyles.input.picker,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        relationshipType: {
          width: '35%',
        },
        customNameContainer: {
          marginBottom: 12,
          marginTop: -8,
        },
        customNameInput: {
          ...commonStyles.input.base,
          padding: 12,
          borderRadius: 8,
        },
        relationshipDescContainer: {
          marginBottom: 12,
        },
        relationshipDescInput: {
          ...commonStyles.input.base,
          padding: 12,
          borderRadius: 8,
          minHeight: 80,
          textAlignVertical: 'top',
        },
        removeButton: {
          ...commonStyles.button.small,
          backgroundColor: themeColors.status.error,
        },
        removeButtonText: commonStyles.button.textSmall,
        addButton: {
          ...commonStyles.button.base,
          ...commonStyles.button.primary,
          marginTop: 12,
        },
        addButtonText: commonStyles.button.text,
        submitContainer: {
          marginTop: 32,
          marginBottom: 40,
          paddingHorizontal: 16,
        },
        placeholderText: {
          ...commonStyles.text.body,
          fontWeight: '500',
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 8,
        },
        expandIcon: {
          color: themeColors.text.secondary,
          fontSize: 16,
          fontWeight: '600',
        },
        cyberwareContainer: {
          backgroundColor: themeColors.elevated,
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        cyberwareHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        },
        cyberwareName: {
          ...commonStyles.input.base,
          flex: 1,
          padding: 12,
          borderRadius: 8,
          fontWeight: '600',
        },
        cyberwareDescription: {
          ...commonStyles.input.base,
          padding: 12,
          borderRadius: 8,
          minHeight: 60,
          textAlignVertical: 'top',
          marginBottom: 12,
        },
        cyberwareModifiersSection: {
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: themeColors.border,
        },
        cyberwareModifiersLabel: {
          ...commonStyles.text.label,
          fontSize: 14,
          marginBottom: 12,
          color: themeColors.accent.primary,
        },
        modifierRow: {
          flexDirection: 'row',
          gap: 12,
          marginBottom: 12,
        },
        modifierInput: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        modifierLabel: {
          ...commonStyles.text.label,
          fontSize: 13,
          marginBottom: 0,
          minWidth: 80,
        },
        modifierField: {
          ...commonStyles.input.base,
          flex: 1,
          padding: 8,
          borderRadius: 6,
          textAlign: 'center',
        },
        tagModifiersSection: {
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: themeColors.border,
        },
        tagModifiersLabel: {
          ...commonStyles.text.label,
          fontSize: 14,
          marginBottom: 12,
          color: themeColors.accent.secondary,
        },
        tagModifiersList: {
          gap: 8,
          marginBottom: 12,
        },
        tagModifierRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: themeColors.surface,
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: themeColors.border,
        },
        tagModifierName: {
          ...commonStyles.text.label,
          fontSize: 13,
          marginBottom: 0,
          minWidth: 90,
          color: themeColors.text.primary,
        },
        tagModifierField: {
          ...commonStyles.input.base,
          flex: 1,
          padding: 8,
          borderRadius: 6,
          textAlign: 'center',
          minWidth: 60,
        },
        tagModifierRemove: {
          backgroundColor: themeColors.status.error,
          borderRadius: 4,
          width: 28,
          height: 28,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tagModifierRemoveText: {
          color: themeColors.text.primary,
          fontSize: 18,
          fontWeight: '700',
          lineHeight: 20,
        },
        addTagModifierButton: {
          backgroundColor: themeColors.surface,
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: themeColors.accent.secondary,
          borderStyle: 'dashed',
          alignItems: 'center',
        },
        addTagModifierButtonText: {
          ...commonStyles.text.label,
          fontSize: 13,
          marginBottom: 0,
          color: themeColors.accent.secondary,
        },
      }),
    [commonStyles, themeColors]
  );

  const [form, setForm] = useState<CharacterFormData>(
    editingCharacter
      ? {
          name: editingCharacter.name,
          archetypeId: editingCharacter.archetypeId,
          traitIds: [...editingCharacter.traitIds],
          qualityIds: [...editingCharacter.qualityIds],
          factions: [...editingCharacter.factions],
          relationships: [...(editingCharacter.relationships || [])],
          notes: editingCharacter.notes || '',
          occupation: editingCharacter.occupation || '',
          imageUris: editingCharacter.imageUris || [],
          locationId: editingCharacter.locationId,
          retired: editingCharacter.retired,
          modifications: [...(editingCharacter.modifications || [])],
        }
      : {
          name: '',
          archetypeId:
            ruleset.defaultArchetypeId ?? ruleset.archetypes[0]?.id ?? '',
          traitIds: [],
          qualityIds: [],
          factions: [],
          relationships: [],
          notes: '',
          occupation: '',
          imageUris: [],
          locationId: undefined,
          retired: false,
          modifications: [],
        }
  );

  const loadAllCharacters = useCallback(async () => {
    try {
      const characters = await loadCharacters();
      setAllCharacters(characters);

      // Extract unique faction names from all characters
      const factionNames = new Set<string>();
      characters.forEach(character => {
        character.factions.forEach(faction => {
          factionNames.add(faction.name);
        });
      });

      // Also load factions from centralized storage (exclude retired)
      const storedFactions = await loadFactions();
      storedFactions.forEach(faction => {
        // Only add non-retired factions to available list
        if (!faction.retired) {
          factionNames.add(faction.name);
        }
      });

      setAvailableFactions(Array.from(factionNames).sort());

      // Load available locations
      const locations = await loadLocations();
      setAvailableLocations(
        locations.sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      console.error('Failed to load characters:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllCharacters();
    }, [loadAllCharacters])
  );

  // Get available character names for relationship picker
  const getAvailableCharacterNames = () => {
    return allCharacters
      .filter(char => char.id !== editingCharacter?.id) // Exclude the current character
      .map(char => char.name)
      .sort();
  };

  const handleChange = (field: keyof CharacterFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Function to update bidirectional relationships
  const updateBidirectionalRelationships = async (
    currentCharacter: GameCharacter,
    previousRelationships: Relationship[] = []
  ): Promise<void> => {
    try {
      const allChars = await loadCharacters();
      const updatedCharacters = [...allChars];

      // Find the current character in the list and update it
      const currentCharIndex = updatedCharacters.findIndex(
        char => char.id === currentCharacter.id
      );
      if (currentCharIndex !== -1) {
        updatedCharacters[currentCharIndex] = currentCharacter;
      }

      // Remove old relationships that no longer exist
      for (const oldRel of previousRelationships) {
        const targetChar = updatedCharacters.find(
          char => char.name === oldRel.characterName
        );
        if (targetChar) {
          targetChar.relationships = (targetChar.relationships || []).filter(
            rel => rel.characterName !== currentCharacter.name
          );
        }
      }

      // Add new bidirectional relationships
      for (const relationship of currentCharacter.relationships) {
        const targetChar = updatedCharacters.find(
          char => char.name === relationship.characterName
        );
        if (targetChar && targetChar.id !== currentCharacter.id) {
          // Remove any existing relationship to avoid duplicates
          targetChar.relationships = (targetChar.relationships || []).filter(
            rel => rel.characterName !== currentCharacter.name
          );

          // Add the reciprocal relationship
          const reciprocalRelationship: Relationship = {
            characterName: currentCharacter.name,
            relationshipType: relationship.relationshipType,
            description: relationship.description || '',
          };

          targetChar.relationships.push(reciprocalRelationship);
          targetChar.updatedAt = new Date().toISOString();
        }
      }

      await saveCharacters(updatedCharacters);
    } catch (error) {
      console.error('Failed to update bidirectional relationships:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const newImageUri = result.assets[0].uri;
      const currentImages = form.imageUris || [];
      handleChange('imageUris', [...currentImages, newImageUri]);
    }
  };

  const removeImage = (index: number) => {
    const currentImages = form.imageUris || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    handleChange('imageUris', newImages);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    // Process relationships to use custom names when applicable
    const processedRelationships = form.relationships.map(rel => ({
      ...rel,
      characterName:
        rel.characterName === '__CUSTOM__'
          ? rel.customName || ''
          : rel.characterName,
      customName: undefined, // Remove the customName field before saving
    }));

    const formToSubmit = {
      ...form,
      relationships: processedRelationships,
    };

    try {
      let savedCharacter: GameCharacter;
      const previousRelationships = editingCharacter?.relationships || [];

      if (editingCharacter) {
        const result = await updateCharacter(editingCharacter.id, formToSubmit);
        if (!result) throw new Error('Failed to update character');
        savedCharacter = result;
      } else {
        savedCharacter = await addCharacter(formToSubmit);
      }

      // Update bidirectional relationships
      await updateBidirectionalRelationships(
        savedCharacter,
        previousRelationships
      );

      if (route.params?.onSubmit) {
        route.params.onSubmit(savedCharacter);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save character');
    }
  };

  return (
    <BaseFormScreen>
      <View style={styles.formSection}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={value => handleChange('name', value)}
          placeholder={`${label('character.singular')} Name`}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>{label('character.singular')} Images</Text>
        <View style={styles.imageGalleryContainer}>
          {form.imageUris && form.imageUris.length > 0 ? (
            <View style={styles.imageGrid}>
              {form.imageUris.map((uri, index) => (
                <View key={index} style={styles.imageItemContainer}>
                  <Image
                    source={{ uri }}
                    style={styles.characterImageThumbnail}
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeImageButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>No images selected</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.imagePickerButton}
            onPress={pickImage}
          >
            <Text style={styles.imagePickerButtonText}>
              {form.imageUris && form.imageUris.length > 0
                ? 'Add Another Image'
                : 'Add Image'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {ruleset.archetypes.length > 1 && (
        <View style={styles.formSection}>
          <Text style={styles.label}>{label('archetype.singular')}</Text>
          <Picker
            selectedValue={form.archetypeId}
            style={[styles.picker, { flex: 1 }]}
            onValueChange={(value: string) =>
              handleChange('archetypeId', value)
            }
          >
            {ruleset.archetypes.map(archetype => (
              <Picker.Item
                key={archetype.id}
                label={archetype.label}
                value={archetype.id}
              />
            ))}
          </Picker>
        </View>
      )}

      <View style={styles.formSection}>
        <Text style={styles.label}>Location</Text>
        <Picker
          selectedValue={form.locationId}
          style={[styles.picker, { flex: 1 }]}
          onValueChange={(value: string) =>
            handleChange('locationId', value || undefined)
          }
        >
          <Picker.Item label="(No Location)" value="" />
          {availableLocations.map(location => (
            <Picker.Item
              key={location.id}
              label={location.name}
              value={location.id}
            />
          ))}
        </Picker>
      </View>

      {ruleset.traits.length > 0 && (
        <View style={styles.formSection}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setPerksExpanded(!perksExpanded)}
          >
            <Text style={styles.label}>{label('trait.plural')}</Text>
            <Text style={styles.expandIcon}>{perksExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>
          {perksExpanded && (
            <>
              <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>
                  Filter by {label('traitCategory.singular')}:
                </Text>
                <Picker
                  selectedValue={selectedCategoryId}
                  style={[styles.picker, { flex: 1 }]}
                  onValueChange={setSelectedCategoryId}
                >
                  <Picker.Item
                    label={`All ${label('traitCategory.plural')}`}
                    value=""
                  />
                  {ruleset.traitCategories.map(category => (
                    <Picker.Item
                      key={category.id}
                      label={category.label}
                      value={category.id}
                    />
                  ))}
                </Picker>
              </View>
              {ruleset.traits
                .filter(
                  trait =>
                    (!selectedCategoryId ||
                      trait.categoryId === selectedCategoryId) &&
                    (!trait.allowedArchetypeIds ||
                      trait.allowedArchetypeIds.includes(form.archetypeId))
                )
                .map(trait => (
                  <TouchableOpacity
                    key={trait.id}
                    style={[
                      styles.selectionItem,
                      form.traitIds.includes(trait.id) && styles.selectedItem,
                      trait.allowedArchetypeIds && styles.speciesSpecificItem,
                    ]}
                    onPress={() => {
                      const newTraitIds = form.traitIds.includes(trait.id)
                        ? form.traitIds.filter(id => id !== trait.id)
                        : [...form.traitIds, trait.id];
                      handleChange('traitIds', newTraitIds);
                    }}
                  >
                    <View style={styles.perkContainer}>
                      <View style={styles.perkHeaderContainer}>
                        <Text style={styles.itemName}>{trait.name}</Text>
                        <View style={styles.perkBadgeContainer}>
                          {trait.allowedArchetypeIds &&
                            trait.allowedArchetypeIds.length > 0 && (
                              <Text style={styles.speciesText}>
                                {trait.allowedArchetypeIds.length === 1
                                  ? archetypeLabel(trait.allowedArchetypeIds[0])
                                  : `${trait.allowedArchetypeIds.length} ${label('archetype.plural')}`}
                              </Text>
                            )}
                          <Text style={styles.tagText}>
                            {categoryLabel(trait.categoryId)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.descriptionText}>
                      {trait.description}
                    </Text>
                  </TouchableOpacity>
                ))}
            </>
          )}
        </View>
      )}

      {ruleset.qualities.length > 0 && (
        <View style={styles.formSection}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setDistinctionsExpanded(!distinctionsExpanded)}
          >
            <Text style={styles.label}>{label('quality.plural')}</Text>
            <Text style={styles.expandIcon}>
              {distinctionsExpanded ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>
          {distinctionsExpanded && (
            <>
              {ruleset.qualities.map(quality => (
                <TouchableOpacity
                  key={quality.id}
                  style={[
                    styles.selectionItem,
                    form.qualityIds.includes(quality.id) && styles.selectedItem,
                  ]}
                  onPress={() => {
                    const isSelected = form.qualityIds.includes(quality.id);

                    if (isSelected) {
                      // Allow deselection
                      const newQualityIds = form.qualityIds.filter(
                        id => id !== quality.id
                      );
                      handleChange('qualityIds', newQualityIds);
                    } else if (form.qualityIds.length < maxQualities) {
                      // Allow selection if under limit
                      const newQualityIds = [...form.qualityIds, quality.id];
                      handleChange('qualityIds', newQualityIds);
                    } else {
                      // Show alert when limit reached
                      Alert.alert(
                        'Maximum Reached',
                        `You can only select up to ${maxQualities} ${label(
                          'quality.plural',
                          'lower'
                        )}.`
                      );
                    }
                  }}
                >
                  <Text style={styles.itemName}>{quality.name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}

      {/* Gated on `modifications`. Existing modifications stay on the
          character and are saved untouched, so the flag hides the editor
          rather than discarding data. */}
      {modificationsEnabled && (
        <View style={styles.formSection}>
          <Text style={styles.label}>{label('modification.plural')}</Text>
          {form.modifications &&
            form.modifications.map((cyber, index) => (
              <View key={index} style={styles.cyberwareContainer}>
                <View style={styles.cyberwareHeaderRow}>
                  <TextInput
                    style={styles.cyberwareName}
                    value={cyber.name}
                    onChangeText={value => {
                      const newCyberware = [...(form.modifications || [])];
                      newCyberware[index] = { ...cyber, name: value };
                      handleChange('modifications', newCyberware);
                    }}
                    placeholder={`${label('modification.singular')} name`}
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => {
                      const newCyberware = (form.modifications || []).filter(
                        (_, i) => i !== index
                      );
                      handleChange('modifications', newCyberware);
                    }}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.cyberwareDescription}
                  value={cyber.description}
                  onChangeText={value => {
                    const newCyberware = [...(form.modifications || [])];
                    newCyberware[index] = { ...cyber, description: value };
                    handleChange('modifications', newCyberware);
                  }}
                  placeholder="Description"
                  multiline
                />
                <View style={styles.cyberwareModifiersSection}>
                  <Text style={styles.cyberwareModifiersLabel}>
                    Stat Modifiers (optional):
                  </Text>
                  {attributeRows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.modifierRow}>
                      {row.map(attribute => (
                        <View key={attribute.id} style={styles.modifierInput}>
                          <Text style={styles.modifierLabel}>
                            {attribute.label}:
                          </Text>
                          <TextInput
                            style={styles.modifierField}
                            value={
                              cyber.modifier?.attributeDeltas?.[
                                attribute.id
                              ]?.toString() || ''
                            }
                            onChangeText={value => {
                              const newCyberware = [
                                ...(form.modifications || []),
                              ];
                              const numValue =
                                value === '' ? undefined : parseInt(value) || 0;
                              newCyberware[index] = setAttributeDelta(
                                cyber,
                                attribute.id,
                                numValue
                              );
                              handleChange('modifications', newCyberware);
                            }}
                            placeholder="0"
                            keyboardType="numeric"
                          />
                        </View>
                      ))}
                    </View>
                  ))}
                  <View style={styles.tagModifiersSection}>
                    <Text style={styles.tagModifiersLabel}>
                      {label('traitCategory.singular')} Score Modifiers
                      (optional):
                    </Text>
                    <View style={styles.tagModifiersList}>
                      {ruleset.traitCategories.map(category => {
                        const tag = category.id;
                        const currentValue =
                          cyber.modifier?.categoryDeltas?.[tag];
                        if (currentValue === undefined && !cyber.modifier)
                          return null;

                        return (
                          <View key={tag} style={styles.tagModifierRow}>
                            <Text style={styles.tagModifierName}>
                              {category.label}:
                            </Text>
                            <TextInput
                              style={styles.tagModifierField}
                              value={currentValue?.toString() || ''}
                              onChangeText={value => {
                                const newCyberware = [
                                  ...(form.modifications || []),
                                ];
                                const numValue =
                                  value === ''
                                    ? undefined
                                    : parseInt(value) || 0;

                                const currentTagModifiers = {
                                  ...(cyber.modifier?.categoryDeltas || {}),
                                };

                                if (numValue === undefined) {
                                  delete currentTagModifiers[tag];
                                } else {
                                  currentTagModifiers[tag] = numValue;
                                }

                                newCyberware[index] = setCategoryModifiers(
                                  cyber,
                                  currentTagModifiers
                                );
                                handleChange('modifications', newCyberware);
                              }}
                              placeholder="0"
                              keyboardType="numeric"
                            />
                            {currentValue !== undefined && (
                              <TouchableOpacity
                                style={styles.tagModifierRemove}
                                onPress={() => {
                                  const newCyberware = [
                                    ...(form.modifications || []),
                                  ];
                                  const currentTagModifiers = {
                                    ...(cyber.modifier?.categoryDeltas || {}),
                                  };
                                  delete currentTagModifiers[tag];

                                  newCyberware[index] = setCategoryModifiers(
                                    cyber,
                                    currentTagModifiers
                                  );
                                  handleChange('modifications', newCyberware);
                                }}
                              >
                                <Text style={styles.tagModifierRemoveText}>
                                  ×
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                    <TouchableOpacity
                      style={styles.addTagModifierButton}
                      onPress={() => {
                        // Find first tag that doesn't have a modifier
                        const currentTagModifiers =
                          cyber.modifier?.categoryDeltas || {};
                        const availableTags = ruleset.traitCategories
                          .map(category => category.id)
                          .filter(tag => !(tag in currentTagModifiers));

                        if (availableTags.length > 0) {
                          const newCyberware = [...(form.modifications || [])];
                          newCyberware[index] = setCategoryModifiers(cyber, {
                            ...currentTagModifiers,
                            [availableTags[0]]: 1,
                          });
                          handleChange('modifications', newCyberware);
                        } else {
                          Alert.alert(
                            `All ${label('traitCategory.plural')} Added`,
                            `All available ${label(
                              'traitCategory.plural',
                              'lower'
                            )} already have modifiers.`
                          );
                        }
                      }}
                    >
                      <Text style={styles.addTagModifierButtonText}>
                        + Add {label('traitCategory.singular')} Modifier
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              handleChange('modifications', [
                ...(form.modifications || []),
                { name: '', description: '' },
              ]);
            }}
          >
            <Text style={styles.addButtonText}>
              Add {label('modification.singular')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.formSection}>
        <Text style={styles.label}>{label('faction.plural')}</Text>
        {form.factions.map((faction, index) => (
          <View key={index} style={styles.factionContainer}>
            {showCustomFactionInput[index] ? (
              <View style={styles.customFactionContainer}>
                <TextInput
                  style={styles.factionInput}
                  value={faction.name}
                  onChangeText={value => {
                    const newFactions = [...form.factions];
                    newFactions[index] = { ...faction, name: value };
                    handleChange('factions', newFactions);

                    // Add new faction to available list if it doesn't exist
                    if (
                      value.trim() &&
                      !availableFactions.includes(value.trim())
                    ) {
                      setAvailableFactions(prev =>
                        [...prev, value.trim()].sort()
                      );
                    }
                  }}
                  placeholder="Enter new faction name"
                  autoFocus={true}
                  onBlur={() => {
                    // Switch back to dropdown if input is empty
                    if (!faction.name.trim()) {
                      setShowCustomFactionInput(prev => ({
                        ...prev,
                        [index]: false,
                      }));
                    }
                  }}
                />
                <TouchableOpacity
                  style={styles.backToDropdownButton}
                  onPress={() => {
                    setShowCustomFactionInput(prev => ({
                      ...prev,
                      [index]: false,
                    }));
                  }}
                >
                  <Text style={styles.backToDropdownText}>↩</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Picker
                selectedValue={faction.name || ''}
                style={styles.factionInput}
                onValueChange={value => {
                  if (value === '__ADD_NEW__') {
                    setShowCustomFactionInput(prev => ({
                      ...prev,
                      [index]: true,
                    }));
                    const newFactions = [...form.factions];
                    newFactions[index] = { ...faction, name: '' };
                    handleChange('factions', newFactions);
                  } else if (value && value !== faction.name) {
                    const newFactions = [...form.factions];
                    newFactions[index] = { ...faction, name: value };
                    handleChange('factions', newFactions);
                  }
                }}
              >
                <Picker.Item label="Select a faction..." value="" />
                {availableFactions.map(factionName => (
                  <Picker.Item
                    key={factionName}
                    label={factionName}
                    value={factionName}
                  />
                ))}
                <Picker.Item
                  label={`Add New ${label('faction.singular')}...`}
                  value="__ADD_NEW__"
                />
              </Picker>
            )}
            <Picker
              selectedValue={faction.standing}
              style={styles.factionStanding}
              onValueChange={value => {
                const newFactions = [...form.factions];
                newFactions[index] = { ...faction, standing: value };
                handleChange('factions', newFactions);
              }}
            >
              {Object.values(RelationshipStanding).map(standing => (
                <Picker.Item key={standing} label={standing} value={standing} />
              ))}
            </Picker>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => {
                const newFactions = form.factions.filter((_, i) => i !== index);
                handleChange('factions', newFactions);
              }}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            handleChange('factions', [
              ...form.factions,
              { name: '', standing: 'Neutral' },
            ]);
          }}
        >
          <Text style={styles.addButtonText}>
            Add {label('faction.singular')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Relationships</Text>
        {form.relationships.map((relationship, index) => (
          <View key={index} style={styles.relationshipGroup}>
            <View style={styles.relationshipContainer}>
              <View style={styles.relationshipPickerContainer}>
                <Picker
                  selectedValue={relationship.characterName}
                  style={styles.relationshipNamePicker}
                  onValueChange={value => {
                    const newRelationships = [...form.relationships];
                    newRelationships[index] = {
                      ...relationship,
                      characterName: value,
                    };
                    handleChange('relationships', newRelationships);
                  }}
                >
                  <Picker.Item
                    label={`Select ${label('character.singular')}...`}
                    value=""
                  />
                  {getAvailableCharacterNames().map(name => (
                    <Picker.Item key={name} label={name} value={name} />
                  ))}
                  <Picker.Item label="Other (Custom Name)" value="__CUSTOM__" />
                </Picker>
              </View>
              <Picker
                selectedValue={relationship.relationshipType}
                style={styles.relationshipType}
                onValueChange={value => {
                  const newRelationships = [...form.relationships];
                  newRelationships[index] = {
                    ...relationship,
                    relationshipType: value,
                  };
                  handleChange('relationships', newRelationships);
                }}
              >
                {Object.values(RelationshipStanding).map(type => (
                  <Picker.Item key={type} label={type} value={type} />
                ))}
              </Picker>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => {
                  const newRelationships = form.relationships.filter(
                    (_, i) => i !== index
                  );
                  handleChange('relationships', newRelationships);
                }}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            {relationship.characterName === '__CUSTOM__' && (
              <View style={styles.customNameContainer}>
                <TextInput
                  style={styles.customNameInput}
                  value={relationship.customName || ''}
                  onChangeText={value => {
                    const newRelationships = [...form.relationships];
                    newRelationships[index] = {
                      ...relationship,
                      customName: value,
                    };
                    handleChange('relationships', newRelationships);
                  }}
                  placeholder="Enter custom character name"
                />
              </View>
            )}
            <View style={styles.relationshipDescContainer}>
              <TextInput
                style={styles.relationshipDescInput}
                value={relationship.description || ''}
                onChangeText={value => {
                  const newRelationships = [...form.relationships];
                  newRelationships[index] = {
                    ...relationship,
                    description: value,
                  };
                  handleChange('relationships', newRelationships);
                }}
                placeholder={`Description of relationship with ${relationship.characterName || 'character'}`}
                multiline
              />
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            handleChange('relationships', [
              ...form.relationships,
              {
                characterName: '',
                relationshipType: RelationshipStanding.Friend,
                description: '',
              },
            ]);
          }}
        >
          <Text style={styles.addButtonText}>Add Relationship</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Status</Text>
        <TouchableOpacity
          style={[
            styles.statusButton,
            form.retired && styles.statusButtonRetired,
          ]}
          onPress={() => handleChange('retired', !form.retired)}
        >
          <Text
            style={[
              styles.statusButtonText,
              form.retired && styles.statusButtonTextRetired,
            ]}
          >
            {form.retired ? '🔒 Retired' : '✓ Active'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Occupation</Text>
        <TextInput
          style={styles.input}
          value={form.occupation}
          onChangeText={value => handleChange('occupation', value)}
          placeholder={`${label('character.singular')} Occupation`}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={form.notes}
          onChangeText={value => handleChange('notes', value)}
          placeholder={`${label('character.singular')} Notes`}
          multiline
        />
      </View>

      <View style={styles.submitContainer}>
        <Button
          title={
            editingCharacter
              ? `Update ${label('character.singular')}`
              : `Create ${label('character.singular')}`
          }
          onPress={handleSubmit}
        />
      </View>
    </BaseFormScreen>
  );
};
