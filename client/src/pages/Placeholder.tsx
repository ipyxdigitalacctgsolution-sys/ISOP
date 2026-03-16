import { ShieldAlert, Construction } from "lucide-react";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in zoom-in-95 duration-500">
      <div className="relative">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
           <Construction className="w-12 h-12 text-primary" />
        </div>
        <div className="absolute -bottom-2 -right-2 bg-background p-1 rounded-full border border-border">
          <ShieldAlert className="w-6 h-6 text-yellow-500" />
        </div>
      </div>
      
      <div className="space-y-2 max-w-md">
        <h1 className="text-3xl font-display font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">
          This module is currently under development. Our team is working hard to bring you this feature soon.
        </p>
      </div>

      <div className="p-4 bg-card border border-border rounded-lg max-w-lg w-full mt-8">
        <div className="flex justify-between text-sm mb-2 font-medium">
          <span>Development Progress</span>
          <span className="text-primary">65%</span>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary w-[65%] rounded-full relative overflow-hidden">
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
