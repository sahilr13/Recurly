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
  containerClassName = 'size-14 rounded-2xl bg-iconback items-center justify-center overflow-hidden',
  iconClassName = 'size-8',
}: Props) {
  const [hasError, setHasError] = useState(false);
  const resolvedSource = resolveSubscriptionIcon(name, icon);

  if (hasError || !resolvedSource) {
    return (
      <View
        className={containerClassName}
        style={color ? { backgroundColor: color } : undefined}
      >
        <Text className="text-base font-sans-extrabold text-primary">
          {getInitials(name)}
        </Text>
      </View>
    );
  }

  return (
    <View className={containerClassName}>
      <Image
        source={resolvedSource}
        className={iconClassName}
        resizeMode="contain"
        onError={() => setHasError(true)}
      />
    </View>
  );
}