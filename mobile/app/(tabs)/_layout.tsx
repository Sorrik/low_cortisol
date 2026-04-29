// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FontSize } from '@/constants/theme';
import { useThemedStyles, ColorPalette } from '@/lib/useThemedStyles';
import { useTheme } from '@/context/ThemeContext';

import { View, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IoniconsName;
  color: string;
  focused: boolean;
  size?: number;
}

// Animated Tab Icon
function TabIcon({ name, color, focused, size = 22 }: TabIconProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1.1 : 1,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Ionicons
        name={focused ? name : (`${name}-outline` as IoniconsName)}
        size={size}
        color={color}
      />
    </Animated.View>
  );
}

// Central Floating Button for Recommendations
function CenterTabButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const focused = accessibilityState?.selected ?? false;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (focused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
    }
  }, [focused]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, friction: 5, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.centerButtonWrapper}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.centerButtonTouchable}
      >
        <Animated.View
          style={[
            styles.centerButton,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons name="sparkles" size={26} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}


export default function TabsLayout() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      {/* Tab 1 - Overview */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Обзор',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="grid" color={color} focused={focused} />
          ),
        }}
      />

      {/* Tab 2 - Sleep */}
      <Tabs.Screen
        name="sleep"
        options={{
          title: 'Сон',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="moon" color={color} focused={focused} />
          ),
        }}
      />

      {/* Center - Recommendations (Floating Button) */}
      <Tabs.Screen
        name="recommendations"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => <CenterTabButton {...props} />,
        }}
      />

      {/* Tab 4 - Activity */}
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Активность',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="flame" color={color} focused={focused} />
          ),
        }}
      />

      {/* Tab 5 - Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />

      {/* Hidden screens - accessible via navigation but not shown in tab bar */}
      <Tabs.Screen
        name="nutrition"
        options={{
          href: null, // Hides from tab bar
        }}
      />
      <Tabs.Screen
        name="mood"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stress"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="water"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="achievements"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    height: Platform.OS === 'ios' ? 85 : 65,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 0,
  },
  tabBarItem: {
    paddingTop: 2,
  },
  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  centerButtonTouchable: {
    position: 'absolute',
    top: -24,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.card,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});