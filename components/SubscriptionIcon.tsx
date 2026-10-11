import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { getInitials, resolveSubscriptionIcon } from '../lib/logoHelper';

interface Props {
  name: string;
  icon?: any;
  color?: string;
  containerClassName?: string;
  iconClassName?: string;
}

export default function SubscriptionIcon({
  name,
  icon,
  color,
  containerClassName = 'size-12 rounded-2xl bg-white/70 items-center justify-center overflow-hidden',
  iconClassName = 'size-7',
}: Props) {
  const [hasError, setHasError] = useState(false);
  const resolved = resolveSubscriptionIcon(name, icon);

  // Normalizes string URIs to { uri: ... } objects
  const imageSource = typeof resolved === 'string' ? { uri: resolved } : resolved;

  if (hasError || !imageSource) {
    return (
      <View
        className={containerClassName}
        style={color ? { backgroundColor: color } : undefined}
      >
        <Text className="text-xs font-sans-extrabold text-primary">
          {getInitials(name)}
        </Text>
      </View>
    );
  }

  return (
    <View className={containerClassName}>
      <Image
        source={imageSource}
        className={iconClassName}
        resizeMode="contain"
        onError={() => setHasError(true)}
      />
    </View>
  );
}