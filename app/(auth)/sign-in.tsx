import { useSignIn } from "@clerk/clerk-expo";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { ReactNativeModal } from "react-native-modal";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons, images } from "@/constants";
import { fetchAPI } from "@/lib/fetch";

const SignIn = () => {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [form, setForm] = useState({
    vehicleNumber: "",
  });
  const [verification, setVerification] = useState({
    state: "default",
    error: "",
    code: "",
  });

  const onSignInPress = async () => {
    if (!isLoaded) {
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
        const signInAttempt = await signIn.create({
          identifier: `+91${response.contactNumber}`,
        });
        
        if (signInAttempt.status === "needs_first_factor") {
          // Get the phoneNumberId from the signInAttempt
          const phoneNumberId = signInAttempt?.supportedFirstFactors?.find(
            factor => factor.strategy === "phone_code"
          )?.phoneNumberId;

          if (!phoneNumberId) {
            throw new Error("Phone number ID not found");
          }
                
          // Prepare the OTP to be sent
          await signIn.prepareFirstFactor({
            strategy: "phone_code",
            phoneNumberId: phoneNumberId,
          });

          console.log('OTP sent');
          setVerification({
            ...verification,
            state: "pending",
          });
        } else {
          throw new Error("Unexpected sign-in status.");
        }
      } else {
        console.log('Vehicle not found');
        Alert.alert("Error", response.error || "Vehicle not found. Please check the vehicle number.");
      }
    } catch (err: any) {
      console.error('Error in onSignInPress:', JSON.stringify(err, null, 2));
      Alert.alert("Error", err.message || "An unexpected error occurred");
    }
  };
  

  const onPressVerify = async () => {
    if (!isLoaded) return;
    try {
      console.log('Attempting to verify OTP:', verification.code);
      const completeSignIn = await signIn.attemptFirstFactor({
        strategy: "phone_code",
        code: verification.code,
      });
      console.log('Verification response:', completeSignIn);
      if (completeSignIn.status === "complete") {
        await setActive({ session: completeSignIn.createdSessionId });
        setVerification({
          ...verification,
          state: "success",
        });
      } else {
        setVerification({
          ...verification,
          error: "Verification failed. Please try again.",
          state: "failed",
        });
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
            title="Sign In"
            onPress={onSignInPress}
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
              You have successfully signed in.
            </Text>
            <CustomButton
              title="Browse Home"
              onPress={() => router.push(`/(root)/(tabs)/home`)}
              className="mt-5"
            />
          </View>
        </ReactNativeModal>
        <Link
            href="/sign-up"
            className="text-lg text-center text-general-200 mt-10"
          >
            Don't have an account?{" "}
            <Text className="text-primary-500 text-blue-500">Sign Up</Text>
        </Link>
      </View>
    </ScrollView>
  );
};

export default SignIn;
