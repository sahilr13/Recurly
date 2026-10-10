import { View, Text } from 'react-native';
import React from 'react';
import { formatCurrency } from '../lib/utils';
import SubscriptionIcon from './SubscriptionIcon';
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
  // If daysLeft wasn't passed directly, calculate from renewalDate
  const computedDaysLeft = daysLeft !== undefined 
    ? daysLeft 
    : renewalDate 
      ? Math.max(0, dayjs(renewalDate).diff(dayjs(), 'day')) 
      : 0;

  return (
    <View className="upcoming-card">
      <View className="upcoming-row">
        <SubscriptionIcon
          name={name}
          icon={icon}
          containerClassName="upcoming-icon-container"
          iconClassName="upcoming-icon"
        />

        <View>
          <Text className="upcoming-price">{formatCurrency(price, currency)}</Text>
          <Text className="upcoming-meta" numberOfLines={1}>
            {computedDaysLeft === 0
              ? 'Today'
              : computedDaysLeft === 1
              ? 'Tomorrow'
              : `${computedDaysLeft} days left`}
          </Text>
        </View>
      </View>
      <Text className="upcoming-name" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
};

export default UpcomingSubcriptionCard;