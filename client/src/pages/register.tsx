import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { Input } from "../components/ui/input";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Checkbox } from "../components/ui/checkbox";
import { useToast } from "../hooks/use-toast";
import { Check, X, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { GenericErrorDialog } from "../components/GenericErrorDialog";
import { motion } from "framer-motion";
import { registrationSchema, validatePasswordComplexity } from "../../../shared/validation";

type RegisterForm = z.infer<typeof registrationSchema>;

const cardAnimation = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [errorDialog, setErrorDialog] = useState({
    open: false,
    title: "Error",
    description: "An error occurred",
    errorDetails: "",
  });

  const [passwordValue, setPasswordValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordRequirements = validatePasswordComplexity(passwordValue);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      role: "creator",
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          acceptTerms: data.acceptTerms,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      toast({
        title: "Success!",
        description: "Account created successfully. Redirecting...",
      });

      // Redirect based on role
      setTimeout(() => {
        window.location.href = data.role === "creator" ? "/creator-onboarding" : "/company-onboarding";
      }, 1000);
    } catch (error: any) {
      setErrorDialog({
        open: true,
        title: "Registration Failed",
        description: "We couldn't create your account. Please check your information and try again.",
        errorDetails: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
          <span className="text-xl font-semibold text-primary">AffiliateXchange</span>
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-4">
        <motion.div {...cardAnimation} className="w-full max-w-md">
          <Card className="shadow-lg border-0">
            <CardContent className="pt-8 pb-8 px-8">
              {/* Logo and Title */}
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  <img
                    src="/logo.png"
                    alt="AffiliateXchange Logo"
                    className="h-16 w-16 rounded-xl object-cover shadow-md"
                  />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Register</h1>
                <p className="text-sm text-muted-foreground mt-1">Join the marketplace and start earning</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Role Selection */}
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">I am a</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-2 gap-3"
                          >
                            <div>
                              <RadioGroupItem
                                value="creator"
                                id="creator"
                                className="peer sr-only"
                              />
                              <label
                                htmlFor="creator"
                                className="flex items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                                data-testid="role-creator"
                              >
                                <span className="text-sm font-medium">Creator</span>
                              </label>
                            </div>
                            <div>
                              <RadioGroupItem
                                value="company"
                                id="company"
                                className="peer sr-only"
                              />
                              <label
                                htmlFor="company"
                                className="flex items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-3 hover:bg-gray-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                                data-testid="role-company"
                              >
                                <span className="text-sm font-medium">Company</span>
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Username */}
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder=""
                            {...field}
                            data-testid="input-username"
                            className="h-11 border-gray-200 focus:border-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder=""
                            {...field}
                            data-testid="input-email"
                            className="h-11 border-gray-200 focus:border-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* First Name and Last Name */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-muted-foreground">First Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder=""
                              {...field}
                              data-testid="input-firstname"
                              className="h-11 border-gray-200 focus:border-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-muted-foreground">Last Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder=""
                              {...field}
                              data-testid="input-lastname"
                              className="h-11 border-gray-200 focus:border-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Password */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder=""
                              {...field}
                              data-testid="input-password"
                              className="h-11 pr-10 border-gray-200 focus:border-primary"
                              onChange={(e) => {
                                field.onChange(e);
                                setPasswordValue(e.target.value);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        {passwordValue && (
                          <div className="mt-2 space-y-1 text-xs">
                            <p className="text-muted-foreground font-medium">Password requirements:</p>
                            {[
                              { label: "At least 8 characters", met: passwordValue.length >= 8 },
                              { label: "One uppercase letter", met: /[A-Z]/.test(passwordValue) },
                              { label: "One lowercase letter", met: /[a-z]/.test(passwordValue) },
                              { label: "One number", met: /[0-9]/.test(passwordValue) },
                              { label: "One special character (!@#$%^&*...)", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordValue) },
                            ].map((req) => (
                              <div key={req.label} className="flex items-center gap-1.5">
                                {req.met ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <X className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={req.met ? "text-green-600" : "text-muted-foreground"}>
                                  {req.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Confirm Password */}
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder=""
                              {...field}
                              data-testid="input-confirm-password"
                              className="h-11 pr-10 border-gray-200 focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Terms and Conditions */}
                  <FormField
                    control={form.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-accept-terms"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal text-muted-foreground">
                            I agree to the{" "}
                            <Link
                              href="/terms-of-service"
                              className="text-primary hover:underline font-medium"
                            >
                              Terms of Service
                            </Link>
                            {" "}and{" "}
                            <Link
                              href="/privacy-policy"
                              className="text-primary hover:underline font-medium"
                            >
                              Privacy Policy
                            </Link>
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium"
                    disabled={isLoading}
                    data-testid="button-register"
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </Form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              {/* Google Signup */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base font-medium border-gray-200 hover:bg-gray-50"
                onClick={handleGoogleSignup}
                disabled={isLoading}
                data-testid="button-google-signup"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              {/* Sign in link */}
              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-primary hover:underline font-medium"
                  data-testid="link-login"
                >
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Generic Error Dialog */}
      <GenericErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        description={errorDialog.description}
        errorDetails={errorDialog.errorDetails}
        variant="error"
      />
    </div>
  );
}
