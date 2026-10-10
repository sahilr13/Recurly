import { View, Text, Pressable, Alert, LayoutAnimation } from 'react-native';
import React from 'react';
import { formatCurrency, formatSubscriptionDateTime, formatStatusLabel } from '../lib/utils';
import clsx from 'clsx';
import { Feather } from '@expo/vector-icons';
import SubscriptionIcon from './SubscriptionIcon';
import AnimatedPressable from './AnimatedPressable';
import { useSubscriptionStore } from '../lib/subscriptionStore';

interface ExtendedCardProps extends SubscriptionCardProps {
  onEdit?: () => void;
}

const SubcriptionCard = ({
  id,
  name,
  price,
  currency = 'INR',
  icon,
  billing,
  color,
  category,
  plan,
  renewalDate,
  expanded,
  onPress,
  onEdit,
  startDate,
  status = 'active',
}: ExtendedCardProps) => {
  const { removeSubscription, updateSubscription } = useSubscriptionStore();

  const handleCardPress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onPress?.();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Subscription',
      `Are you sure you want to remove "${name}" from your active subscriptions?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            removeSubscription(id);
          },
        },
      ]
    );
  };

  const handleToggleStatus = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nextStatus = status === 'active' ? 'cancelled' : 'active';
    updateSubscription(id, { status: nextStatus });
  };

  const isCancelled = status !== 'active';

  return (
    <AnimatedPressable scaleTo={0.98} onPress={handleCardPress}>
      <View
        className={clsx(
          'sub-card shadow-xs transition-all border border-border',
          expanded ? 'sub-card-expanded border-black/20' : isCancelled ? 'opacity-70 bg-card' : 'bg-card'
        )}
        style={!expanded && color ? { backgroundColor: color } : undefined}
      >
        <View className="sub-head py-1">
          <View className="sub-main flex-1 min-w-0">
            <SubscriptionIcon
              name={name}
              icon={icon}
              color={color}
              containerClassName="size-12 rounded-2xl bg-white/50 items-center justify-center shadow-xs overflow-hidden shrink-0"
              iconClassName="size-7"
            />

            <View className="sub-copy flex-1 min-w-0 pr-2">
              <View className="flex-row items-center gap-1.5 flex-1 min-w-0">
                <Text numberOfLines={1} className={clsx('sub-title text-base font-sans-bold text-primary truncate', isCancelled && 'line-through text-primary/70')}>
                  {name}
                </Text>
                {isCancelled && (
                  <View className="bg-destructive/15 px-1.5 py-0.5 rounded-md border border-destructive/20 shrink-0">
                    <Text className="text-[9px] font-sans-bold text-destructive uppercase">Paused</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} ellipsizeMode="tail" className="sub-meta text-xs font-sans-medium text-muted-foreground mt-0.5">
                {category?.trim() || plan?.trim() || (renewalDate ? formatSubscriptionDateTime(renewalDate) : '')}
              </Text>
            </View>
          </View>

          <View className="sub-price-box items-end shrink-0 pl-2">
            <View className="flex-row items-center gap-1">
              <Text className="sub-price text-base font-sans-extrabold text-primary" numberOfLines={1}>
                {formatCurrency(price, currency)}
              </Text>
              <Feather 
                name={expanded ? "chevron-up" : "chevron-down"} 
                size={14} 
                color="rgba(8, 17, 38, 0.45)" 
              />
            </View>
            <Text className="sub-billing text-[11px] font-sans-medium text-muted-foreground">
              {billing}
            </Text>
          </View>
        </View>

        {/* Expanded State */}
        {expanded && (
          <View className="mt-3.5 pt-3 border-t border-black/10 gap-2.5">
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Feather name="calendar" size={12} color="#666" />
                  <Text className="text-xs font-sans-medium text-muted-foreground">Started Date:</Text>
                </View>
                <Text className="text-xs font-sans-bold text-primary" numberOfLines={1}>
                  {startDate ? formatSubscriptionDateTime(startDate) : 'Not specified'}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Feather name="clock" size={12} color="#666" />
                  <Text className="text-xs font-sans-medium text-muted-foreground">Next Renewal:</Text>
                </View>
                <Text className="text-xs font-sans-bold text-primary" numberOfLines={1}>
                  {renewalDate ? formatSubscriptionDateTime(renewalDate) : 'Not specified'}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Feather name="activity" size={12} color="#666" />
                  <Text className="text-xs font-sans-medium text-muted-foreground">Billing Status:</Text>
                </View>
                <Text className="text-xs font-sans-bold text-primary">
                  {formatStatusLabel(status)}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row items-center gap-2 mt-1.5">
              <Pressable
                onPress={onEdit}
                className="flex-1 bg-white/80 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 border border-black/10 active:opacity-70 shadow-xs"
              >
                <Feather name="edit-2" size={12} color="#081126" />
                <Text className="text-xs font-sans-bold text-primary">Edit</Text>
              </Pressable>

              <Pressable
                onPress={handleToggleStatus}
                className="flex-1 bg-white/80 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 border border-black/10 active:opacity-70 shadow-xs"
              >
                <Feather name={status === 'active' ? "pause" : "play"} size={12} color="#081126" />
                <Text className="text-xs font-sans-bold text-primary">
                  {status === 'active' ? 'Pause' : 'Resume'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                className="px-3 bg-destructive/15 py-2.5 rounded-xl items-center flex-row justify-center gap-1 border border-destructive/20 active:opacity-70 shrink-0"
              >
                <Feather name="trash-2" size={12} color="#dc2626" />
                <Text className="text-xs font-sans-bold text-destructive">Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
};

export default SubcriptionCard;