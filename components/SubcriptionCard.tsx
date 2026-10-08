import { View, Text , Image, Pressable} from 'react-native'
import React from 'react'
import { formatCurrency , formatSubscriptionDateTime ,formatStatusLabel } from '../lib/utils'
import { colors } from '../constants/theme'
import clsx from 'clsx'

const SubcriptionCard = ( {name, price, currency, icon, billing, color, category, plan, renewalDate, expanded, onPress, paymentMethod, startDate, status}:
    SubscriptionCardProps
) => {
  return (
    <Pressable onPress={onPress} className={clsx('sub-card', expanded ? 'sub-card-expanded' : 'bg-card')} style={!expanded && color ? { backgroundColor: color } : undefined}>
        <View className="sub-head">
            <View className="sub-main">
                
                {/* New Wrapper View for the dynamic tinted background */}
                <View className="sub-icon-container">
                    <Image 
                    source={icon} 
                    className="sub-icon" 
                    resizeMode="contain" 
                    />
                </View>

                <View className="sub-copy">
                    <Text numberOfLines={1} className="sub-title">
                        {name}
                    </Text>
                    <Text numberOfLines={1} ellipsizeMode="tail" className="sub-meta">
                            {category?.trim() || plan?.trim() || (renewalDate ? formatSubscriptionDateTime(renewalDate) : '')}
                    </Text>
                </View>
            </View>

            <View className="sub-price-box">
                <Text className="sub-price">{formatCurrency(price, currency)}</Text>
                <Text className="sub-billing">{billing}</Text>
            </View>
        </View>

        {expanded && (
            <View className='sub-bdy'>
                <View className='sub-details'>
                    <View className='sub-row'>
                        <View className='sub-row-copy'>
                            <Text className='sub-label'>Payment:</Text>
                            <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">{paymentMethod?.trim() ?? 'Not provided'}</Text>
                        </View>
                    </View>
                    <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">Category:</Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">{(category?.trim() || plan?.trim()) ?? 'Not provided'}</Text>
                            </View>
                        </View>
                        <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">Started:</Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">{startDate ? formatSubscriptionDateTime(startDate) : 'Not provided'}</Text>
                            </View>
                        </View>
                        <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">Renewal date:</Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">{renewalDate ? formatSubscriptionDateTime(renewalDate) : 'Not provided'}</Text>
                            </View>
                        </View>
                        <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">Status:</Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">{status ? formatStatusLabel(status) : 'Not provided'}</Text>
                            </View>
                        </View>
                </View>
            </View>
        )}
    </Pressable>
    )
}

export default SubcriptionCard