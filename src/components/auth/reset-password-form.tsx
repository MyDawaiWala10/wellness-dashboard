"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { ForgotPasswordSchema, ResetPasswordSchema } from "@/schemas";
import { useForgotPassword, useResetPassword } from "@/data/user/user";

type RequestValues = z.infer<typeof ForgotPasswordSchema>;
type ResetValues = z.infer<typeof ResetPasswordSchema>;

export const ResetPasswordForm = () => {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { mutate: requestOtp, isPending: isRequesting } = useForgotPassword();
  const { mutate: doReset, isPending: isResetting } = useResetPassword();

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { userEmail: "" },
  });

  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      userEmail: "",
      otp: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onRequest = (values: RequestValues) => {
    requestOtp(values.userEmail, {
      onSuccess: (res) => {
        setEmail(values.userEmail);
        resetForm.reset({
          userEmail: values.userEmail,
          otp: "",
          newPassword: "",
          confirmPassword: "",
        });
        setStep("verify");
        toast.success(res.message);
      },
    });
  };

  const onReset = (values: ResetValues) => {
    doReset(
      {
        userEmail: values.userEmail,
        otp: values.otp,
        newPassword: values.newPassword,
      },
      {
        onSuccess: (res) => {
          toast.success(res.message);
          router.push("/auth/login");
        },
      },
    );
  };

  return (
    <Card className="p-6 w-full max-w-[500px]">
      {step === "request" ? (
        <Form {...requestForm}>
          <form method="post"
            onSubmit={requestForm.handleSubmit(onRequest)}
            className="space-y-6"
          >
            <div>
              <h1 className="text-lg font-semibold">Reset your password</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your account email and we&apos;ll send you a 6-digit code.
              </p>
            </div>
            <FormField
              control={requestForm.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="john.doe@example.com"
                      disabled={isRequesting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isRequesting} className="w-full">
              {isRequesting ? "Sending…" : "Send reset code"}
            </Button>
            <Button
              asChild
              variant="link"
              size="sm"
              className="px-0 font-normal"
            >
              <Link href="/auth/login">Back to login</Link>
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...resetForm}>
          <form method="post" onSubmit={resetForm.handleSubmit(onReset)} className="space-y-6">
            <div>
              <h1 className="text-lg font-semibold">Enter your code</h1>
              <p className="text-sm text-muted-foreground mt-1">
                We sent a code to <b>{email}</b>. It expires in 10 minutes.
              </p>
            </div>
            <FormField
              control={resetForm.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reset code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      disabled={isResetting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={resetForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="******"
                        disabled={isResetting}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowPassword((p) => !p)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={resetForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      placeholder="******"
                      disabled={isResetting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isResetting} className="w-full">
              {isResetting ? "Resetting…" : "Reset password"}
            </Button>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0 font-normal"
                onClick={() => setStep("request")}
                disabled={isResetting}
              >
                Use a different email
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0 font-normal"
                onClick={() => onRequest({ userEmail: email })}
                disabled={isRequesting || isResetting}
              >
                Resend code
              </Button>
            </div>
          </form>
        </Form>
      )}
    </Card>
  );
};
