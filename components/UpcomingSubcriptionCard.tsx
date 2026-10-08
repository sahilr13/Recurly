import { View, Text, Image } from 'react-native'
import React from 'react'
import { formatCurrency } from '../lib/utils'

const UpcomingSubcriptionCard = ({ name, price, daysLeft, icon, currency }: UpcomingSubscription) => {
  return (
    <View className='upcoming-card'>
      <View className='upcoming-row'>
        
        {/* New Wrapper View for the background and padding */}
        <View className="upcoming-icon-container">
          <Image 
            source={icon} 
            className="upcoming-icon" 
            resizeMode="contain" 
          />
        </View>

        <View>
          <Text className='upcoming-price'>{formatCurrency(price, currency)}</Text>
          <Text className='upcoming-meta' numberOfLines={1}>
            {daysLeft > 1 ? `${daysLeft} days left` : 'Last day'}
          </Text>
        </View>
      </View>
      <Text className="upcoming-name" numberOfLines={1}>{name}</Text>
    </View>
  )
}

export default UpcomingSubcriptionCard