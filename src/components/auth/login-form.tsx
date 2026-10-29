"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { useAuthStore } from "@/providers/permission-provider";
import { useLogin } from "@/data/user/user";
import { LoginSchema } from "@/schemas";

export const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const { mutate, isPending } = useLogin();

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      userEmailOrPhone: "",
      userPassword: "",
    },
  });

  const onSubmit = (values: z.infer<typeof LoginSchema>) => {
    mutate(values, {
      onSuccess: async (data) => {
        const u = data?.user;
        setUser(u);
          router.push("/dashboard");
      }
    });
  };

  return (
    <Card className="p-6 w-full max-w-[500px]">
      <Form {...form}>
        <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="userEmailOrPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={isPending}
                    type="email"
                    placeholder="john.doe@example.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="userPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>

                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      disabled={isPending}
                      type={showPassword ? "text" : "password"}
                      placeholder="******"
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

                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="px-0 font-normal"
                >
                  <Link href="/auth/reset">Forgot password?</Link>
                </Button>

                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Logging in..." : "Login"}
          </Button>
        </form>
      </Form>
    </Card>
  );
};
