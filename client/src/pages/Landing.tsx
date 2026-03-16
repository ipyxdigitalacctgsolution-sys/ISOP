import { Link } from "wouter";
import { ArrowRight, BookOpen, Shield, Users, BarChart3, Menu, X, UserPlus, Settings, FileText } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import ipyxLogo from "@assets/ipyx-logo.png";

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-white">
      <nav className="fixed w-full z-50 bg-background/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex-shrink-0 flex items-center gap-3">
              <img src={ipyxLogo} alt="IPYX Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-primary/25" />
              <div className="leading-tight">
                <span className="font-display font-bold text-xl tracking-tight block">IPYX</span>
                <span className="text-[10px] text-muted-foreground font-medium tracking-wide">Digital Accounting Solution</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">How It Works</a>
              <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">About</a>
              <Link href="/auth">
                <button className="text-sm font-bold text-foreground hover:text-primary transition-colors" data-testid="link-signin">Sign In</button>
              </Link>
              <Link href="/auth?tab=register">
                <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all transform hover:-translate-y-0.5" data-testid="button-get-started">
                  Start Free Trial
                </button>
              </Link>
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-foreground p-2" data-testid="button-mobile-menu">
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <div className="md:hidden bg-card border-b border-border p-4 space-y-4">
             <a href="#features" className="block text-sm font-medium text-muted-foreground hover:text-primary">Features</a>
             <a href="#how-it-works" className="block text-sm font-medium text-muted-foreground hover:text-primary">How It Works</a>
             <a href="#about" className="block text-sm font-medium text-muted-foreground hover:text-primary">About</a>
              <div className="flex flex-col gap-3 mt-4">
                <Link href="/auth">
                  <button className="w-full text-center py-3 border border-border rounded-lg font-bold">Sign In</button>
                </Link>
                <Link href="/auth?tab=register">
                  <button className="w-full text-center py-3 bg-primary text-primary-foreground rounded-lg font-bold">Start Free Trial</button>
                </Link>
              </div>
          </div>
        )}
      </nav>

      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-bold mb-6">
              IPYX Digital Accounting Solution
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">
              Smart School <br /> <span className="text-primary">Operations</span> Portal
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              A comprehensive platform for modern educational institutions. Streamline academics, finance, and administration — from enrollment to billing — in one secure place.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth?tab=register">
                <button className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group" data-testid="button-hero-cta">
                  Start Your 30-Day Free Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <a href="#how-it-works">
                <button className="w-full sm:w-auto px-8 py-4 bg-card border border-border text-foreground rounded-xl font-bold text-lg hover:bg-white/5 transition-all" data-testid="button-how-it-works">
                  How It Works
                </button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-24 bg-card/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Powerful Tools for Education</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to run your institution efficiently, from enrollment to graduation.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: "Academic Excellence", desc: "Manage educational levels, student directory, staff registry, and advisory mapping effortlessly." },
              { icon: BarChart3, title: "Financial Control", desc: "Track tuition, fees, collections, accounts receivables, and generate professional SOAs." },
              { icon: Shield, title: "Secure & Reliable", desc: "Enterprise-grade security with subscription management, fiscal year automation, and data protection." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-white/5 p-8 rounded-2xl hover:border-primary/50 transition-colors group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-primary font-bold text-sm tracking-wider uppercase mb-2 block">Get Started in Minutes</span>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Three simple steps to digitize your school operations.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                step: "1", 
                icon: UserPlus,
                title: "Quick Registration", 
                desc: "Sign up for free in under a minute. No credit card required — start with a full 30-day trial.",
                accent: "from-primary/20 to-primary/5"
              },
              { 
                step: "2", 
                icon: Settings,
                title: "Digital Setup", 
                desc: "Upload your school logo, set your fiscal period, and configure educational levels and fees.",
                accent: "from-accent/20 to-accent/5"
              },
              { 
                step: "3", 
                icon: FileText,
                title: "Automated Billing", 
                desc: "Generate professional Statements of Account (SOA), track collections, and manage receivables in one click.",
                accent: "from-primary/20 to-accent/5"
              },
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className={`bg-gradient-to-br ${item.accent} border border-white/5 p-8 rounded-2xl h-full`}>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-2xl mb-6">
                    {item.step}
                  </div>
                  <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center text-primary mb-4">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-6 h-6 text-primary/40" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/auth?tab=register">
              <button className="px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 transition-all inline-flex items-center gap-2 group" data-testid="button-cta-bottom">
                Get Started Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      <section id="about" className="py-24 bg-card/30 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-secondary to-card border border-white/5 rounded-3xl p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl md:text-4xl font-display font-bold">About IPYX</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                IPYX Digital Accounting Solution is designed to bridge the gap between complex school administrative requirements and user-friendly technology. 
                Supporting both Basic Education and Higher Education, it ensures that school administrators can focus on what matters most — education.
              </p>
              <div className="flex gap-6 pt-4 flex-wrap">
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-white">K-12+</span>
                  <span className="text-sm text-muted-foreground">Basic & Higher Ed</span>
                </div>
                <div className="w-px bg-white/10 h-12"></div>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-white">24/7</span>
                  <span className="text-sm text-muted-foreground">Cloud Access</span>
                </div>
                <div className="w-px bg-white/10 h-12"></div>
                <div className="flex flex-col">
                  <span className="text-3xl font-bold text-white">PDF</span>
                  <span className="text-sm text-muted-foreground">SOA & Reports</span>
                </div>
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="aspect-video bg-background rounded-xl border border-white/10 shadow-2xl p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5"></div>
                <div className="h-full w-1/4 border-r border-white/5 absolute left-0 top-0 bg-card/50"></div>
                <div className="absolute top-4 left-[30%] right-4 h-8 bg-white/5 rounded-md"></div>
                <div className="absolute top-16 left-[30%] w-1/2 h-32 bg-primary/10 rounded-md border border-primary/20"></div>
                <div className="absolute top-16 right-4 w-[15%] h-32 bg-white/5 rounded-md"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-white/5 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={ipyxLogo} alt="IPYX Logo" className="w-8 h-8 rounded-lg" />
              <div>
                <p className="text-sm text-muted-foreground">Powered by <span className="text-foreground font-semibold">IPYX Digital Accounting Solution</span></p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">&copy; {new Date().getFullYear()} IPYX. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="text-muted-foreground hover:text-white transition-colors text-sm">Privacy</a>
              <a href="#" className="text-muted-foreground hover:text-white transition-colors text-sm">Terms</a>
              <a href="#" className="text-muted-foreground hover:text-white transition-colors text-sm">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
