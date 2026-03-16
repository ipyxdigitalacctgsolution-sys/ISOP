import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
  GraduationCap, 
  Users, 
  Wallet, 
  FileText, 
  Settings,
  ChevronDown,
  ChevronRight,
  School,
  Building2,
  PieChart,
  Shield,
  Receipt,
  Crown,
  Globe,
  ClipboardList,
  BookOpen,
  Banknote,
  Scale,
  BarChart3,
  TrendingUp,
  Calculator,
  Construction
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: LayoutProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    academic: true,
    billing: false,
    accounting: false,
    admin: false
  });
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isAdmin = user?.role === "admin";

  const toggleMenu = (key: string) => {
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navItemClass = (path: string) => cn(
    "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group",
    location === path 
      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
      : "text-muted-foreground hover:bg-white/5 hover:text-white"
  );

  const disabledNavClass = cn(
    "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg text-muted-foreground/50 cursor-default select-none gap-1"
  );

  const planExpiry = user?.planExpiry;
  const daysRemaining = planExpiry
    ? Math.max(0, Math.ceil((new Date(planExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isExpired = planExpiry ? new Date(planExpiry) < new Date() : false;
  const currentPlan = user?.planType || "Free Trial";

  return (
    <div className="min-h-screen bg-background flex">
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0 }}
        className="fixed inset-y-0 left-0 z-50 bg-card border-r border-border overflow-hidden"
      >
        <div className="w-[280px] h-full flex flex-col">
          <div className="p-6 border-b border-border flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20">
              {isAdmin ? "A" : (user?.schoolName?.[0] || "S")}
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground leading-tight">
                {isAdmin ? "ISOP Admin" : (user?.schoolName || "School")}
              </h1>
              <p className="text-xs text-muted-foreground">{isAdmin ? "System Administrator" : "School Portal"}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-4">
            <Link href="/dashboard" className={navItemClass("/dashboard")} data-testid="link-dashboard">
              <LayoutDashboard className="w-5 h-5 mr-3" />
              Dashboard
            </Link>

            {isAdmin ? (
              <div>
                <button 
                  onClick={() => toggleMenu('admin')}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 hover:text-white transition-colors"
                  data-testid="button-toggle-admin"
                >
                  <span>Administration</span>
                  {expandedMenus.admin ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                
                <AnimatePresence>
                  {expandedMenus.admin && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-1 ml-2 border-l border-border pl-2"
                    >
                      <Link href="/dashboard/admin/users" className={navItemClass("/dashboard/admin/users")} data-testid="link-admin-users">
                        <Users className="w-4 h-4 mr-3 opacity-70" />
                        Users Details
                      </Link>
                      <Link href="/dashboard/admin/subscriptions" className={navItemClass("/dashboard/admin/subscriptions")} data-testid="link-admin-subscriptions">
                        <Receipt className="w-4 h-4 mr-3 opacity-70" />
                        Subscription Income
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                {/* Academic Management */}
                <div>
                  <button 
                    onClick={() => toggleMenu('academic')}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 hover:text-white transition-colors"
                    data-testid="button-toggle-academic"
                  >
                    <span>Academic Management</span>
                    {expandedMenus.academic ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedMenus.academic && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-1 ml-2 border-l border-border pl-2"
                      >
                        {[
                          { href: "/dashboard/academic/levels", label: "Educational Levels", icon: School },
                          { href: "/dashboard/academic/teachers", label: "Staff & Teachers", icon: Users },
                          { href: "/dashboard/academic/fees", label: "School Fees", icon: Wallet },
                          { href: "/dashboard/academic/enrollees", label: "Student Directory", icon: GraduationCap },
                          { href: "/dashboard/academic/advisory", label: "Advisory Mapping", icon: Building2 },
                          ...(user?.onlineEnrollmentActive ? [{ href: "/dashboard/academic/online-enrollment", label: "Online Enrollment", icon: Globe }] : []),
                        ].map(item => (
                          <Link key={item.href} href={item.href} className={navItemClass(item.href)} data-testid={`link-${item.href.split('/').pop()}`}>
                            <item.icon className="w-4 h-4 mr-3 opacity-70" />
                            {item.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Billing, Collection & Related Reports */}
                <div>
                  <button 
                    onClick={() => toggleMenu('billing')}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 hover:text-white transition-colors"
                    data-testid="button-toggle-billing"
                  >
                    <span>Billing & Collection</span>
                    {expandedMenus.billing ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedMenus.billing && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-1 ml-2 border-l border-border pl-2"
                      >
                        <Link href="/dashboard/finance/collection" className={navItemClass("/dashboard/finance/collection")} data-testid="link-collection">
                          <Wallet className="w-4 h-4 mr-3 opacity-70" />
                          Collection
                        </Link>
                        <Link href="/dashboard/finance/receivables" className={navItemClass("/dashboard/finance/receivables")} data-testid="link-receivables">
                          <FileText className="w-4 h-4 mr-3 opacity-70" />
                          Receivables
                        </Link>
                        <Link href="/dashboard/finance/reports-summary" className={navItemClass("/dashboard/finance/reports-summary")} data-testid="link-reports-summary">
                          <ClipboardList className="w-4 h-4 mr-3 opacity-70" />
                          Summary of Reports
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Full Accounting System */}
                <div>
                  <button 
                    onClick={() => toggleMenu('accounting')}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 hover:text-white transition-colors"
                    data-testid="button-toggle-accounting"
                  >
                    <span className="flex items-center gap-2">
                      Full Accounting
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal border-amber-500/40 text-amber-400 no-default-hover-elevate no-default-active-elevate">
                        Dev
                      </Badge>
                    </span>
                    {expandedMenus.accounting ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  
                  <AnimatePresence>
                    {expandedMenus.accounting && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-1 ml-2 border-l border-amber-500/20 pl-2"
                      >
                        {[
                          { label: "Chart of Accounts", icon: BookOpen },
                          { label: "Disbursements", icon: Banknote },
                          { label: "General Journal", icon: FileText },
                          { label: "Ledger of Accounts", icon: Scale },
                          { label: "Performance Report", icon: BarChart3 },
                          { label: "Financial Condition", icon: TrendingUp },
                          { label: "Budget Monitoring", icon: Calculator },
                          { label: "Payroll Management", icon: Banknote },
                        ].map(item => (
                          <div key={item.label} className={disabledNavClass} data-testid={`link-accounting-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                            <item.icon className="w-4 h-4 mr-2 opacity-30" />
                            <span className="flex-1 truncate">{item.label}</span>
                            <Construction className="w-3 h-3 opacity-30 ml-1 flex-shrink-0" />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
          
          {!isAdmin && (
            <div className="p-4 border-t border-border">
              <Link href="/dashboard/upgrade">
                <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl p-4 border border-primary/20 cursor-pointer hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-4 h-4 text-primary" />
                    <p className="text-xs text-primary font-semibold">{currentPlan}</p>
                  </div>
                  {planExpiry && (
                    <p className={`text-xs mb-3 ${isExpired ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                      {isExpired ? "Plan expired" : `${daysRemaining} days remaining`}
                    </p>
                  )}
                  <div className="w-full text-xs font-bold bg-primary text-primary-foreground py-2 rounded-lg text-center">
                    Upgrade Now
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </motion.aside>

      <main className={cn(
        "flex-1 flex flex-col min-h-screen transition-all duration-300",
        isSidebarOpen ? "ml-[280px]" : "ml-0"
      )}>
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-toggle-sidebar"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-full border border-border hover:bg-white/5 transition-colors group">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{user?.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {isAdmin ? "Administrator" : user?.schoolName}
                    </p>
                  </div>
                  <Avatar className="h-9 w-9 border-2 border-background ring-2 ring-border group-hover:ring-primary transition-all">
                    <AvatarImage src={user?.logoUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {isAdmin ? <Shield className="w-4 h-4" /> : user?.username?.[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  {isAdmin ? "Admin Account" : "My Account"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile" className="cursor-pointer">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => logout.mutate()}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
