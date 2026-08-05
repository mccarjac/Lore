import React, { useCallback, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Text,
  LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  RouteProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/navigation/types';
import { GameLocation, LocationMapPin } from '@models/types';
import {
  getLocation,
  loadLocations,
  updateLocation,
} from '@utils/characterStorage';
import { colors as themeColors } from '@/styles/theme';
import { commonStyles } from '@/styles/commonStyles';
import {
  LocationMarker,
  MapInfoCard,
  MapLocationPickerModal,
} from '@/components';
// Coordinate handling is deliberately image-agnostic: pins store normalized
// 0-1 coordinates, so a different map image needs no data migration.
import {
  containerPointToNormalized,
  clampTranslation,
  Point,
  Size,
} from '@/utils/mapCoordinates';
import { v4 as uuidv4 } from 'uuid';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type LocationMapNavigationProp = StackNavigationProp<RootStackParamList>;
type LocationMapRouteProp = RouteProp<RootStackParamList, 'LocationMap'>;

interface ResolvedPin {
  pin: LocationMapPin;
  location: GameLocation;
}

export const LocationMapScreen: React.FC = () => {
  const navigation = useNavigation<LocationMapNavigationProp>();
  const route = useRoute<LocationMapRouteProp>();
  const { locationId } = route.params;

  const [location, setLocation] = useState<GameLocation | null>(null);
  const [locations, setLocations] = useState<GameLocation[]>([]);
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState<Size>({
    width: 0,
    height: 0,
  });
  const [selectedPin, setSelectedPin] = useState<ResolvedPin | null>(null);
  const [pendingCoords, setPendingCoords] = useState<Point | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const reload = useCallback(async () => {
    const [loadedLocation, allLocations] = await Promise.all([
      getLocation(locationId),
      loadLocations(),
    ]);
    setLocation(loadedLocation);
    setLocations(allLocations);
  }, [locationId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const mapImageUri = location?.mapImageUri;

  // Get the actual image dimensions. Keyed on the resolved URI, not [] — a
  // different map image otherwise keeps the previous one's dimensions
  // forever.
  React.useEffect(() => {
    if (!mapImageUri) {
      setImageSize({ width: 0, height: 0 });
      return;
    }
    Image.getSize(
      mapImageUri,
      (width, height) => {
        const scaleValue = Math.min(
          (screenWidth - 32) / width,
          (screenHeight - 100) / height,
          1
        );
        setImageSize({
          width: width * scaleValue,
          height: height * scaleValue,
        });
      },
      () => setImageSize({ width: 0, height: 0 })
    );
  }, [mapImageUri]);

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleLongPress = (coords: Point) => {
    setPendingCoords(coords);
  };

  const handlePlaceLocation = async (targetLocationId: string) => {
    if (!pendingCoords || !location) {
      return;
    }
    const newPin: LocationMapPin = {
      id: uuidv4(),
      locationId: targetLocationId,
      x: pendingCoords.x,
      y: pendingCoords.y,
    };
    await updateLocation(location.id, {
      mapPins: [...(location.mapPins ?? []), newPin],
    });
    setPendingCoords(null);
    await reload();
  };

  const handleRemovePin = async (pinId: string) => {
    if (!location) {
      return;
    }
    await updateLocation(location.id, {
      mapPins: (location.mapPins ?? []).filter(p => p.id !== pinId),
    });
    setSelectedPin(null);
    await reload();
  };

  const handleViewDetails = (targetLocationId: string) => {
    setSelectedPin(null);
    navigation.navigate('LocationDetails', { locationId: targetLocationId });
  };

  const handleViewMap = (targetLocationId: string) => {
    setSelectedPin(null);
    navigation.navigate('LocationMap', { locationId: targetLocationId });
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = savedScale.value * e.scale;
      const clamped = clampTranslation(
        translateX.value,
        translateY.value,
        scale.value,
        imageSize,
        containerSize
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      // Constrain scale between 1 and 3
      let targetScale = scale.value;
      if (targetScale < 1) {
        targetScale = 1;
      } else if (targetScale > 3) {
        targetScale = 3;
      }
      const clamped = clampTranslation(
        translateX.value,
        translateY.value,
        targetScale,
        imageSize,
        containerSize
      );
      scale.value = withTiming(targetScale);
      translateX.value = withTiming(clamped.x);
      translateY.value = withTiming(clamped.y);
      savedScale.value = targetScale;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
    });

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      const clamped = clampTranslation(
        savedTranslateX.value + e.translationX,
        savedTranslateY.value + e.translationY,
        scale.value,
        imageSize,
        containerSize
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2x
        const targetScale = 2;
        const clamped = clampTranslation(
          translateX.value,
          translateY.value,
          targetScale,
          imageSize,
          containerSize
        );
        scale.value = withTiming(targetScale);
        savedScale.value = targetScale;
        translateX.value = withTiming(clamped.x);
        translateY.value = withTiming(clamped.y);
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
      }
    });

  const longPress = Gesture.LongPress().onStart(e => {
    const normalized = containerPointToNormalized(
      { x: e.x, y: e.y },
      containerSize,
      imageSize,
      {
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      }
    );
    if (normalized) {
      runOnJS(handleLongPress)(normalized);
    }
  });

  const composedGesture = Gesture.Simultaneous(
    doubleTap,
    Gesture.Simultaneous(pinchGesture, panGesture),
    longPress
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const resolvedPins: ResolvedPin[] = (location?.mapPins ?? [])
    .map(pin => {
      const target = locations.find(l => l.id === pin.locationId);
      return target ? { pin, location: target } : null;
    })
    .filter((entry): entry is ResolvedPin => entry !== null);

  const pickerLocations = locations.filter(l => l.id !== locationId);
  const placedLocationIds = new Set(
    (location?.mapPins ?? []).map(p => p.locationId)
  );

  return (
    <View style={styles.container}>
      {location && (
        <View style={styles.titleBar}>
          <Text style={styles.titleText} numberOfLines={1}>
            {location.name}
          </Text>
        </View>
      )}
      <GestureDetector gesture={composedGesture}>
        <View style={styles.imageContainer} onLayout={handleContainerLayout}>
          {imageSize.width > 0 && mapImageUri ? (
            <Animated.View
              style={[
                {
                  width: imageSize.width,
                  height: imageSize.height,
                },
                animatedStyle,
              ]}
            >
              <Image
                source={{ uri: mapImageUri }}
                style={styles.mapImage}
                resizeMode="contain"
              />
              {resolvedPins.map(({ pin, location: pinnedLocation }) => (
                <LocationMarker
                  key={pin.id}
                  x={pin.x}
                  y={pin.y}
                  location={pinnedLocation}
                  imageWidth={imageSize.width}
                  imageHeight={imageSize.height}
                  scale={scale}
                  onPress={() =>
                    setSelectedPin({ pin, location: pinnedLocation })
                  }
                />
              ))}
            </Animated.View>
          ) : !mapImageUri ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                This location has no map image yet.
              </Text>
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}
        </View>
      </GestureDetector>

      {selectedPin && (
        <MapInfoCard
          location={selectedPin.location}
          onViewDetails={handleViewDetails}
          onClose={() => setSelectedPin(null)}
          onViewMap={
            selectedPin.location.mapImageUri
              ? () => handleViewMap(selectedPin.location.id)
              : undefined
          }
          onRemovePin={() => handleRemovePin(selectedPin.pin.id)}
        />
      )}

      <MapLocationPickerModal
        visible={pendingCoords !== null}
        locations={pickerLocations}
        placedLocationIds={placedLocationIds}
        onSelect={handlePlaceLocation}
        onCancel={() => setPendingCoords(null)}
      />
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.primary,
  },
  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  titleText: {
    ...commonStyles.text.h3,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...commonStyles.text.body,
    color: themeColors.text.secondary,
  },
});
