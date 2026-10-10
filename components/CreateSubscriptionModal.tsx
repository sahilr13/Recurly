import { View, Text, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import React, { useState } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { posthog } from "../lib/posthog";

interface CreateSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (subscription: Subscription) => void;
}

type Frequency = 'Monthly' | 'Quarterly' | 'Yearly';
type Currency = 'INR' | 'USD';
type Category = 'Entertainment' | 'AI Tools' | 'Developer Tools' | 'Design' | 'Productivity' | 'Other';

const CATEGORIES: Category[] = ['Entertainment', 'AI Tools', 'Developer Tools', 'Design', 'Productivity', 'Other'];
const CATEGORY_COLORS: Record<Category, string> = {
  'Entertainment': '#ff6b6b',
  'AI Tools': '#b8d4e3',
  'Developer Tools': '#e8def8',
  'Design': '#f5c542',
  'Productivity': '#95e1d3',
  'Other': '#d4d4d4',
};

// Rolls forward past start dates cycle-by-cycle until it reaches the next upcoming date
const calculateUpcomingRenewal = (start: string, freq: Frequency): string => {
  let date = dayjs(start).isValid() ? dayjs(start) : dayjs();
  const today = dayjs().startOf('day');
  const stepMonths = freq === 'Monthly' ? 1 : freq === 'Quarterly' ? 3 : 12;

  // If the date is in the future, that is the renewal
  if (date.isAfter(today)) {
    return date.format('YYYY-MM-DD');
  }

  // Roll forward until it falls on or after today
  while (date.isBefore(today)) {
    date = date.add(stepMonths, 'month');
  }

  return date.format('YYYY-MM-DD');
};

const CreateSubscriptionModal = ({ visible, onClose, onSubmit }: CreateSubscriptionModalProps) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [frequency, setFrequency] = useState<Frequency>('Monthly');
  const [category, setCategory] = useState<Category>('Other');

  // Start Date defaults to today; Renewal Date defaults to the next cycle
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [renewalDate, setRenewalDate] = useState(dayjs().add(1, 'month').format('YYYY-MM-DD'));
  const [isManualRenewal, setIsManualRenewal] = useState(false);

  const isValidPrice = () => {
    const trimmed = price.trim();
    if (!trimmed) return false;
    if (!/^\s*[+-]?(\d+(\.\d+)?|\.\d+)\s*$/.test(trimmed)) return false;
    const num = Number(trimmed);
    return Number.isFinite(num) && num > 0;
  };

  const isValidForm = name.trim() !== '' && isValidPrice();

  const handleFrequencyChange = (newFreq: Frequency) => {
    setFrequency(newFreq);
    // Only auto-recalculate if user hasn't explicitly customized the renewal date
    if (!isManualRenewal) {
      setRenewalDate(calculateUpcomingRenewal(startDate, newFreq));
    }
  };

  const handleStartDateChange = (text: string) => {
    setStartDate(text);
    // If user enters a full valid YYYY-MM-DD and hasn't manually overridden renewal date
    if (!isManualRenewal && text.trim().length === 10 && dayjs(text).isValid()) {
      setRenewalDate(calculateUpcomingRenewal(text, frequency));
    }
  };

  const handleRenewalDateChange = (text: string) => {
    setRenewalDate(text);
    setIsManualRenewal(true);
  };

  const handleAutoRecalculate = () => {
    const calculated = calculateUpcomingRenewal(startDate, frequency);
    setRenewalDate(calculated);
    setIsManualRenewal(false);
  };

  const handleSubmit = () => {
    if (!isValidForm) return;

    const priceValue = Number(price.trim());
    const validStart = dayjs(startDate).isValid() ? dayjs(startDate) : dayjs();
    const validRenewal = dayjs(renewalDate).isValid()
      ? dayjs(renewalDate)
      : dayjs(calculateUpcomingRenewal(startDate, frequency));

    const newSubscription: Subscription = {
      id: `sub-${Date.now()}`,
      name: name.trim(),
      price: priceValue,
      currency,
      frequency,
      category,
      status: 'active',
      startDate: validStart.toISOString(),
      renewalDate: validRenewal.toISOString(),
      billing: frequency,
      color: CATEGORY_COLORS[category],
    };

    onSubmit(newSubscription);

    posthog?.capture('subscription_created', {
      subscription_name: name.trim(),
      subscription_price: priceValue,
      subscription_currency: currency,
      subscription_frequency: frequency,
      subscription_category: category,
    });

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setCurrency('INR');
    setFrequency('Monthly');
    setCategory('Other');
    setIsManualRenewal(false);
    const today = dayjs().format('YYYY-MM-DD');
    setStartDate(today);
    setRenewalDate(dayjs(today).add(1, 'month').format('YYYY-MM-DD'));
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <Pressable className="modal-overlay" onPress={handleClose}>
          <Pressable className="modal-container" onPress={(e) => e.stopPropagation()}>
            <View className="modal-header">
              <Text className="modal-title">New Subscription</Text>
              <Pressable className="modal-close" onPress={handleClose}>
                <Text className="modal-close-text">✕</Text>
              </Pressable>
            </View>

            <ScrollView
              className="p-5"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 16, paddingBottom: 30 }}
            >
              {/* Name */}
              <View className="auth-field">
                <Text className="auth-label">Name</Text>
                <TextInput
                  className="auth-input"
                  placeholder="e.g. Netflix, Jio Hotstar"
                  placeholderTextColor="rgba(0, 0, 0, 0.4)"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Currency Selector */}
              <View className="auth-field">
                <Text className="auth-label">Currency</Text>
                <View className="picker-row">
                  <Pressable
                    className={clsx('picker-option', currency === 'INR' && 'picker-option-active')}
                    onPress={() => setCurrency('INR')}
                  >
                    <Text className={clsx('picker-option-text', currency === 'INR' && 'picker-option-text-active')}>
                      ₹ INR (Rupees)
                    </Text>
                  </Pressable>
                  <Pressable
                    className={clsx('picker-option', currency === 'USD' && 'picker-option-active')}
                    onPress={() => setCurrency('USD')}
                  >
                    <Text className={clsx('picker-option-text', currency === 'USD' && 'picker-option-text-active')}>
                      $ USD (Dollars)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Price */}
              <View className="auth-field">
                <Text className="auth-label">Price ({currency === 'INR' ? '₹' : '$'})</Text>
                <TextInput
                  className="auth-input"
                  placeholder="0.00"
                  placeholderTextColor="rgba(0, 0, 0, 0.4)"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Frequency */}
              <View className="auth-field">
                <Text className="auth-label">Frequency</Text>
                <View className="picker-row">
                  {(['Monthly', 'Quarterly', 'Yearly'] as Frequency[]).map((freq) => (
                    <Pressable
                      key={freq}
                      className={clsx('picker-option', frequency === freq && 'picker-option-active')}
                      onPress={() => handleFrequencyChange(freq)}
                    >
                      <Text className={clsx('picker-option-text', frequency === freq && 'picker-option-text-active')}>
                        {freq}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Date Inputs */}
              <View className="gap-3">
                <View className="flex-row gap-3">
                  {/* Start Date */}
                  <View className="auth-field flex-1">
                    <Text className="auth-label">Started On</Text>
                    <TextInput
                      className="auth-input"
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="rgba(0, 0, 0, 0.4)"
                      value={startDate}
                      onChangeText={handleStartDateChange}
                    />
                  </View>

                  {/* Next Renewal Date */}
                  <View className="auth-field flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="auth-label">Next Renewal</Text>
                      {isManualRenewal && (
                        <Pressable onPress={handleAutoRecalculate}>
                          <Text className="text-[11px] font-sans-bold text-accent">Reset</Text>
                        </Pressable>
                      )}
                    </View>
                    <TextInput
                      className="auth-input"
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="rgba(0, 0, 0, 0.4)"
                      value={renewalDate}
                      onChangeText={handleRenewalDateChange}
                    />
                  </View>
                </View>
                <Text className="text-xs text-muted-foreground -mt-1">
                  Tip: Set "Next Renewal" directly to your actual upcoming charge date.
                </Text>
              </View>

              {/* Category */}
              <View className="auth-field">
                <Text className="auth-label">Category</Text>
                <View className="category-scroll">
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      className={clsx('category-chip', category === cat && 'category-chip-active')}
                      onPress={() => setCategory(cat)}
                    >
                      <Text className={clsx('category-chip-text', category === cat && 'category-chip-text-active')}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                className={clsx('auth-button mt-2', !isValidForm && 'auth-button-disabled')}
                onPress={handleSubmit}
                disabled={!isValidForm}
              >
                <Text className="auth-button-text">Create Subscription</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CreateSubscriptionModal;