"use client";

import { useForm } from "react-hook-form";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CirclePlus, X, Loader2, Plus, Eye, EyeOff } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAddTherapist } from "@/data/therapist/therapist";
import {
  useAddSpecialization,
  useGetSpecializations,
} from "@/data/specializations/specializations";
import { TherapistformSchema, TherapistformType } from "@/type/schema";
import { ProfilePicUploader } from "./profile-pic-uploader";
import { CertificatesSection } from "./certificates-section";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export default function AddDoctorForm() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useAddTherapist();
  const {
    data: specializations = [],
    isLoading: isLoadingSpecializations,
  } = useGetSpecializations();
  const addSpecializationMutation = useAddSpecialization();

  const form = useForm<z.infer<typeof TherapistformSchema>>({
    resolver: zodResolver(TherapistformSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      doctorId: "",
      password: "",
      gender: "male",
      phonenumber: undefined,
      email: "",
      specialization: [],
      bio: "",
      profileImage: "",
      certificates: [],
    },
  });

  const specialization = form.watch("specialization");
  const watchedName = form.watch("name");

  const filteredTherapies = useMemo(() => {
    return specializations.filter(
      (therapy) =>
        therapy.label.toLowerCase().includes(searchValue.toLowerCase()) &&
        !specialization.includes(therapy.value),
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
    const current = form.getValues("specialization");
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
    const current = form.getValues("specialization");
    form.setValue(
      "specialization",
      current.filter((item) => item !== val),
      { shouldValidate: true },
    );
  }

  function onSubmit(values: TherapistformType) {
    if (!values.password || values.password.length < 6) {
      toast.error("Set a temporary password (min 6 characters)");
      return;
    }
    mutation.mutate(values, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
        setSearchValue("");
      },
    });
  }

  function handleDialogChange(open: boolean) {
    setIsDialogOpen(open);
    if (!open) {
      form.reset();
      setSearchValue("");
      setIsDropdownOpen(false);
      setShowPassword(false);
    }
  }

  return (
    <Sheet open={isDialogOpen} onOpenChange={handleDialogChange}>
      <SheetTrigger asChild>
        <Button className="flex justify-center items-center gap-1">
          <CirclePlus className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Add Therapist
          </span>
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-2xl p-0 gap-0 flex flex-col">
        <SheetTitle className="sr-only">Add Therapist</SheetTitle>
        <SheetDescription className="sr-only">
          Add a therapist with profile picture, details and certificates.
        </SheetDescription>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col h-full"
          >
            {/* ── Header ───────────────────────────────────────── */}
            <div className="px-5 sm:px-6 pt-6 pb-5 border-b">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 pr-8">
                <FormField
                  control={form.control}
                  name="profileImage"
                  render={({ field }) => (
                    <ProfilePicUploader
                      value={field.value}
                      onChange={field.onChange}
                      name={watchedName}
                      size="lg"
                    />
                  )}
                />
                <div className="min-w-0 text-center sm:text-left sm:pt-1">
                  <h2 className="text-xl font-bold tracking-tight">
                    {watchedName || "New Therapist"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fill in the details below to add a therapist.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Scrollable body ──────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
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
                          <Input
                            placeholder="Auto-assigned (THR-####) if left blank"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temporary password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Min 6 chars (therapist can change later)"
                              {...field}
                              value={field.value ?? ""}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
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
                          <Input placeholder="Email" type="email" {...field} />
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
                          <PhoneInput {...field} asString placeholder="Phone number" />
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

                        {specialization.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {specialization.map((val: string) => (
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
                                  onClick={() => handleRemoveSpecialization(val)}
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
            </div>

            {/* ── Sticky footer ────────────────────────────────── */}
            <div className="px-5 sm:px-6 py-3.5 border-t bg-background flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={mutation.isPending}
                className="h-11 sm:h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="h-11 sm:h-10"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Adding…
                  </>
                ) : (
                  "Add Therapist"
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* close dropdown when clicking outside */}
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsDropdownOpen(false);
              setSearchValue("");
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
