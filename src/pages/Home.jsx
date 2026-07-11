import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, BookOpen, Shield, Trophy, ArrowRight, CheckCircle, Users, Star, Megaphone, Pin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const features = [
  { icon: BookOpen, title: "Community Question Banks", desc: "Thousands of practice questions contributed and verified by certified professionals." },
  { icon: Shield, title: "AI-Verified Content", desc: "Every question is reviewed by AI and sourced against official documentation." },
  { icon: Trophy, title: "Timed Mock Exams", desc: "Simulate the real exam experience with timed, randomized question sets." },
  { icon: Zap, title: "Certopia Credits", desc: "Earn CC by contributing quality questions. Spend them to unlock premium content." },
];

const domains = [
  { name: "Oracle", icon: "🔶", tracks: ["SCM", "HCM", "Finance", "CX", "Technical"] },
  { name: "Cisco Networking", icon: "🔵", tracks: ["CCNA", "CCNP", "CCIE"] },
  { name: "Project Management", icon: "📊", tracks: ["PMP", "PRINCE2", "Agile"] },
  { name: "Cybersecurity", icon: "🛡️", tracks: ["CISSP", "CEH", "CompTIA Security+"] },
  { name: "Cloud Platforms", icon: "☁️", tracks: ["AWS", "Azure", "GCP"] },
  { name: "Finance & Risk", icon: "💹", tracks: ["CFA", "FRM", "CPA"] },
];

export default function Home() {
  const handleLogin = () => base44.auth.redirectToLogin("/dashboard");
  const handleDomainClick = (domainName) => {
    base44.auth.redirectToLogin(`/browse?domain=${encodeURIComponent(domainName)}`);
  };
  const [news, setNews] = useState([]);

  useEffect(() => {
    base44.entities.NewsAnnouncement.filter({ is_published: true }, "-created_date", 5).then(items => {
      setNews(items.filter(n => (n.publish_to || []).includes("home")));
    });
  }, []);

  return (
    <div className="min-h-screen bg-background font-inter">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-sora font-bold text-xl text-foreground">Certopia</span>
        </div>
        <Button onClick={handleLogin} size="sm" className="font-semibold">
          Sign In <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </nav>

      {/* Announcements */}
      <section className="max-w-7xl mx-auto px-6 pt-6 space-y-3">
        {news.length > 0 && news.slice(0, 3).map(n => (
          <div key={n.id} className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            {n.pinned ? <Pin size={15} className="text-primary flex-shrink-0 mt-0.5" /> : <Megaphone size={15} className="text-primary flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {n.badge && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full font-medium">{n.badge}</span>}
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
          <Star className="w-3.5 h-3.5" />
          Community-Powered Certification Prep
        </div>
        <h1 className="font-sora text-5xl md:text-6xl font-bold text-foreground max-w-3xl mx-auto leading-tight">
          Prepare for Any
          <span className="text-primary"> Certification</span>
          <br />Together
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-6 leading-relaxed">
          Certopia is where professionals build and share exam practice questions, verified by AI and backed by official documentation. Any domain. Any level.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
          <Button onClick={handleLogin} size="lg" className="font-semibold px-8 h-12 text-base">
            Get Started <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" size="lg" onClick={handleLogin} className="h-12 text-base">
            Browse Question Banks
          </Button>
        </div>

      </section>

      {/* Features */}
      <section className="bg-card border-y border-border py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-sora text-3xl font-bold text-center text-foreground mb-12">Everything you need to pass</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-border bg-background hover:shadow-sm transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Domains */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <h2 className="font-sora text-3xl font-bold text-center text-foreground mb-4">All Domains Covered</h2>
        <p className="text-center text-muted-foreground mb-12">From Oracle to Cloud Platforms, we cover every major professional certification path.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {domains.map(({ name, icon, tracks }) => (
            <div key={name} className="p-5 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer" onClick={() => handleDomainClick(name)}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{icon}</span>
                <h3 className="font-semibold text-foreground">{name}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {tracks.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-sora text-4xl font-bold text-white mb-4">Ready to ace your next certification?</h2>
          <p className="text-white/70 mb-8 text-lg">Join thousands of professionals preparing smarter with Certopia.</p>
          <Button onClick={handleLogin} size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold px-8 h-12">
            Start for Free <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      <footer className="py-8 px-6 text-center text-sm text-muted-foreground border-t border-border">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-sora font-semibold text-foreground">Certopia</span>
        </div>
        <p>© 2026 Certopia. All rights reserved.</p>
      </footer>
    </div>
  );
}