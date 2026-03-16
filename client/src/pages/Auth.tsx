import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, loginSchema, type InsertUser, type LoginRequest } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, HelpCircle, KeyRound, Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your favorite teacher's name?",
  "What was your childhood nickname?",
];

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const { login, register } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"username" | "answer" | "done">("username");
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotQuestion, setForgotQuestion] = useState("");
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);

  const loginForm = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      fiscalPeriod: "01/01",
    }
  });

  const onLogin = (data: LoginRequest) => {
    login.mutate(data);
  };

  const onRegister = (data: InsertUser) => {
    register.mutate(data);
  };

  const handleForgotGetQuestion = async () => {
    if (!forgotUsername.trim()) return;
    setForgotLoading(true);
    try {
      const res = await fetch("/api/forgot-password/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.message, variant: "destructive" });
        return;
      }
      const data = await res.json();
      setForgotQuestion(data.question);
      setForgotStep("answer");
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotReset = async () => {
    if (!forgotAnswer.trim() || forgotNewPassword.length < 6) return;
    setForgotLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: forgotUsername,
          securityAnswer: forgotAnswer,
          newPassword: forgotNewPassword,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.message, variant: "destructive" });
        return;
      }
      const data = await res.json();
      toast({ title: "Success", description: data.message });
      setForgotStep("done");
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotStep("username");
    setForgotUsername("");
    setForgotQuestion("");
    setForgotAnswer("");
    setForgotNewPassword("");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-card border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0"></div>
        
        <div className="relative z-10">
          <div onClick={() => setLocation("/")} className="cursor-pointer flex items-center gap-2 mb-12 group w-fit">
            <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="font-bold text-foreground">Back to Home</span>
          </div>
          <h1 className="text-5xl font-display font-bold text-white mb-6 leading-tight">
            Streamline Your <br />
            <span className="text-primary">Institution</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-md">
            Join thousands of schools managing their academic and financial records with ease.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="p-6 rounded-2xl bg-background/50 backdrop-blur-md border border-white/10 shadow-xl">
            <p className="text-lg italic text-white/90 mb-4">"The financial reporting tools alone saved us 20 hours a week. It's transformed how we operate."</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">J</div>
              <div>
                <p className="font-bold text-sm">James Wilson</p>
                <p className="text-xs text-muted-foreground">Principal, St. Mary's Academy</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden mb-8">
            <div onClick={() => setLocation("/")} className="cursor-pointer flex items-center gap-2 text-muted-foreground mb-4">
              <ArrowLeft className="w-4 h-4" /> Back
            </div>
            <h2 className="text-3xl font-display font-bold">Welcome Back</h2>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-card border border-border p-1 rounded-xl">
              <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold" data-testid="tab-login">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold" data-testid="tab-register">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-border bg-card shadow-2xl">
                <CardHeader>
                  <CardTitle>Sign In</CardTitle>
                  <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input id="username" {...loginForm.register("username")} className="bg-background" data-testid="input-login-username" />
                      {loginForm.formState.errors.username && <p className="text-xs text-destructive">{loginForm.formState.errors.username.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input id="password" type={showLoginPw ? "text" : "password"} {...loginForm.register("password")} className="bg-background pr-10" data-testid="input-login-password" />
                        <button
                          type="button"
                          onClick={() => setShowLoginPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                          data-testid="button-toggle-login-password"
                        >
                          {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {loginForm.formState.errors.password && <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                    </div>
                    <Button type="submit" className="w-full font-bold" disabled={login.isPending} data-testid="button-sign-in">
                      {login.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Sign In
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setForgotOpen(true)}
                        className="text-sm text-primary hover:underline"
                        data-testid="button-forgot-password"
                      >
                        <HelpCircle className="w-3.5 h-3.5 inline mr-1" />
                        Forgot Password?
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-border bg-card shadow-2xl">
                <CardHeader>
                  <CardTitle>Register School</CardTitle>
                  <CardDescription>Complete your institution's profile.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
                    <div className="space-y-2">
                      <Label>School Name *</Label>
                      <Input {...registerForm.register("schoolName")} className="bg-background" data-testid="input-reg-school-name" />
                      {registerForm.formState.errors.schoolName && <p className="text-xs text-destructive">{registerForm.formState.errors.schoolName.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username *</Label>
                        <Input {...registerForm.register("username")} className="bg-background" data-testid="input-reg-username" />
                        {registerForm.formState.errors.username && <p className="text-xs text-destructive">{registerForm.formState.errors.username.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Password *</Label>
                        <div className="relative">
                          <Input type={showRegPw ? "text" : "password"} {...registerForm.register("password")} className="bg-background pr-10" data-testid="input-reg-password" />
                          <button
                            type="button"
                            onClick={() => setShowRegPw(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                            data-testid="button-toggle-reg-password"
                          >
                            {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {registerForm.formState.errors.password && <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input type="email" {...registerForm.register("email")} className="bg-background" data-testid="input-reg-email" />
                      {registerForm.formState.errors.email && <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Address *</Label>
                      <Input {...registerForm.register("address")} className="bg-background" data-testid="input-reg-address" />
                      {registerForm.formState.errors.address && <p className="text-xs text-destructive">{registerForm.formState.errors.address.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Contact No *</Label>
                        <Input {...registerForm.register("contactNo")} className="bg-background" data-testid="input-reg-contact" />
                      </div>
                      <div className="space-y-2">
                        <Label>Fiscal Period (MM/DD)</Label>
                        <Input placeholder="01/01" {...registerForm.register("fiscalPeriod")} className="bg-background" data-testid="input-reg-fiscal" />
                      </div>
                    </div>

                    <Separator className="my-2" />
                    <p className="text-xs font-bold text-primary uppercase">Security Question</p>
                    <div className="space-y-2">
                      <Label>Security Question</Label>
                      <Select
                        onValueChange={(v) => registerForm.setValue("securityQuestion", v)}
                      >
                        <SelectTrigger className="bg-background" data-testid="select-security-question">
                          <SelectValue placeholder="Select a security question" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECURITY_QUESTIONS.map(q => (
                            <SelectItem key={q} value={q}>{q}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Security Answer</Label>
                      <Input {...registerForm.register("securityAnswer")} className="bg-background" placeholder="Your answer" data-testid="input-security-answer" />
                    </div>

                    <Separator className="my-2" />
                    <p className="text-xs font-bold text-muted-foreground uppercase">Optional Details</p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SEC Reg No</Label>
                        <Input {...registerForm.register("secRegNo")} className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label>TIN</Label>
                        <Input {...registerForm.register("tin")} className="bg-background" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input {...registerForm.register("website")} className="bg-background" />
                    </div>

                    <Button type="submit" className="w-full font-bold mt-4" disabled={register.isPending} data-testid="button-register">
                      {register.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Create Account
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={(o) => { if (!o) closeForgot(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Reset Password
            </DialogTitle>
          </DialogHeader>

          {forgotStep === "username" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Enter your username to retrieve your security question.</p>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  className="bg-background"
                  placeholder="Enter your username"
                  data-testid="input-forgot-username"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeForgot}>Cancel</Button>
                <Button onClick={handleForgotGetQuestion} disabled={forgotLoading || !forgotUsername.trim()} data-testid="button-forgot-next">
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Next
                </Button>
              </DialogFooter>
            </div>
          )}

          {forgotStep === "answer" && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-semibold text-primary">{forgotQuestion}</p>
              </div>
              <div className="space-y-2">
                <Label>Your Answer</Label>
                <Input
                  value={forgotAnswer}
                  onChange={(e) => setForgotAnswer(e.target.value)}
                  className="bg-background"
                  data-testid="input-forgot-answer"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showForgotPw ? "text" : "password"}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="bg-background pr-10"
                    placeholder="Min 6 characters"
                    data-testid="input-forgot-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    data-testid="button-toggle-forgot-password"
                  >
                    {showForgotPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setForgotStep("username")}>Back</Button>
                <Button onClick={handleForgotReset} disabled={forgotLoading || !forgotAnswer.trim() || forgotNewPassword.length < 6} data-testid="button-forgot-reset">
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Reset Password
                </Button>
              </DialogFooter>
            </div>
          )}

          {forgotStep === "done" && (
            <div className="space-y-4 py-2 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-8 h-8 text-primary" />
              </div>
              <p className="font-semibold">Password Reset Successful</p>
              <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
              <Button onClick={closeForgot} className="w-full" data-testid="button-forgot-done">
                Back to Sign In
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
