import { View, Text } from 'react-native';
import React from 'react';
import { formatCurrency } from '../lib/utils';
import SubscriptionIcon from './SubscriptionIcon';
import AnimatedPressable from './AnimatedPressable';
import dayjs from 'dayjs';

interface Props {
  name: string;
  price: number;
  currency?: string;
  renewalDate?: string;
  daysLeft?: number;
  icon?: any;
}

const UpcomingSubcriptionCard = ({ name, price, currency = 'INR', renewalDate, daysLeft, icon }: Props) => {
  const computedDaysLeft = daysLeft !== undefined 
    ? daysLeft 
    : renewalDate 
      ? Math.max(0, dayjs(renewalDate).diff(dayjs().startOf('day'), 'day')) 
      : 0;

  const isUrgent = computedDaysLeft <= 2;

  return (
    <AnimatedPressable scaleTo={0.95}>
      <View 
        className={`w-40 rounded-2xl border p-3 shadow-xs ${
          isUrgent ? 'border-accent/40 bg-[#fff5ea]' : 'border-border bg-card'
        }`}
      >
        <View className="flex-row items-center gap-2.5">
          <SubscriptionIcon
            name={name}
            icon={icon}
            containerClassName="size-11 rounded-xl bg-white/70 items-center justify-center shadow-xs overflow-hidden shrink-0"
            iconClassName="size-6"
          />

          <View className="flex-1 min-w-0">
            <Text className="text-sm font-sans-extrabold text-primary" numberOfLines={1}>
              {formatCurrency(price, currency)}
            </Text>
            <View className={`mt-0.5 self-start px-1.5 py-0.5 rounded-md ${isUrgent ? 'bg-accent/15' : 'bg-black/5'}`}>
              <Text className={`text-[10px] font-sans-bold ${isUrgent ? 'text-accent' : 'text-muted-foreground'}`}>
                {computedDaysLeft === 0 ? 'Today' : computedDaysLeft === 1 ? 'Tomorrow' : `${computedDaysLeft}d left`}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-xs font-sans-bold text-primary mt-2 truncate" numberOfLines={1}>
          {name}
        </Text>
      </View>
    </AnimatedPressable>
  );
};

export default UpcomingSubcriptionCard;