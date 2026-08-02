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
  AuthoredFacetEntry,
  CharacterFormData,
  FacetValue,
  GameCharacter,
  GameEvent,
  GameLocation,
  Relationship,
} from '@models/types';
import {
  addCharacter,
  updateCharacter,
  loadCharacters,
  saveCharacters,
  loadEvents,
  loadFactions,
  loadLocations,
} from '@utils/characterStorage';
import { useTheme } from '@/styles/theme';
import { useCommonStyles } from '@/styles/commonStyles';
import {
  BaseFormScreen,
  FacetAuthoredEditor,
  FacetMultiSelectField,
  FacetSingleSelectField,
} from '@/components';
import { useLabels, useRuleset } from '@/ruleset';
import {
  findRelationshipCollectionForPair,
  relationshipLabel,
} from '@/ruleset/relationships';
import type { RulesetDefinition } from '@/ruleset/types';

/**
 * A new character's starting facet selections: a `defaultEntryId` for a
 * `single` collection (the old `defaultArchetypeId`), empty otherwise. Catalog
 * collections are excluded — a character never holds one directly.
 */
const buildDefaultFacets = (
  ruleset: RulesetDefinition
): Record<string, FacetValue[]> =>
  Object.fromEntries(
    ruleset.facets
      .filter(collection => collection.selection !== 'catalog')
      .map(collection => [
        collection.id,
        collection.defaultEntryId ? [collection.defaultEntryId] : [],
      ])
  );

type CharacterFormRouteProp = RouteProp<RootStackParamList, 'CharacterForm'>;

export const CharacterFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CharacterFormRouteProp>();
  const label = useLabels();
  const { ruleset } = useRuleset();
  const characterFactionStanding = useMemo(
    () => findRelationshipCollectionForPair(ruleset, ['character', 'faction']),
    [ruleset]
  );
  const characterStanding = useMemo(
    () =>
      findRelationshipCollectionForPair(ruleset, ['character', 'character']),
    [ruleset]
  );
  const characterEventRole = useMemo(
    () => findRelationshipCollectionForPair(ruleset, ['character', 'event']),
    [ruleset]
  );
  const defaultEventRelationshipTypeId =
    characterEventRole?.defaultEntryId ??
    characterEventRole?.entries[0]?.id ??
    '';
  const defaultFactionRelationshipTypeId =
    characterFactionStanding?.defaultEntryId ??
    characterFactionStanding?.entries[0]?.id ??
    '';
  const defaultCharacterRelationshipTypeId =
    characterStanding?.defaultEntryId ??
    characterStanding?.entries[0]?.id ??
    '';
  const editingCharacter = route.params?.character;
  const [allCharacters, setAllCharacters] = useState<GameCharacter[]>([]);
  const [availableFactions, setAvailableFactions] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<GameLocation[]>(
    []
  );
  const [availableEvents, setAvailableEvents] = useState<GameEvent[]>([]);
  const [showCustomFactionInput, setShowCustomFactionInput] = useState<{
    [key: number]: boolean;
  }>({});
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
          facets: { ...(editingCharacter.facets ?? {}) },
          factions: [...editingCharacter.factions],
          relationships: [...(editingCharacter.relationships || [])],
          eventRelationships: [...(editingCharacter.eventRelationships || [])],
          notes: editingCharacter.notes || '',
          occupation: editingCharacter.occupation || '',
          imageUris: editingCharacter.imageUris || [],
          locationId: editingCharacter.locationId,
          retired: editingCharacter.retired,
        }
      : {
          name: '',
          facets: buildDefaultFacets(ruleset),
          factions: [],
          relationships: [],
          eventRelationships: [],
          notes: '',
          occupation: '',
          imageUris: [],
          locationId: undefined,
          retired: false,
        }
  );

  const getFormFacetIds = (collectionId: string): string[] =>
    (form.facets?.[collectionId] ?? []).filter(
      (v): v is string => typeof v === 'string'
    );

  const getFormAuthoredFacets = (collectionId: string): AuthoredFacetEntry[] =>
    (form.facets?.[collectionId] ?? []).filter(
      (v): v is AuthoredFacetEntry => typeof v !== 'string'
    );

  const setFormFacet = (collectionId: string, values: FacetValue[]) => {
    setForm(prev => ({
      ...prev,
      facets: { ...prev.facets, [collectionId]: values },
    }));
  };

  // Every collection's current selections, for the `requires` filtering a
  // `FacetMultiSelectField` needs (the generalized form of the old
  // archetype-restricted trait check).
  const allFacetSelections: Record<string, string[]> = Object.fromEntries(
    ruleset.facets.map(collection => [
      collection.id,
      getFormFacetIds(collection.id),
    ])
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

      // Load available events, for the Event Relationships section
      const events = await loadEvents();
      setAvailableEvents(
        [...events].sort((a, b) => a.title.localeCompare(b.title))
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
            relationshipTypeId: relationship.relationshipTypeId,
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

      {ruleset.facets
        .filter(collection => collection.selection === 'single')
        .map(collection => (
          <FacetSingleSelectField
            key={collection.id}
            collection={collection}
            selectedId={getFormFacetIds(collection.id)[0]}
            onChange={id => setFormFacet(collection.id, [id])}
          />
        ))}

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

      {ruleset.facets
        .filter(collection => collection.selection === 'multi')
        .map(collection =>
          collection.authored ? (
            <View key={collection.id} style={styles.formSection}>
              <Text style={styles.label}>{collection.plural}</Text>
              <FacetAuthoredEditor
                collection={collection}
                ruleset={ruleset}
                entries={getFormAuthoredFacets(collection.id)}
                onChange={entries => setFormFacet(collection.id, entries)}
              />
            </View>
          ) : (
            <View key={collection.id} style={styles.formSection}>
              <FacetMultiSelectField
                collection={collection}
                ruleset={ruleset}
                selectedIds={getFormFacetIds(collection.id)}
                onChange={ids => setFormFacet(collection.id, ids)}
                allSelections={allFacetSelections}
              />
            </View>
          )
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
              selectedValue={faction.relationshipTypeId}
              style={styles.factionStanding}
              onValueChange={value => {
                const newFactions = [...form.factions];
                newFactions[index] = { ...faction, relationshipTypeId: value };
                handleChange('factions', newFactions);
              }}
            >
              {(characterFactionStanding?.entries ?? []).map(entry => (
                <Picker.Item
                  key={entry.id}
                  label={relationshipLabel(entry)}
                  value={entry.id}
                />
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
              {
                name: '',
                relationshipTypeId: defaultFactionRelationshipTypeId,
              },
            ]);
          }}
        >
          <Text style={styles.addButtonText}>
            Add {label('faction.singular')}
          </Text>
        </TouchableOpacity>
      </View>

      {(characterStanding || form.relationships.length > 0) && (
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
                    <Picker.Item
                      label="Other (Custom Name)"
                      value="__CUSTOM__"
                    />
                  </Picker>
                </View>
                <Picker
                  selectedValue={relationship.relationshipTypeId}
                  style={styles.relationshipType}
                  onValueChange={value => {
                    const newRelationships = [...form.relationships];
                    newRelationships[index] = {
                      ...relationship,
                      relationshipTypeId: value,
                    };
                    handleChange('relationships', newRelationships);
                  }}
                >
                  {(characterStanding?.entries ?? []).map(entry => (
                    <Picker.Item
                      key={entry.id}
                      label={relationshipLabel(entry)}
                      value={entry.id}
                    />
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
                  relationshipTypeId: defaultCharacterRelationshipTypeId,
                  description: '',
                },
              ]);
            }}
          >
            <Text style={styles.addButtonText}>Add Relationship</Text>
          </TouchableOpacity>
        </View>
      )}

      {characterEventRole && (
        <View style={styles.formSection}>
          <Text style={styles.label}>Event Relationships</Text>
          {(form.eventRelationships ?? []).map((eventRelationship, index) => (
            <View key={index} style={styles.relationshipGroup}>
              <View style={styles.relationshipContainer}>
                <View style={styles.relationshipPickerContainer}>
                  <Picker
                    selectedValue={eventRelationship.eventId}
                    style={styles.relationshipNamePicker}
                    onValueChange={value => {
                      const newEventRelationships = [
                        ...(form.eventRelationships ?? []),
                      ];
                      newEventRelationships[index] = {
                        ...eventRelationship,
                        eventId: value,
                      };
                      handleChange('eventRelationships', newEventRelationships);
                    }}
                  >
                    <Picker.Item label="Select an event..." value="" />
                    {availableEvents.map(event => (
                      <Picker.Item
                        key={event.id}
                        label={event.title}
                        value={event.id}
                      />
                    ))}
                  </Picker>
                </View>
                <Picker
                  selectedValue={eventRelationship.relationshipTypeId}
                  style={styles.relationshipType}
                  onValueChange={value => {
                    const newEventRelationships = [
                      ...(form.eventRelationships ?? []),
                    ];
                    newEventRelationships[index] = {
                      ...eventRelationship,
                      relationshipTypeId: value,
                    };
                    handleChange('eventRelationships', newEventRelationships);
                  }}
                >
                  {characterEventRole.entries.map(entry => (
                    <Picker.Item
                      key={entry.id}
                      label={relationshipLabel(entry)}
                      value={entry.id}
                    />
                  ))}
                </Picker>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => {
                    const newEventRelationships = (
                      form.eventRelationships ?? []
                    ).filter((_, i) => i !== index);
                    handleChange('eventRelationships', newEventRelationships);
                  }}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              handleChange('eventRelationships', [
                ...(form.eventRelationships ?? []),
                {
                  eventId: '',
                  relationshipTypeId: defaultEventRelationshipTypeId,
                },
              ]);
            }}
          >
            <Text style={styles.addButtonText}>Add Event Relationship</Text>
          </TouchableOpacity>
        </View>
      )}

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
