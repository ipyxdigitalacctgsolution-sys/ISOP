import { useAuth } from "@/hooks/use-auth";
import { PLAN_TYPES, PLAN_PRICES, PLAN_PAYMENT_LINKS } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Check, Crown, Zap, BookOpen, Calculator, Construction } from "lucide-react";

const planDetails = [
  {
    name: "Free Trial",
    price: 0,
    duration: "30 days",
    icon: Zap,
    features: ["Basic Academic Management", "Educational Levels", "Student Directory", "School Fees", "Collection Module"],
    highlight: false,
  },
  {
    name: "Regular Subscription",
    price: 3500,
    duration: "per month",
    icon: Crown,
    features: ["All Free Trial features", "Staff & Teachers Registry", "Advisory Mapping", "PDF Export & Reports", "Priority Support"],
    highlight: true,
  },
  {
    name: "Online Enrollment",
    price: 3500,
    duration: "30-day add-on",
    icon: BookOpen,
    features: ["Online enrollment portal", "Student self-registration", "Document upload", "Payment integration", "Add-on to any plan"],
    highlight: false,
    isAddon: true,
    underDevelopment: true,
  },
  {
    name: "Full Accounting",
    price: 6000,
    duration: "per month",
    icon: Calculator,
    features: ["All Regular features", "Disbursement Module", "General Ledger", "Financial Reports"],
    highlight: false,
    underDevelopment: true,
  },
];

export default function UpgradePlan() {
  const { user } = useAuth();
  const currentPlan = user?.planType || "Free Trial";
  const planExpiry = user?.planExpiry;
  const isExpired = planExpiry ? new Date(planExpiry) < new Date() : false;

  const daysRemaining = planExpiry
    ? Math.max(0, Math.ceil((new Date(planExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Subscription Plans</h1>
        <p className="text-muted-foreground">Choose the best plan for your institution.</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
            <p className="text-xl font-bold text-primary" data-testid="text-current-plan">{currentPlan}</p>
            {planExpiry && (
              <p className={`text-sm mt-1 ${isExpired ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {isExpired ? "Expired" : `${daysRemaining} days remaining`} (expires {planExpiry})
              </p>
            )}
          </div>
          {user?.onlineEnrollmentActive && (
            <Badge variant="default">Online Enrollment Active</Badge>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {planDetails.map((plan) => {
          const isCurrent = currentPlan === plan.name;
          const paymentLink = PLAN_PAYMENT_LINKS[plan.name];
          const annualPrice = plan.price > 0 ? plan.price * 12 * 0.9 : 0;

          return (
            <Card
              key={plan.name}
              className={`border-border bg-card relative ${plan.highlight ? "ring-2 ring-primary" : ""}`}
              data-testid={`card-plan-${plan.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default">Most Popular</Badge>
                </div>
              )}
              {plan.isAddon && !plan.underDevelopment && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary">Add-on</Badge>
                </div>
              )}
              {plan.underDevelopment && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 bg-yellow-500/10">
                    <Construction className="w-3 h-3 mr-1" />
                    Under Development
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pt-8">
                <plan.icon className="w-10 h-10 mx-auto text-primary mb-3" />
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="mt-2">
                  {plan.price > 0 ? (
                    <>
                      <p className="text-3xl font-bold">
                        ₱{plan.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">{plan.duration}</p>
                      {!plan.isAddon && plan.price > 0 && (
                        <p className="text-xs text-primary mt-1">
                          Annual: ₱{annualPrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })} (10% off)
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold">Free</p>
                      <p className="text-xs text-muted-foreground">{plan.duration}</p>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {plan.underDevelopment ? (
                  <Button className="w-full" variant="outline" disabled>
                    Coming Soon
                  </Button>
                ) : paymentLink ? (
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    onClick={() => window.open(paymentLink, "_blank")}
                    data-testid={`button-subscribe-${plan.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {isCurrent ? "Renew Plan" : "Subscribe Now"}
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" disabled={isCurrent}>
                    {isCurrent ? "Current Plan" : "Default"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            After completing payment, your subscription will be activated within 24 hours.
            For immediate activation or inquiries, please contact the ISOP administrator.
            All prices are in Philippine Peso (₱). Annual subscriptions include a 10% discount.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
