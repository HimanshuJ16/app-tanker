import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { ReactNativeModal } from "react-native-modal";
import * as SecureStore from 'expo-secure-store';

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons, images } from "@/constants";
import { fetchAPI } from "@/lib/fetch";

export default function CombinedAuth() {
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAccountIssueModal, setShowAccountIssueModal] = useState(false);

  const [form, setForm] = useState({
    vehicleNumber: "",
  });
  const [verification, setVerification] = useState({
    state: "default",
    error: "",
    code: "",
  });
  const [vehicleInfo, setVehicleInfo] = useState({
    vehicleNumber: "",
    vehicleId: "",
  });

  const saveVehicleInfo = async (info: { vehicleNumber: string; vehicleId: string }) => {
    try {
      await SecureStore.setItemAsync('vehicleInfo', JSON.stringify(info));
    } catch (error) {
      console.error('Error saving vehicle info:', error);
    }
  };

  const onAuthPress = async () => {
    if (!isSignInLoaded || !isSignUpLoaded) {
      console.log('Clerk is not loaded yet');
      return;
    }
    try {
      console.log('Attempting to check vehicle:', form.vehicleNumber);
      const response = await fetchAPI("/vehicle", {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: form.vehicleNumber,
        }),
      });
      console.log('Vehicle check response:', response);

      if (response.exists) {
        console.log('Vehicle exists, initiating OTP verification');
        const phoneNumber = `+91${response.contactNumber}`;
        
        // Store vehicle information temporarily
        setVehicleInfo({
          vehicleNumber: form.vehicleNumber,
          vehicleId: response.vehicleId,
        });

        try {
          // Try to sign in
          const signInAttempt = await signIn.create({
            identifier: phoneNumber,
          });
          const phoneNumberId = signInAttempt?.supportedFirstFactors?.find(
            factor => factor.strategy === "phone_code"
          )?.phoneNumberId;

          if (!phoneNumberId) {
            throw new Error("Phone number ID not found");
          }
          await signIn.prepareFirstFactor({
            strategy: "phone_code",
            phoneNumberId: phoneNumberId,
          });
          setVerification({ ...verification, state: "pending" });
        } catch (signInError: any) {
          console.log('Sign in failed:', signInError);
          
          // Attempt sign up as a fallback
          try {
            await signUp.create({
              phoneNumber,
            });
            await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
            setVerification({ ...verification, state: "pending" });
          } catch (signUpError: any) {
            console.error('Sign up failed:', signUpError);
            // Both sign-in and sign-up failed, show account issue modal
            setShowAccountIssueModal(true);
          }
        }
      } else {
        console.log('Vehicle not found');
        Alert.alert("Error", response.error || "Vehicle not found. Please check the vehicle number.");
      }
    } catch (err: any) {
      console.error('Error in onAuthPress:', err);
      if (err.message.includes('Failed to parse response as JSON')) {
        Alert.alert("Error", "There was a problem with the server response. Please try again later.");
      } else if (err.message.includes('HTTP error!')) {
        Alert.alert("Error", "There was a problem connecting to the server. Please check your internet connection and try again.");
      } else {
        Alert.alert("Error", err.message || "An unexpected error occurred");
      }
    }
  };

  const onPressVerify = async () => {
    if (!isSignInLoaded || !isSignUpLoaded) return;
    try {
      console.log('Attempting to verify OTP:', verification.code);
      let completeAuth;
      try {
        // Try sign in verification first
        completeAuth = await signIn.attemptFirstFactor({
          strategy: "phone_code",
          code: verification.code,
        });
        if (completeAuth.status === "complete") {
          await setSignInActive({ session: completeAuth.createdSessionId });
          // Save vehicle info after successful verification
          await saveVehicleInfo(vehicleInfo);
        }
      } catch (signInError) {
        // If sign in verification fails, try sign up verification
        completeAuth = await signUp.attemptPhoneNumberVerification({
          code: verification.code,
        });
        if (completeAuth.status === "complete") {
          await setSignUpActive({ session: completeAuth.createdSessionId });
        }
      }

      if (completeAuth.status === "complete") {
        setVerification({
          ...verification,
          state: "success",
        });
      } else {
        throw new Error("Verification failed");
      }
    } catch (err: any) {
      console.error('Error in onPressVerify:', JSON.stringify(err, null, 2));
      setVerification({
        ...verification,
        error: err.errors?.[0]?.longMessage || "Verification failed",
        state: "failed",
      });
    }
  };

  const handleAccountIssue = () => {
    console.log("Initiating account recovery process");
    Alert.alert(
      "Account Recovery",
      "We've initiated the account recovery process. Our support team will contact you shortly to resolve this issue.",
      [{ text: "OK", onPress: () => setShowAccountIssueModal(false) }]
    );
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        <View className="relative w-full h-[250px]">
          <Image source={images.signUpCar} className="z-0 w-full h-[250px]" />
          <Text className="text-2xl text-black font-JakartaSemiBold absolute bottom-5 left-5">
            Welcome 👋
          </Text>
        </View>
        <View className="p-5">
          <InputField
            label="Vehicle Number"
            placeholder="Enter vehicle number"
            icon={icons.person}
            value={form.vehicleNumber}
            onChangeText={(value) => setForm({ ...form, vehicleNumber: value })}
          />
          <CustomButton
            title="Continue"
            onPress={onAuthPress}
            className="mt-6"
          />
        </View>
        <ReactNativeModal
          isVisible={verification.state === "pending"}
          onModalHide={() => {
            if (verification.state === "success") {
              setShowSuccessModal(true);
            }
          }}
        >
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Text className="font-JakartaExtraBold text-2xl mb-2">
              Verification
            </Text>
            <Text className="font-Jakarta mb-5">
              We've sent a verification code to your registered phone number.
            </Text>
            <InputField
              label={"Code"}
              icon={icons.lock}
              placeholder={"123456"}
              value={verification.code}
              keyboardType="numeric"
              onChangeText={(code) =>
                setVerification({ ...verification, code })
              }
            />
            {verification.error && (
              <Text className="text-red-500 text-sm mt-1">
                {verification.error}
              </Text>
            )}
            <CustomButton
              title="Verify OTP"
              onPress={onPressVerify}
              className="mt-5 bg-success-500"
            />
          </View>
        </ReactNativeModal>
        <ReactNativeModal isVisible={showSuccessModal}>
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Image
              source={images.check}
              className="w-[110px] h-[110px] mx-auto my-5"
            />
            <Text className="text-3xl font-JakartaBold text-center">
              Verified
            </Text>
            <Text className="text-base text-gray-400 font-Jakarta text-center mt-2">
              You have successfully authenticated.
            </Text>
            <CustomButton
              title="Browse Home"
              onPress={() => router.push(`/(root)/(tabs)/home`)}
              className="mt-5"
            />
          </View>
        </ReactNativeModal>
        <ReactNativeModal isVisible={showAccountIssueModal}>
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Text className="font-JakartaExtraBold text-2xl mb-2">
              Account Issue Detected
            </Text>
            <Text className="font-Jakarta mb-5">
              We're having trouble accessing your account. This could be due to a discrepancy in our records.
            </Text>
            <CustomButton
              title="Initiate Account Recovery"
              onPress={handleAccountIssue}
              className="mt-5 bg-warning-500"
            />
            <CustomButton
              title="Cancel"
              onPress={() => setShowAccountIssueModal(false)}
              className="mt-3"
            />
          </View>
        </ReactNativeModal>
      </View>
    </ScrollView>
  );
}