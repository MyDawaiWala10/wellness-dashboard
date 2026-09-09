// therapist-details-page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, X, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useUpdateTherapist } from "@/data/therapist/therapist";
import {
  useAddSpecialization,
  useGetSpecializations,
} from "@/data/specializations/specializations";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TherapistformSchema, TherapistformType } from "@/type/schema";
import { ProfilePicUploader } from "./profile-pic-uploader";
import { CertificatesSection } from "./certificates-section";
import { TherapistEarningsTab } from "./therapist-earnings-tab";
import { TherapistReferralsTab } from "./therapist-referrals-tab";
import { TherapistAvailabilityTab } from "./therapist-availability-tab";

interface TherapistDetailsPageProps {
  data: TherapistformType;
  onClose: () => void;
  onRequestDelete: () => void;
  isDeleting: boolean;
  hideDelete?: boolean;
  hideStatus?: boolean;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export default function TherapistDetailsPage({
  data,
  onClose,
  onRequestDelete,
  isDeleting,
  hideDelete = false,
  hideStatus = false,
}: TherapistDetailsPageProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState("profile");

  const { mutate: updateMutate, isPending: isUpdating } = useUpdateTherapist();
  const {
    data: specializations = [],
    isLoading: isLoadingSpecializations,
  } = useGetSpecializations();
  const addSpecializationMutation = useAddSpecialization();

  const form = useForm<z.infer<typeof TherapistformSchema>>({
    resolver: zodResolver(TherapistformSchema),
    defaultValues: {
      name: data.name,
      doctorId: data.doctorId,
      phonenumber: data.phonenumber != null ? String(data.phonenumber) : "",
      email: data.email,
      isActive: data.isActive,
      specialization: data.specialization ?? [],
      gender: data.gender,
      bio: data.bio,
      profileImage: data.profileImage ?? "",
      certificates: data.certificates ?? [],
      weekOffDays: data.weekOffDays ?? [],
    },
  });

  const specialization = form.watch("specialization");
  const watchedName = form.watch("name");
  const watchedActive = form.watch("isActive");

  const filteredTherapies = useMemo(() => {
    return specializations.filter(
      (therapy) =>
        therapy.label.toLowerCase().includes(searchValue.toLowerCase()) &&
        !specialization?.includes(therapy.value),
    );
  }, [searchValue, specialization, specializations]);

  const trimmedSearch = searchValue.trim();
  const isExactMatch = specializations.some(
    (s) =>
      s.label.toLowerCase() === trimmedSearch.toLowerCase() ||
      s.value.toLowerCase() === trimmedSearch.toLowerCase(),
  );
  const showAddOption = trimmedSearch.length > 0 && !isExactMatch;

  function handleAddSpecialization(val: string) {
    const current = form.getValues("specialization") ?? [];
    if (!current.includes(val)) {
      form.setValue("specialization", [...current, val], {
        shouldValidate: true,
      });
    }
    setSearchValue("");
    setIsDropdownOpen(false);
  }

  function handleAddCustomSpecialization() {
    if (!trimmedSearch) return;
    addSpecializationMutation.mutate(
      { value: trimmedSearch, label: trimmedSearch },
      {
        onSuccess: (created) => {
          const createdValue = created?.value ?? trimmedSearch;
          handleAddSpecialization(createdValue);
        },
      },
    );
  }

  function handleRemoveSpecialization(val: string) {
    const current = form.getValues("specialization") ?? [];
    form.setValue(
      "specialization",
      current.filter((item) => item !== val),
      { shouldValidate: true },
    );
  }

  function onSubmit(values: z.infer<typeof TherapistformSchema>) {
    updateMutate(values, {
      onSuccess: () => onClose(),
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Profile header (always visible) ─────────────────────── */}
      <div className="px-5 sm:px-6 pt-6 pb-5 border-b">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 pr-8">
          <ProfilePicUploader
            value={data.profileImage ?? ""}
            onChange={() => {}}
            name={watchedName}
            size="lg"
          />
          <div className="min-w-0 text-center sm:text-left sm:pt-1">
            <h2 className="text-xl font-bold tracking-tight truncate">
              {watchedName || "Therapist"}
            </h2>
            <div className="mt-1.5 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              {data.doctorId && (
                <span className="font-mono text-xs text-muted-foreground">
                  ID: {data.doctorId}
                </span>
              )}
              <Badge
                variant="outline"
                className={
                  watchedActive
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                    : "border-red-600 text-red-700 bg-red-50"
                }
              >
                {watchedActive ? "Active" : "Not Active"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-5 sm:px-6 border-b">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">
              Profile
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex-1">
              Earnings
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex-1">
              Referrals
            </TabsTrigger>
            <TabsTrigger value="availability" className="flex-1">
              Availability
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Profile tab ──────────────────────────────────────── */}
        <TabsContent value="profile" className="flex-1 overflow-y-auto m-0">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="px-5 sm:px-6 py-5 space-y-6"
              data-therapist-form
            >
              {/* Basic info */}
              <section className="space-y-3">
                <SectionTitle>Basic information</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="doctorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Therapist ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Therapist ID" {...field} readOnly tabIndex={-1} className="bg-muted/50 cursor-not-allowed" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phonenumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <PhoneInput
                            {...field}
                            asString
                            placeholder="Phone Number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!hideStatus && (
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select
                            onValueChange={(val) =>
                              field.onChange(val === "true")
                            }
                            defaultValue={field.value ? "true" : "false"}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="true">Active</SelectItem>
                              <SelectItem value="false">Not Active</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </section>

              {/* Specialization */}
              <section className="space-y-3">
                <SectionTitle>Specialization</SectionTitle>
                <FormField
                  control={form.control}
                  name="specialization"
                  render={() => (
                    <FormItem>
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            placeholder="Search and select specializations..."
                            value={searchValue}
                            onChange={(e) => {
                              setSearchValue(e.target.value);
                              setIsDropdownOpen(true);
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                          />
                          {isDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-md max-h-52 overflow-y-auto">
                              <Command>
                                <CommandList>
                                  {showAddOption && (
                                    <CommandGroup>
                                      <CommandItem
                                        onSelect={handleAddCustomSpecialization}
                                        disabled={
                                          addSpecializationMutation.isPending
                                        }
                                        className="cursor-pointer"
                                      >
                                        {addSpecializationMutation.isPending ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Plus className="h-4 w-4" />
                                        )}
                                        Add &quot;{trimmedSearch}&quot;
                                      </CommandItem>
                                    </CommandGroup>
                                  )}
                                  <CommandEmpty>
                                    No specialization found.
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {isLoadingSpecializations ? (
                                      <CommandItem
                                        disabled
                                        className="cursor-default"
                                      >
                                        Loading specializations...
                                      </CommandItem>
                                    ) : (
                                      filteredTherapies.map((therapy) => (
                                        <CommandItem
                                          key={therapy.value}
                                          onSelect={() =>
                                            handleAddSpecialization(
                                              therapy.value,
                                            )
                                          }
                                          className="cursor-pointer"
                                        >
                                          {therapy.label}
                                        </CommandItem>
                                      ))
                                    )}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </div>
                          )}
                        </div>

                        {specialization?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {specialization.map((val) => (
                              <Badge
                                key={val}
                                variant="secondary"
                                className="gap-1 py-1 pl-3 pr-1.5"
                              >
                                <span className="whitespace-nowrap">
                                  {specializations.find(
                                    (t) =>
                                      t.value.toLowerCase() ===
                                      val.toLowerCase(),
                                  )?.label ?? val}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveSpecialization(val)
                                  }
                                  aria-label={`Remove ${val}`}
                                  className="rounded-full p-0.5 hover:bg-background/60 cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {/* Bio */}
              <section className="space-y-3">
                <SectionTitle>Bio</SectionTitle>
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Short professional bio…"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {/* Certificates */}
              <section className="space-y-3">
                <SectionTitle>Certificates</SectionTitle>
                <FormField
                  control={form.control}
                  name="certificates"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <CertificatesSection
                          value={field.value ?? []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>
            </form>
          </Form>
        </TabsContent>

        {/* ── Earnings tab ─────────────────────────────────────── */}
        <TabsContent value="earnings" className="flex-1 overflow-y-auto m-0">
          <div className="px-5 sm:px-6 py-5">
            {data.doctorId && (
              <TherapistEarningsTab doctorId={data.doctorId} />
            )}
          </div>
        </TabsContent>

        {/* ── Referrals tab ────────────────────────────────────── */}
        <TabsContent value="referrals" className="flex-1 overflow-y-auto m-0">
          <div className="px-5 sm:px-6 py-5">
            {data.doctorId && (
              <TherapistReferralsTab doctorId={data.doctorId} />
            )}
          </div>
        </TabsContent>

        {/* ── Availability tab ─────────────────────────────────── */}
        <TabsContent value="availability" className="flex-1 overflow-y-auto m-0">
          <div className="px-5 sm:px-6 py-5">
            {data.doctorId && (
              <TherapistAvailabilityTab
                doctorId={data.doctorId}
                weekOffDays={data.weekOffDays ?? []}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Sticky footer ──────────────────────────────────────── */}
      <div className="px-5 sm:px-6 py-3.5 border-t bg-background flex items-center justify-between gap-3">
        {!hideDelete && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-11 sm:h-10"
            disabled={isDeleting || isUpdating}
            onClick={onRequestDelete}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {!hideDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUpdating || isDeleting}
              className="h-11 sm:h-10"
            >
              Cancel
            </Button>
          )}
          {activeTab === "profile" && (
            <Button
              type="button"
              disabled={isUpdating || isDeleting}
              className="h-11 sm:h-10"
              onClick={() => {
                const formEl = document.querySelector(
                  "[data-therapist-form]",
                ) as HTMLFormElement | null;
                formEl?.requestSubmit();
              }}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Updating…
                </>
              ) : (
                "Update Details"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* close dropdown on outside click */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsDropdownOpen(false);
            setSearchValue("");
          }}
        />
      )}
    </div>
  );
}
