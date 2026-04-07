import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetPublicSpace, getGetPublicSpaceQueryKey, useCreateGuestBooking, useGuestRegister, useGuestLogin } from "@/lib/guest-api";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronLeft, ChevronRight, Home, FileText, CreditCard, Sparkles } from "lucide-react";
import { Link } from "wouter";

const steps = [
  { key: "step1", icon: Home, label: "Stay Details" },
  { key: "step2", icon: FileText, label: "Your Info" },
  { key: "step3", icon: CreditCard, label: "Documents" },
  { key: "step4", icon: Sparkles, label: "Confirmed" },
];

const guestInfoSchema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Min 8 characters").optional().or(z.literal("")),
  nationality: z.string().optional(),
  phone: z.string().optional(),
});

type GuestInfoData = z.infer<typeof guestInfoSchema>;

const stayDetailsSchema = z.object({
  check_in_date: z.string().min(1, "Check-in required"),
  check_out_date: z.string().min(1, "Check-out required"),
  num_guests: z.coerce.number().min(1).max(10),
  product_id: z.string().optional(),
  special_requests: z.string().optional(),
});

type StayDetailsData = z.infer<typeof stayDetailsSchema>;

export default function Booking() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { token, guest: authGuest, setAuth } = useAuthStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [bookingRef, setBookingRef] = useState<string>("");
  const [stayDetails, setStayDetails] = useState<StayDetailsData | null>(null);

  const spaceIdNum = parseInt(spaceId ?? "0", 10);

  const { data: spaceData, isLoading } = useGetPublicSpace(spaceIdNum, {
    query: {
      enabled: !!spaceIdNum,
      queryKey: getGetPublicSpaceQueryKey(spaceIdNum),
    },
  });

  const space = spaceData?.data;
  const createBooking = useCreateGuestBooking();
  const registerMutation = useGuestRegister();
  const loginMutation = useGuestLogin();

  const stayForm = useForm<StayDetailsData>({
    resolver: zodResolver(stayDetailsSchema),
    defaultValues: {
      num_guests: 1,
      special_requests: "",
    },
  });

  const guestForm = useForm<GuestInfoData>({
    resolver: zodResolver(guestInfoSchema),
    defaultValues: {
      first_name: authGuest?.name.split(" ")[0] ?? "",
      last_name: authGuest?.name.split(" ")[1] ?? "",
      email: authGuest?.email ?? "",
      password: "",
      nationality: "",
      phone: "",
    },
  });

  const onStayDetailsSubmit = (data: StayDetailsData) => {
    setStayDetails(data);
    setCurrentStep(1);
  };

  const onGuestInfoSubmit = async (data: GuestInfoData) => {
    if (!token && data.password) {
      // Register new guest
      registerMutation.mutate(
        {
          data: {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            password: data.password!,
            nationality: data.nationality,
            phone: data.phone,
          },
        },
        {
          onSuccess: (res) => {
            setAuth(res.token, res.guest);
            setCurrentStep(2);
          },
          onError: (error: unknown) => {
            const msg = (error as { data?: { error?: string } })?.data?.error ?? "Registration failed";
            toast({ title: "Registration failed", description: msg, variant: "destructive" });
          },
        }
      );
    } else {
      setCurrentStep(2);
    }
  };

  const onConfirmBooking = () => {
    if (!stayDetails || !space) return;

    createBooking.mutate(
      {
        data: {
          space_id: space.id,
          product_id: stayDetails.product_id ? parseInt(stayDetails.product_id) : undefined,
          check_in_date: stayDetails.check_in_date,
          check_out_date: stayDetails.check_out_date,
          num_guests: stayDetails.num_guests,
          special_requests: stayDetails.special_requests ?? undefined,
        },
      },
      {
        onSuccess: (res) => {
          setBookingRef(res.data.booking_ref);
          setCurrentStep(3);
        },
        onError: () => {
          toast({
            title: "Booking failed",
            description: "Please try again or contact support",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-8">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">Space not found.</p>
          <Button onClick={() => setLocation("/search")} className="mt-4">Browse spaces</Button>
        </div>
      </div>
    );
  }

  const selectedProduct = stayDetails?.product_id
    ? space.products?.find((p) => p.id === parseInt(stayDetails.product_id!))
    : null;

  const weeklyPrice = selectedProduct?.price ?? space.base_weekly_price;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="container py-8 max-w-3xl">
        <Link href={`/spaces/${space.id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 w-fit">
          <ChevronLeft className="h-4 w-4" />
          Back to space
        </Link>

        <h1 className="text-2xl font-bold text-foreground mb-8">Book Your Stay</h1>

        {/* Step Indicator */}
        <div className="flex items-center mb-10">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className={`flex items-center gap-2 ${isCurrent ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isCompleted ? "border-green-600 bg-green-600 text-white" :
                    isCurrent ? "border-primary bg-primary/10 text-primary" :
                    "border-muted bg-muted"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span className="hidden sm:block text-xs font-medium">{t(`booking.${step.key}`)}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${idx < currentStep ? "bg-green-600" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {/* Step 1: Stay Details */}
              {currentStep === 0 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border bg-card p-6 space-y-5"
                >
                  <h2 className="text-lg font-semibold">{t("booking.step1")}</h2>

                  <Form {...stayForm}>
                    <form onSubmit={stayForm.handleSubmit(onStayDetailsSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={stayForm.control}
                          name="check_in_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("booking.check_in")}</FormLabel>
                              <FormControl>
                                <DateInput value={field.value ?? ""} onChange={field.onChange}
                                  min={new Date().toISOString().slice(0, 10)}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  data-testid="input-check-in" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={stayForm.control}
                          name="check_out_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("booking.check_out")}</FormLabel>
                              <FormControl>
                                <DateInput value={field.value ?? ""} onChange={field.onChange}
                                  min={stayForm.watch("check_in_date") || new Date().toISOString().slice(0, 10)}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  data-testid="input-check-out" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={stayForm.control}
                        name="num_guests"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Guests</FormLabel>
                            <FormControl>
                              <Select
                                value={String(field.value)}
                                onValueChange={(v) => field.onChange(parseInt(v))}
                              >
                                <SelectTrigger data-testid="select-num-guests">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4].map((n) => (
                                    <SelectItem key={n} value={String(n)}>{n} guest{n > 1 ? "s" : ""}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {space.products && space.products.length > 0 && (
                        <FormField
                          control={stayForm.control}
                          name="product_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stay Package</FormLabel>
                              <FormControl>
                                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                                  <SelectTrigger data-testid="select-product">
                                    <SelectValue placeholder="Select a package" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {space.products!.map((p) => (
                                      <SelectItem key={p.id} value={String(p.id)}>
                                        {p.name} — ${p.price}/wk
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={stayForm.control}
                        name="special_requests"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Special Requests <span className="text-muted-foreground">(optional)</span></FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Any special needs or questions..." data-testid="input-special-requests" />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full bg-primary text-primary-foreground py-5" data-testid="button-next-step1">
                        Continue <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </form>
                  </Form>
                </motion.div>
              )}

              {/* Step 2: Guest Info */}
              {currentStep === 1 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border bg-card p-6 space-y-5"
                >
                  <h2 className="text-lg font-semibold">{t("booking.step2")}</h2>

                  {token && authGuest ? (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                        <p className="text-sm font-medium text-foreground">Booking as: <span className="text-primary">{authGuest.name}</span></p>
                        <p className="text-xs text-muted-foreground">{authGuest.email}</p>
                      </div>
                      <Button onClick={() => setCurrentStep(2)} className="w-full bg-primary text-primary-foreground py-5">
                        Continue <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  ) : (
                    <Form {...guestForm}>
                      <form onSubmit={guestForm.handleSubmit(onGuestInfoSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={guestForm.control} name="first_name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl><Input {...field} data-testid="input-first-name" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={guestForm.control} name="last_name" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl><Input {...field} data-testid="input-last-name" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={guestForm.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl><Input {...field} type="email" data-testid="input-email" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={guestForm.control} name="password" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Create Password</FormLabel>
                            <FormControl><Input {...field} type="password" placeholder="Min 8 chars" data-testid="input-password" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={guestForm.control} name="nationality" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nationality <span className="text-muted-foreground">(optional)</span></FormLabel>
                            <FormControl><Input {...field} placeholder="e.g. Korean" /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={guestForm.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone <span className="text-muted-foreground">(optional)</span></FormLabel>
                            <FormControl><Input {...field} type="tel" /></FormControl>
                          </FormItem>
                        )} />
                        <Button type="submit" disabled={registerMutation.isPending} className="w-full bg-primary text-primary-foreground py-5" data-testid="button-next-step2">
                          {registerMutation.isPending ? "Creating account..." : "Continue"} <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Already have an account? <Link href="/login" className="text-primary hover:underline">Login here</Link>
                        </p>
                      </form>
                    </Form>
                  )}
                </motion.div>
              )}

              {/* Step 3: Documents */}
              {currentStep === 2 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border bg-card p-6 space-y-5"
                >
                  <h2 className="text-lg font-semibold">{t("booking.step3")}</h2>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                    <p className="text-sm font-medium text-amber-900">Documents required after booking:</p>
                    <ul className="space-y-2 text-sm text-amber-800">
                      {["Passport or National ID", "Student enrollment letter or work contract", "Emergency contact details", "Any visa documents (if applicable)"].map((doc) => (
                        <li key={doc} className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700">
                      Documents can be uploaded from your guest portal after booking. Your room will be confirmed once documents are approved.
                    </p>
                  </div>
                  <Button
                    onClick={onConfirmBooking}
                    disabled={createBooking.isPending}
                    className="w-full bg-primary text-primary-foreground py-5"
                    data-testid="button-confirm-booking"
                  >
                    {createBooking.isPending ? "Confirming..." : "Confirm Booking"} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                  <Button variant="ghost" onClick={() => setCurrentStep(1)} className="w-full">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                </motion.div>
              )}

              {/* Step 4: Confirmed */}
              {currentStep === 3 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border bg-card p-8 text-center space-y-5"
                >
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{t("booking.step4")}!</h2>
                    <p className="text-muted-foreground mt-1">Your booking request has been submitted</p>
                  </div>
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                    <p className="text-sm text-muted-foreground">Booking Reference</p>
                    <p className="text-2xl font-bold text-primary tracking-wider" data-testid="text-booking-ref">{bookingRef}</p>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Your booking is pending document review. Please upload your documents from the guest portal.</p>
                  </div>
                  <Button onClick={() => setLocation("/portal")} className="w-full bg-primary text-primary-foreground py-5">
                    Go to My Portal
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Summary Sidebar */}
          {currentStep < 3 && (
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border bg-card p-5 space-y-4 shadow-sm">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Booking Summary</h3>

                {space.primary_image ? (
                  <img src={space.primary_image ?? undefined} alt={space.name} className="w-full aspect-[4/3] object-cover rounded-lg" />
                ) : (
                  <div className="w-full aspect-[4/3] bg-muted rounded-lg" />
                )}

                <div>
                  <p className="font-medium text-sm text-foreground">{space.name}</p>
                  <p className="text-xs text-muted-foreground">{space.suburb_name}, Melbourne</p>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weekly rent</span>
                    <span className="font-medium">${weeklyPrice}</span>
                  </div>
                  {space.admin_fee != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Admin fee</span>
                      <span>${space.admin_fee}</span>
                    </div>
                  )}
                  {space.bond_amount != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bond</span>
                      <span>${space.bond_amount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
