import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Receipt } from "lucide-react";

interface SubscriptionEntry {
  schoolName: string;
  planType: string;
  amount: number;
  paidDate: string | null;
}

interface MonthlySummary {
  month: string;
  schools: SubscriptionEntry[];
  total: number;
}

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long" });
}

export default function AdminSubscriptions() {
  const { data: summary = [], isLoading } = useQuery<MonthlySummary[]>({
    queryKey: [api.admin.subscriptionSummary.path],
  });

  const grandTotal = summary.reduce((acc, m) => acc + m.total, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Subscription Income</h1>
          <p className="text-muted-foreground">Monthly cash receipts from school subscriptions.</p>
        </div>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold text-primary" data-testid="text-grand-total">{formatPeso(grandTotal)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : summary.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No subscription payments recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {summary.map((monthData) => (
            <Card key={monthData.month} className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                <CardTitle className="text-lg">{formatMonth(monthData.month)}</CardTitle>
                <Badge variant="default" data-testid={`badge-total-${monthData.month}`}>
                  {formatPeso(monthData.total)}
                </Badge>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 px-3 font-semibold text-muted-foreground">School Name</th>
                      <th className="py-2 px-3 font-semibold text-muted-foreground">Plan</th>
                      <th className="py-2 px-3 font-semibold text-muted-foreground">Paid Date</th>
                      <th className="py-2 px-3 font-semibold text-muted-foreground text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthData.schools.map((entry, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 px-3">{entry.schoolName}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline">{entry.planType}</Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{entry.paidDate || "--"}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatPeso(entry.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border">
                      <td colSpan={3} className="py-2 px-3 font-semibold text-right">Monthly Total:</td>
                      <td className="py-2 px-3 text-right font-bold text-primary">{formatPeso(monthData.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
