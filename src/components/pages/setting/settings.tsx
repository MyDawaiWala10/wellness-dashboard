"use client";

import Image from "next/image";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Avatar from "@/assests/avatars/avatar1.svg";
import { useEffect, useState } from "react";

import { UserRow } from "@/schemas";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import Loader from "@/components/loader";
import UserDialog from "./AddUserForm";
import { QueryWrapper } from "@/components/query-wrapper";
import { UserDataTable } from "./user-data-table";
import { useGetAllUsers, useUpdateUserProfile } from "@/data/user/user";
import { useAuthStore } from "@/providers/permission-provider";
import { SettingsSchema } from "@/type/schema";
import { userColumns as columns } from "./user-column";
import { DOBPicker } from "@/components/DOB-picker";
import { useGetClinicSettings, useUpdateClinicSettings } from "@/data/clinic-settings/clinic-settings";

function BookingGapCard() {
  const { data } = useGetClinicSettings();
  const { mutate, isPending } = useUpdateClinicSettings();
  const [value, setValue] = useState<string>("");
  useEffect(() => {
    if (data) setValue(String(data.bookingGapMinutes));
  }, [data]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Booking gap</CardTitle>
        <CardDescription>
          Minimum minutes between a therapist&apos;s visits. Booking inside this
          gap warns but can be overridden.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Minutes</label>
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          disabled={isPending || value === "" || Number(value) < 0}
          onClick={() => mutate({ bookingGapMinutes: Number(value) })}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}

const SettingsPageComponents = () => {
  const{user} = useAuthStore()
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const [open, setOpen] = useState(false);
  const { data, isLoading,isError,error,refetch } = useGetAllUsers();
  const { mutate, isPending } = useUpdateUserProfile();
  const form = useForm<z.infer<typeof SettingsSchema>>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: {
      userfName: user?.userfName || "",
      userlName: user?.userlName || "",
      userPhone: user?.userPhone || "",
      userEmail: user?.userEmail || "",
      dob: user?.dob || "",
      gender: user?.gender || "",
    },
  });
  useEffect(() => {
    if (user) {
      form.reset({
        userfName: user.userfName || "",
        userlName: user.userlName || "",
        userPhone: user.userPhone || "",
        userEmail: user.userEmail || "",
        dob: user.dob || "",
        gender: user.gender || "",
      });
    }
  }, [user, form]);

  const onSubmit = (values: UserRow) => {
    mutate(
      { user: values },
      {
        onSettled: () => {
          setOpen(false);
        },
      },
    );
  };

  return (
    <div className="w-full min-h-screen px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="w-full lg:col-span-3">
            <CardHeader className="flex flex-col items-center text-center gap-4">
              <Image
                src={Avatar}
                width={160}
                height={160}
                alt="Avatar"
                className="rounded-full bg-muted"
              />

              <CardTitle className="text-2xl font-semibold">
                {user?.userfName} {user?.userlName}
              </CardTitle>

              <CardDescription>{user?.userEmail}</CardDescription>

              <Badge className="mt-2">{user?.role}</Badge>
            </CardHeader>

            <CardContent>
              <Dialog onOpenChange={setOpen} open={open}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Edit Profile
                  </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Edit profile</DialogTitle>
                    <DialogDescription>
                      Make changes to your profile here. Click save when done.
                    </DialogDescription>
                  </DialogHeader>

                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="userfName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={isPending} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="userlName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={isPending} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="userEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={isPending} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="userPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <PhoneInput {...field} asString disabled={isPending} placeholder="10-digit phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Gender</FormLabel>

                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-wrap gap-6"
                              >
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <RadioGroupItem value="Male" />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Male
                                  </FormLabel>
                                </FormItem>

                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <RadioGroupItem value="Female" />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    Female
                                  </FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dob"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of birth</FormLabel>

                            <DOBPicker
                              value={field.value}
                              onChange={field.onChange}
                            />

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={isPending}
                        className="w-full"
                      >
                        Save changes
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          {isAdmin && (
            <>
              <div className="lg:col-span-9 flex flex-col gap-6">
                <BookingGapCard />
              </div>
              <Card className="lg:col-span-12">
                <CardHeader className="flex flex-row justify-start items-center gap-2">
                  <div className="flex flex-col gap-2">
                    <CardTitle>Admin Members</CardTitle>
                    <CardDescription>
                      View or manage users with dashboard access.
                    </CardDescription>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <UserDialog/>
                  </div>
                </CardHeader>
                <CardContent>
                  <QueryWrapper isError={isError} isLoading={isLoading} error={error} onRetry={refetch}>
                  <UserDataTable columns={columns} data={data?.users??[]} />
                  </QueryWrapper>
                </CardContent>
              </Card>
            </>
          )}
      </div>
    </div>
  );
};

export default SettingsPageComponents;
