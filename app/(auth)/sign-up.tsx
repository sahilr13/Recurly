import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, useRouter, type Href } from 'expo-router';
import { useSignUp, useAuth } from '@clerk/expo';
import { useState } from 'react';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { styled } from 'nativewind';
import { Feather } from '@expo/vector-icons';
import AnimatedPressable from '../../components/AnimatedPressable';
import { posthog, posthogLog } from '../../lib/posthog';

const SafeAreaView = styled(RNSafeAreaView);

const SignUp = () => {
    const { signUp, errors, fetchStatus } = useSignUp();
    const { isSignedIn } = useAuth();
    const router = useRouter();

    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Validation states
    const [emailTouched, setEmailTouched] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);

    // Client-side validation
    const emailValid = emailAddress.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
    const passwordValid = password.length === 0 || password.length >= 8;
    const formValid = emailAddress.length > 0 && password.length >= 8 && emailValid;

    const handleSubmit = async () => {
        if (!formValid) return;
        setErrorMessage(null);

        const { error } = await signUp.password({
            emailAddress: emailAddress.trim(),
            password,
        });

        if (error) {
            const clerkErr = error as any;
            const message = 
                clerkErr?.errors?.[0]?.longMessage || 
                clerkErr?.errors?.[0]?.message || 
                clerkErr?.message || 
                'Could not create account. Please check your credentials.';
            setErrorMessage(message);
            return;
        }

        // Send verification email
        await signUp.verifications.sendEmailCode();
    };

    const handleVerify = async () => {
        setErrorMessage(null);

        const { error } = await signUp.verifications.verifyEmailCode({
            code: code.trim(),
        });

        if (error) {
            const clerkErr = error as any;
            const message = 
                clerkErr?.errors?.[0]?.longMessage || 
                clerkErr?.errors?.[0]?.message || 
                'Invalid verification code. Please check and try again.';
            setErrorMessage(message);
            return;
        }

        if (signUp.status === 'complete') {
            await signUp.finalize({
                navigate: ({ session, decorateUrl }) => {
                    if (session?.currentTask) return;

                    const url = decorateUrl('/(tabs)');
                    if (url.startsWith('http')) {
                        if (typeof window !== 'undefined' && window.location) {
                            window.location.href = url;
                        } else {
                            router.replace('/(tabs)' as Href);
                        }
                    } else {
                        router.replace(url as Href);
                    }
                },
            });
            posthog?.capture('user_signed_up');
            posthogLog.info('authentication completed', {
                auth_flow: 'email_sign_up',
            });
        } else {
            setErrorMessage('Sign-up incomplete. Please try again.');
        }
    };

    if (signUp.status === 'complete' || isSignedIn) {
        return null;
    }

    // Email Code Verification Screen
    if (
        signUp.status === 'missing_requirements' &&
        signUp.unverifiedFields.includes('email_address') &&
        signUp.missingFields.length === 0
    ) {
        return (
            <SafeAreaView className="flex-1 bg-background">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    className="flex-1"
                >
                    <ScrollView
                        className="flex-1"
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}
                    >
                        {/* Brand Emblem */}
                        <View className="items-center mb-6">
                            <View className="size-14 rounded-2xl bg-accent items-center justify-center mb-3 shadow-xs">
                                <Text className="text-2xl font-sans-extrabold text-white">R</Text>
                            </View>
                            <Text className="text-2xl font-sans-bold text-primary">Verify Your Email</Text>
                            <Text className="text-xs font-sans-medium text-muted-foreground mt-1 text-center">
                                We sent a 6-digit confirmation code to:
                            </Text>
                            <Text className="text-xs font-sans-bold text-primary mt-0.5">{emailAddress}</Text>
                        </View>

                        {/* Verification Card */}
                        <View className="bg-card rounded-3xl p-5 border border-border shadow-xs gap-4">
                            <View className="gap-1.5">
                                <Text className="text-xs font-sans-bold text-primary uppercase">Verification Code</Text>
                                <View className="bg-background rounded-2xl border border-border px-3.5 py-3 flex-row items-center gap-2.5">
                                    <Feather name="key" size={16} color="#999" />
                                    <TextInput
                                        className="flex-1 text-primary font-sans-bold text-base py-0 tracking-widest"
                                        value={code}
                                        placeholder="000000"
                                        placeholderTextColor="#999"
                                        onChangeText={(t) => {
                                            setCode(t);
                                            if (errorMessage) setErrorMessage(null);
                                        }}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        autoComplete="one-time-code"
                                    />
                                </View>
                            </View>

                            {errorMessage && (
                                <View className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex-row items-center gap-2">
                                    <Feather name="alert-circle" size={14} color="#dc2626" />
                                    <Text className="text-xs font-sans-medium text-destructive flex-1">{errorMessage}</Text>
                                </View>
                            )}

                            <AnimatedPressable
                                scaleTo={0.96}
                                onPress={handleVerify}
                                disabled={!code || fetchStatus === 'fetching'}
                                containerClassName={`bg-accent py-3.5 rounded-2xl items-center shadow-xs ${
                                    (!code || fetchStatus === 'fetching') && 'opacity-50'
                                }`}
                            >
                                <Text className="text-sm font-sans-bold text-white">
                                    {fetchStatus === 'fetching' ? 'Verifying...' : 'Verify & Continue'}
                                </Text>
                            </AnimatedPressable>

                            <Pressable
                                onPress={() => signUp.verifications.sendEmailCode()}
                                className="py-2 items-center active:opacity-70"
                                disabled={fetchStatus === 'fetching'}
                            >
                                <Text className="text-xs font-sans-bold text-accent">Resend Email Code</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // Standard Sign-Up Form
    return (
        <SafeAreaView className="flex-1 bg-background">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 }}
                >
                    {/* Header */}
                    <View className="items-center mb-6">
                        <View className="flex-row items-center gap-2.5 mb-3">
                            <View className="size-12 rounded-2xl bg-accent items-center justify-center shadow-xs">
                                <Text className="text-2xl font-sans-extrabold text-white">R</Text>
                            </View>
                            <View>
                                <Text className="text-2xl font-sans-extrabold text-primary leading-tight">Recurrly</Text>
                                <Text className="text-[10px] font-sans-bold tracking-widest text-muted-foreground uppercase -mt-0.5">
                                    VAULT & FINANCE
                                </Text>
                            </View>
                        </View>
                        <Text className="text-2xl font-sans-bold text-primary">Create Your Account</Text>
                        <Text className="text-xs font-sans-medium text-muted-foreground mt-0.5 text-center">
                            Track recurring subscriptions, expenses, and banking health
                        </Text>
                    </View>

                    {/* Form Card */}
                    <View className="bg-card rounded-3xl p-5 border border-border shadow-xs gap-4 mb-5">
                        {/* Email Input */}
                        <View className="gap-1.5">
                            <Text className="text-xs font-sans-bold text-primary uppercase">Email Address</Text>
                            <View className={`bg-background rounded-2xl border px-3.5 py-3 flex-row items-center gap-2.5 ${
                                emailTouched && !emailValid ? 'border-destructive' : 'border-border'
                            }`}>
                                <Feather name="mail" size={16} color="#999" />
                                <TextInput
                                    className="flex-1 text-primary font-sans-medium text-sm py-0"
                                    autoCapitalize="none"
                                    value={emailAddress}
                                    placeholder="name@example.com"
                                    placeholderTextColor="#999"
                                    onChangeText={(t) => {
                                        setEmailAddress(t);
                                        if (errorMessage) setErrorMessage(null);
                                    }}
                                    onBlur={() => setEmailTouched(true)}
                                    keyboardType="email-address"
                                    autoComplete="email"
                                />
                            </View>
                            {emailTouched && !emailValid && (
                                <Text className="text-[11px] font-sans-medium text-destructive px-1">
                                    Please enter a valid email address
                                </Text>
                            )}
                            {errors.fields.emailAddress && (
                                <Text className="text-[11px] font-sans-medium text-destructive px-1">
                                    {errors.fields.emailAddress.message}
                                </Text>
                            )}
                        </View>

                        {/* Password Input */}
                        <View className="gap-1.5">
                            <Text className="text-xs font-sans-bold text-primary uppercase">Password</Text>
                            <View className={`bg-background rounded-2xl border px-3.5 py-3 flex-row items-center gap-2.5 ${
                                passwordTouched && !passwordValid ? 'border-destructive' : 'border-border'
                            }`}>
                                <Feather name="lock" size={16} color="#999" />
                                <TextInput
                                    className="flex-1 text-primary font-sans-medium text-sm py-0"
                                    value={password}
                                    placeholder="Create a strong password (min 8 chars)"
                                    placeholderTextColor="#999"
                                    secureTextEntry={!showPassword}
                                    onChangeText={(t) => {
                                        setPassword(t);
                                        if (errorMessage) setErrorMessage(null);
                                    }}
                                    onBlur={() => setPasswordTouched(true)}
                                    autoComplete="password-new"
                                />
                                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                                    <Feather 
                                        name={showPassword ? "eye" : "eye-off"} 
                                        size={16} 
                                        color="#999" 
                                    />
                                </Pressable>
                            </View>
                            {passwordTouched && !passwordValid && (
                                <Text className="text-[11px] font-sans-medium text-destructive px-1">
                                    Password must be at least 8 characters
                                </Text>
                            )}
                            {errors.fields.password && (
                                <Text className="text-[11px] font-sans-medium text-destructive px-1">
                                    {errors.fields.password.message}
                                </Text>
                            )}
                        </View>

                        {/* Error Banner */}
                        {errorMessage && (
                            <View className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex-row items-center gap-2">
                                <Feather name="alert-circle" size={14} color="#dc2626" />
                                <Text className="text-xs font-sans-medium text-destructive flex-1">{errorMessage}</Text>
                            </View>
                        )}

                        {/* Submit Button */}
                        <AnimatedPressable
                            scaleTo={0.97}
                            onPress={handleSubmit}
                            disabled={!formValid || fetchStatus === 'fetching'}
                            containerClassName={`bg-accent py-3.5 rounded-2xl items-center shadow-xs mt-1 ${
                                (!formValid || fetchStatus === 'fetching') && 'opacity-50'
                            }`}
                        >
                            <Text className="text-sm font-sans-bold text-white">
                                {fetchStatus === 'fetching' ? 'Creating Account...' : 'Create Account'}
                            </Text>
                        </AnimatedPressable>
                    </View>

                    {/* Footer Nav Link */}
                    <View className="flex-row items-center justify-center gap-1.5">
                        <Text className="text-xs font-sans-medium text-muted-foreground">
                            Already have an account?
                        </Text>
                        <Link href="/(auth)/sign-in" asChild>
                            <Pressable hitSlop={10}>
                                <Text className="text-xs font-sans-bold text-accent">Sign In</Text>
                            </Pressable>
                        </Link>
                    </View>

                    {/* Clerk Captcha Anchor */}
                    <View nativeID="clerk-captcha" />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SignUp;