import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Users, GraduationCap, Calendar, 
  ArrowRight, UserPlus, FileText, Crown, Clock,
  Briefcase, Wallet, Banknote
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentSchoolYear } from "@/lib/educational-levels-data";

interface DashboardStats {
  studentCount: number;
  maleCount: number;
  femaleCount: number;
  staffCount: number;
  activeStaffCount: number;
  totalReceivables: string;
  totalCollected: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const currentSY = getCurrentSchoolYear(user?.fiscalPeriod);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: [`/api/dashboard/stats?schoolYear=${currentSY}`],
    refetchInterval: 30000,
  });

  const planExpiry = user?.planExpiry;
  const daysRemaining = planExpiry
    ? Math.max(0, Math.ceil((new Date(planExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isExpired = planExpiry ? new Date(planExpiry) < new Date() : false;
  const currentPlan = user?.planType || "Free Trial";

  const formatCurrency = (val: string | undefined) => {
    const n = parseFloat(val || "0");
    return `₱ ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.schoolName || user?.username}. SY {currentSY}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-lg border border-border">
          <Calendar className="w-4 h-4" />
          <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="border-border bg-card hover:border-primary/50 transition-colors shadow-lg shadow-black/5 cursor-pointer" 
          onClick={() => navigate("/dashboard/academic/enrollees")}
          data-testid="card-student-count"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-student-count">{stats?.studentCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-blue-400">{stats?.maleCount ?? 0} M</span> / <span className="text-pink-400">{stats?.femaleCount ?? 0} F</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          className="border-border bg-card hover:border-primary/50 transition-colors shadow-lg shadow-black/5 cursor-pointer"
          onClick={() => navigate("/dashboard/finance/receivables")}
          data-testid="card-receivables"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
            <Wallet className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold text-red-400" data-testid="text-receivables">{formatCurrency(stats?.totalReceivables)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Collected: <span className="text-emerald-400">{formatCurrency(stats?.totalCollected)}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          className="border-border bg-card hover:border-primary/50 transition-colors shadow-lg shadow-black/5 cursor-pointer"
          onClick={() => navigate("/dashboard/academic/teachers")}
          data-testid="card-staff"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Staff & Teachers</CardTitle>
            <Briefcase className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-staff-count">{stats?.staffCount ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active: <span className="text-emerald-400">{stats?.activeStaffCount ?? 0}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          className="border-border bg-card hover:border-primary/50 transition-colors shadow-lg shadow-black/5 cursor-pointer"
          onClick={() => navigate("/dashboard/finance/collection")}
          data-testid="card-collections"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
            <Banknote className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-400" data-testid="text-collected">{formatCurrency(stats?.totalCollected)}</div>
                <p className="text-xs text-muted-foreground mt-1">SY {currentSY}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-4"
              onClick={() => navigate("/dashboard/academic/enrollees")}
              data-testid="button-quick-register-student"
            >
              <UserPlus className="w-5 h-5 mr-3 text-blue-400" />
              <div className="text-left">
                <p className="font-semibold text-sm">Register New Student</p>
                <p className="text-xs text-muted-foreground">Add a student to the directory</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-4"
              onClick={() => navigate("/dashboard/finance/receivables")}
              data-testid="button-quick-generate-soa"
            >
              <FileText className="w-5 h-5 mr-3 text-emerald-400" />
              <div className="text-left">
                <p className="font-semibold text-sm">Generate New SOA</p>
                <p className="text-xs text-muted-foreground">Statement of Account for students</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-4"
              onClick={() => navigate("/dashboard/finance/collection")}
              data-testid="button-quick-record-payment"
            >
              <Banknote className="w-5 h-5 mr-3 text-amber-400" />
              <div className="text-left">
                <p className="font-semibold text-sm">Record Payment</p>
                <p className="text-xs text-muted-foreground">Log a new collection entry</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-4"
              onClick={() => navigate("/dashboard/academic/levels")}
              data-testid="button-quick-manage-levels"
            >
              <Users className="w-5 h-5 mr-3 text-purple-400" />
              <div className="text-left">
                <p className="font-semibold text-sm">Manage Levels</p>
                <p className="text-xs text-muted-foreground">Configure educational levels & sections</p>
              </div>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="text-sm font-semibold text-primary" data-testid="text-plan-type">{currentPlan}</span>
              </div>
              {planExpiry && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className={`text-sm font-semibold ${isExpired ? "text-destructive" : "text-emerald-400"}`} data-testid="text-plan-status">
                      {isExpired ? "Expired" : "Active"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Remaining</span>
                    <span className="text-sm font-semibold flex items-center gap-1" data-testid="text-days-remaining">
                      <Clock className="w-3 h-3" />
                      {isExpired ? "0" : daysRemaining} days
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${isExpired ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, (daysRemaining / 30) * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
            <Button
              variant="default"
              className="w-full"
              onClick={() => navigate("/dashboard/upgrade")}
              data-testid="button-upgrade-plan"
            >
              <Crown className="w-4 h-4 mr-2" />
              {isExpired ? "Renew Plan" : "Upgrade Plan"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
