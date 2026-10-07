import { View, Text } from 'react-native'
import React from 'react'
import { Link, useLocalSearchParams } from 'expo-router'

const SubscriptionDetails = () => {
    const {id} = useLocalSearchParams<{ id: String }>();
  return (
    <View>
      <Text>Subscription Details</Text>
      <Link href="/">Go Back</Link>
    </View>
  )
}

export default SubscriptionDetails