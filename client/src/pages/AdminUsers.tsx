import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { PLAN_TYPES, type User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Eye, EyeOff, KeyRound, Save, Users, CalendarDays } from "lucide-react";

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [resetDialog, setResetDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [editPlanType, setEditPlanType] = useState("");
  const [editPlanExpiry, setEditPlanExpiry] = useState("");
  const [editPlanRemarks, setEditPlanRemarks] = useState("");
  const [editPlanPaidDate, setEditPlanPaidDate] = useState("");
  const [editPlanAnnual, setEditPlanAnnual] = useState(false);
  const [editOnlineEnrollment, setEditOnlineEnrollment] = useState(false);
  const [editOnlineEnrollmentExpiry, setEditOnlineEnrollmentExpiry] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: [api.admin.listUsers.path],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const res = await fetch(buildUrl("/api/admin/users/:id", { id }), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.listUsers.path] });
      toast({ title: "User Updated", description: "User details have been saved." });
      setEditDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: number; newPassword: string }) => {
      const res = await fetch(buildUrl("/api/admin/users/:id/reset-password", { id }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reset password");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.listUsers.path] });
      toast({ title: "Password Reset", description: "The user's password has been reset." });
      setResetDialog(false);
      setNewPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Reset Failed", description: err.message, variant: "destructive" });
    },
  });

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditPlanType(user.planType || "Free Trial");
    setEditPlanExpiry(user.planExpiry || "");
    setEditPlanRemarks(user.planRemarks || "");
    setEditPlanPaidDate(user.planPaidDate || "");
    setEditPlanAnnual(user.planAnnual || false);
    setEditOnlineEnrollment(user.onlineEnrollmentActive || false);
    setEditOnlineEnrollmentExpiry(user.onlineEnrollmentExpiry || "");
    setEditDialog(true);
  };

  const handleSaveSubscription = () => {
    if (!selectedUser) return;
    updateMutation.mutate({
      id: selectedUser.id,
      updates: {
        planType: editPlanType,
        planExpiry: editPlanExpiry || null,
        planPaidDate: editPlanPaidDate || null,
        planRemarks: editPlanRemarks || null,
        planAnnual: editPlanAnnual,
        onlineEnrollmentActive: editOnlineEnrollment,
        onlineEnrollmentExpiry: editOnlineEnrollmentExpiry || null,
      },
    });
  };

  const filteredUsers = users.filter(u =>
    u.schoolName.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const getPlanBadgeVariant = (plan: string | null) => {
    switch (plan) {
      case "Regular Subscription": return "default";
      case "Full Accounting": return "default";
      case "Online Enrollment": return "secondary";
      default: return "outline";
    }
  };

  const isExpired = (expiry: string | null) => {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Users Details</h1>
          <p className="text-muted-foreground">Manage registered schools and their subscriptions.</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Users className="w-4 h-4 mr-1" />
          {users.length} Registered Schools
        </Badge>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle>All Schools</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search schools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
              data-testid="input-search-users"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No schools found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 px-3 font-semibold text-muted-foreground">School Name</th>
                    <th className="py-3 px-3 font-semibold text-muted-foreground">Username</th>
                    <th className="py-3 px-3 font-semibold text-muted-foreground">Password</th>
                    <th className="py-3 px-3 font-semibold text-muted-foreground">Email</th>
                    <th className="py-3 px-3 font-semibold text-muted-foreground">Contact</th>
                    <th className="py-3 px-3 font-semibold text-muted-foreground">Plan</th>
                    <th className="py-3 px-3 font-semibold text-muted-foreground">Expiry</th>
                    <th className="py-3 px-3 font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover-elevate" data-testid={`row-user-${u.id}`}>
                      <td className="py-3 px-3 font-medium">{u.schoolName}</td>
                      <td className="py-3 px-3">{u.username}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">
                            {showPasswords[u.id] ? (u.plaintextPassword || "N/A") : "••••••"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setShowPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                            data-testid={`button-toggle-pwd-${u.id}`}
                          >
                            {showPasswords[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{u.email}</td>
                      <td className="py-3 px-3 text-muted-foreground">{u.contactNo}</td>
                      <td className="py-3 px-3">
                        <Badge variant={getPlanBadgeVariant(u.planType)}>
                          {u.planType || "Free Trial"}
                        </Badge>
                        {u.onlineEnrollmentActive && (
                          <Badge variant="secondary" className="ml-1">+OE</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {u.planExpiry ? (
                          <span className={isExpired(u.planExpiry) ? "text-destructive font-semibold" : "text-muted-foreground"}>
                            {u.planExpiry}
                            {isExpired(u.planExpiry) && " (Expired)"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(u)} data-testid={`button-edit-user-${u.id}`}>
                            <CalendarDays className="w-3.5 h-3.5 mr-1" />
                            Plan
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setSelectedUser(u); setResetDialog(true); setNewPassword(""); }}
                            data-testid={`button-reset-pwd-${u.id}`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Subscription - {selectedUser?.schoolName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan Type</Label>
                <Select value={editPlanType} onValueChange={setEditPlanType}>
                  <SelectTrigger className="bg-background" data-testid="select-plan-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_TYPES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paid Date</Label>
                <Input
                  type="date"
                  value={editPlanPaidDate}
                  onChange={(e) => setEditPlanPaidDate(e.target.value)}
                  className="bg-background"
                  data-testid="input-paid-date"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expiration Date</Label>
                <Input
                  type="date"
                  value={editPlanExpiry}
                  onChange={(e) => setEditPlanExpiry(e.target.value)}
                  className="bg-background"
                  data-testid="input-plan-expiry"
                />
              </div>
              <div className="space-y-2 flex items-end gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPlanAnnual}
                    onChange={(e) => setEditPlanAnnual(e.target.checked)}
                    className="rounded border-border"
                    data-testid="checkbox-annual"
                  />
                  <span className="text-sm">Annual (10% discount)</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={editPlanRemarks}
                onChange={(e) => setEditPlanRemarks(e.target.value)}
                className="bg-background"
                placeholder="Notes about plan changes..."
                data-testid="input-remarks"
              />
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-semibold text-primary">Online Enrollment Add-on</p>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editOnlineEnrollment}
                    onChange={(e) => setEditOnlineEnrollment(e.target.checked)}
                    className="rounded border-border"
                    data-testid="checkbox-online-enrollment"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <div className="space-y-2">
                  <Label>OE Expiry</Label>
                  <Input
                    type="date"
                    value={editOnlineEnrollmentExpiry}
                    onChange={(e) => setEditOnlineEnrollmentExpiry(e.target.value)}
                    className="bg-background"
                    data-testid="input-oe-expiry"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSubscription} disabled={updateMutation.isPending} data-testid="button-save-plan">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password - {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-background"
                placeholder="Enter new password (min 6 chars)"
                data-testid="input-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(false)}>Cancel</Button>
            <Button
              onClick={() => selectedUser && resetMutation.mutate({ id: selectedUser.id, newPassword })}
              disabled={resetMutation.isPending || newPassword.length < 6}
              data-testid="button-confirm-reset"
            >
              {resetMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
