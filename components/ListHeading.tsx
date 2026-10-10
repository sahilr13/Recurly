import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';

interface ListHeadingProps {
  title: string;
  actionText?: string;
  onAction?: () => void;
}

const ListHeading = ({ title, actionText, onAction }: ListHeadingProps) => {
  return (
    <View className="my-3 flex-row items-center justify-between">
      <Text className="text-lg font-sans-bold text-primary shrink-1" numberOfLines={1}>
        {title}
      </Text>

      {onAction && (
        <TouchableOpacity 
          onPress={onAction}
          className="rounded-full border border-black/15 bg-white/40 px-3 py-1 active:opacity-70 shrink-0"
        >
          <Text className="text-xs font-sans-bold text-primary">
            {actionText || 'View all'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ListHeading;