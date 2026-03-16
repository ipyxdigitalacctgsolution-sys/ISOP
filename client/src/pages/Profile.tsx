import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Upload, X, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your favorite teacher's name?",
  "What was your childhood nickname?",
];

export default function Profile() {
  const { user } = useAuth();
  const updateMutation = useUpdateUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string>(user?.logoUrl || "");

  const profileSchema = insertUserSchema.omit({ password: true }).partial();
  const form = useForm<Partial<InsertUser>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      schoolName: user?.schoolName,
      username: user?.username,
      email: user?.email,
      address: user?.address,
      contactNo: user?.contactNo,
      website: user?.website || "",
      tin: user?.tin || "",
      secRegNo: user?.secRegNo || "",
      fiscalPeriod: user?.fiscalPeriod || "",
      logoUrl: user?.logoUrl || "",
      securityQuestion: user?.securityQuestion || "",
      securityAnswer: user?.securityAnswer || "",
    }
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file type", description: "Please upload a PNG or JPG image.", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 2MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      form.setValue("logoUrl", base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview("");
    form.setValue("logoUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (data: Partial<InsertUser>) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Profile Updated",
          description: "Your school information has been saved successfully.",
        });
      },
      onError: (err) => {
        toast({
          title: "Update Failed",
          description: err.message,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Account Settings</h1>
        <p className="text-muted-foreground">Manage your school's profile and preferences.</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>School Information</CardTitle>
          <CardDescription>Update your institution's public details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>School Name</Label>
                <Input {...form.register("schoolName")} className="bg-background" data-testid="input-school-name" />
                {form.formState.errors.schoolName && <p className="text-xs text-destructive">{form.formState.errors.schoolName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input {...form.register("email")} className="bg-background" data-testid="input-email" />
                {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Contact Number</Label>
                <Input {...form.register("contactNo")} className="bg-background" data-testid="input-contact" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input {...form.register("address")} className="bg-background" data-testid="input-address" />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input {...form.register("website")} className="bg-background" data-testid="input-website" />
              </div>
              <div className="space-y-2">
                <Label>School Logo</Label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="School Logo"
                        className="w-16 h-16 object-contain rounded border border-border bg-background p-1"
                        data-testid="img-logo-preview"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                        data-testid="button-remove-logo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded border border-dashed border-border bg-background flex items-center justify-center" data-testid="placeholder-logo">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleLogoUpload}
                      className="hidden"
                      data-testid="input-logo-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-attach-logo"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Attach Logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">PNG or JPG, max 2MB</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm font-semibold mb-4 text-primary">Security Question</p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Security Question</Label>
                  <Select
                    value={form.watch("securityQuestion") || ""}
                    onValueChange={(v) => form.setValue("securityQuestion", v)}
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
                  <Input {...form.register("securityAnswer")} className="bg-background" placeholder="Your answer" data-testid="input-security-answer" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm font-semibold mb-4 text-primary">Legal & Financial</p>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>SEC Reg No.</Label>
                  <Input {...form.register("secRegNo")} className="bg-background" data-testid="input-sec-reg" />
                </div>
                <div className="space-y-2">
                  <Label>TIN</Label>
                  <Input {...form.register("tin")} className="bg-background" data-testid="input-tin" />
                </div>
                <div className="space-y-2">
                  <Label>Fiscal Period (MM/DD)</Label>
                  <Input {...form.register("fiscalPeriod")} className="bg-background" placeholder="01/01" data-testid="input-fiscal" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" className="font-bold" disabled={updateMutation.isPending} data-testid="button-save-changes">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
