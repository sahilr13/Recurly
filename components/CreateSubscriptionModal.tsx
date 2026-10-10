import { View, Text, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { Feather } from '@expo/vector-icons';
import { posthog } from "../lib/posthog";

interface CreateSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (subscription: Subscription) => void;
  initialData?: Subscription | null;
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

const calculateUpcomingRenewal = (start: string, freq: Frequency): string => {
  let date = dayjs(start).isValid() ? dayjs(start) : dayjs();
  const today = dayjs().startOf('day');
  const stepMonths = freq === 'Monthly' ? 1 : freq === 'Quarterly' ? 3 : 12;

  if (date.isAfter(today)) return date.format('YYYY-MM-DD');

  while (date.isBefore(today)) {
    date = date.add(stepMonths, 'month');
  }

  return date.format('YYYY-MM-DD');
};

const CreateSubscriptionModal = ({ visible, onClose, onSubmit, initialData }: CreateSubscriptionModalProps) => {
  const isEditing = !!initialData;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [frequency, setFrequency] = useState<Frequency>('Monthly');
  const [category, setCategory] = useState<Category>('Other');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [renewalDate, setRenewalDate] = useState(dayjs().add(1, 'month').format('YYYY-MM-DD'));
  const [isManualRenewal, setIsManualRenewal] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPrice(String(initialData.price));
      setCurrency((initialData.currency as Currency) || 'INR');
      setFrequency((initialData.frequency as Frequency) || 'Monthly');
      setCategory((initialData.category as Category) || 'Other');
      setStartDate(initialData.startDate ? dayjs(initialData.startDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'));
      setRenewalDate(initialData.renewalDate ? dayjs(initialData.renewalDate).format('YYYY-MM-DD') : dayjs().add(1, 'month').format('YYYY-MM-DD'));
      setIsManualRenewal(true);
    } else {
      resetForm();
    }
  }, [initialData, visible]);

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
    if (!isManualRenewal) {
      setRenewalDate(calculateUpcomingRenewal(startDate, newFreq));
    }
  };

  const handleStartDateChange = (text: string) => {
    setStartDate(text);
    if (!isManualRenewal && text.trim().length === 10 && dayjs(text).isValid()) {
      setRenewalDate(calculateUpcomingRenewal(text, frequency));
    }
  };

  const handleSubmit = () => {
    if (!isValidForm) return;

    const priceValue = Number(price.trim());
    const validStart = dayjs(startDate).isValid() ? dayjs(startDate) : dayjs();
    const validRenewal = dayjs(renewalDate).isValid()
      ? dayjs(renewalDate)
      : dayjs(calculateUpcomingRenewal(startDate, frequency));

    const subscription: Subscription = {
      ...(initialData || {}),
      id: initialData?.id || `sub-${Date.now()}`,
      name: name.trim(),
      price: priceValue,
      currency,
      frequency,
      category,
      status: initialData?.status || 'active',
      startDate: validStart.toISOString(),
      renewalDate: validRenewal.toISOString(),
      billing: frequency,
      color: CATEGORY_COLORS[category],
    };

    onSubmit(subscription);

    posthog?.capture(isEditing ? 'subscription_updated' : 'subscription_created', {
      subscription_name: name.trim(),
      subscription_price: priceValue,
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable className="modal-overlay" onPress={handleClose}>
          <Pressable className="modal-container bg-background rounded-t-3xl border-t border-border" onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border px-5 py-3.5">
              <Text className="text-lg font-sans-bold text-primary">
                {isEditing ? 'Edit Subscription' : 'New Subscription'}
              </Text>
              <Pressable 
                className="size-8 items-center justify-center rounded-full bg-black/5 active:opacity-70" 
                onPress={handleClose}
              >
                <Feather name="x" size={16} color="#081126" />
              </Pressable>
            </View>

            <ScrollView
              className="p-5"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14, paddingBottom: 40 }}
            >
              {/* Name */}
              <View className="gap-1.5">
                <Text className="text-xs font-sans-bold text-primary uppercase">Service Name</Text>
                <TextInput
                  className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-sans-medium text-primary"
                  placeholder="e.g. Netflix, YouTube Premium"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Currency Picker */}
              <View className="gap-1.5">
                <Text className="text-xs font-sans-bold text-primary uppercase">Currency</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    className={clsx(
                      'flex-1 items-center py-2.5 rounded-xl border',
                      currency === 'INR' ? 'bg-primary border-primary' : 'bg-card border-border'
                    )}
                    onPress={() => setCurrency('INR')}
                  >
                    <Text className={clsx('text-xs font-sans-bold', currency === 'INR' ? 'text-white' : 'text-primary')}>
                      ₹ INR (Rupees)
                    </Text>
                  </Pressable>
                  <Pressable
                    className={clsx(
                      'flex-1 items-center py-2.5 rounded-xl border',
                      currency === 'USD' ? 'bg-primary border-primary' : 'bg-card border-border'
                    )}
                    onPress={() => setCurrency('USD')}
                  >
                    <Text className={clsx('text-xs font-sans-bold', currency === 'USD' ? 'text-white' : 'text-primary')}>
                      $ USD (Dollar)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Price */}
              <View className="gap-1.5">
                <Text className="text-xs font-sans-bold text-primary uppercase">
                  Price ({currency === 'INR' ? '₹' : '$'})
                </Text>
                <TextInput
                  className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-sans-medium text-primary"
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Frequency */}
              <View className="gap-1.5">
                <Text className="text-xs font-sans-bold text-primary uppercase">Billing Cycle</Text>
                <View className="flex-row gap-2">
                  {(['Monthly', 'Quarterly', 'Yearly'] as Frequency[]).map((freq) => (
                    <Pressable
                      key={freq}
                      className={clsx(
                        'flex-1 items-center py-2.5 rounded-xl border',
                        frequency === freq ? 'bg-primary border-primary' : 'bg-card border-border'
                      )}
                      onPress={() => handleFrequencyChange(freq)}
                    >
                      <Text className={clsx('text-xs font-sans-bold', frequency === freq ? 'text-white' : 'text-primary')}>
                        {freq}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Dates */}
              <View className="flex-row gap-2.5">
                <View className="flex-1 gap-1.5">
                  <Text className="text-xs font-sans-bold text-primary uppercase">Started On</Text>
                  <TextInput
                    className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-sans-medium text-primary"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#999"
                    value={startDate}
                    onChangeText={handleStartDateChange}
                  />
                </View>

                <View className="flex-1 gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-sans-bold text-primary uppercase">Next Due</Text>
                    {isManualRenewal && (
                      <Pressable onPress={() => {
                        setRenewalDate(calculateUpcomingRenewal(startDate, frequency));
                        setIsManualRenewal(false);
                      }}>
                        <Text className="text-[10px] font-sans-bold text-accent">Auto-fill</Text>
                      </Pressable>
                    )}
                  </View>
                  <TextInput
                    className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-sans-medium text-primary"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#999"
                    value={renewalDate}
                    onChangeText={(t) => {
                      setRenewalDate(t);
                      setIsManualRenewal(true);
                    }}
                  />
                </View>
              </View>

              {/* Category */}
              <View className="gap-1.5">
                <Text className="text-xs font-sans-bold text-primary uppercase">Category</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      className={clsx(
                        'rounded-xl border px-3 py-2',
                        category === cat ? 'bg-primary border-primary' : 'bg-card border-border'
                      )}
                      onPress={() => setCategory(cat)}
                    >
                      <Text className={clsx('text-xs font-sans-semibold', category === cat ? 'text-white' : 'text-primary')}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                className={clsx(
                  'mt-2 items-center rounded-2xl bg-accent py-3.5 shadow-xs',
                  !isValidForm && 'opacity-50'
                )}
                onPress={handleSubmit}
                disabled={!isValidForm}
              >
                <Text className="text-sm font-sans-bold text-white">
                  {isEditing ? 'Save Changes' : 'Create Subscription'}
                </Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default CreateSubscriptionModal;