import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { TrendingUp, Users, DollarSign, Shield, Zap, Target, Star, CheckCircle2, ThumbsUp, ChevronDown } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";

function useScrollAnimation(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

// Animation wrapper component for sections
function AnimatedSection({
  children,
  className = "",
  animation = "fade-up",
  delay = 0
}: {
  children: React.ReactNode;
  className?: string;
  animation?: "fade-up" | "fade-in" | "fade-left" | "fade-right" | "zoom-in" | "bounce-in";
  delay?: number;
}) {
  const { ref, isVisible } = useScrollAnimation(0.1);

  const animationClasses = {
    "fade-up": "translate-y-10 opacity-0",
    "fade-in": "opacity-0",
    "fade-left": "-translate-x-10 opacity-0",
    "fade-right": "translate-x-10 opacity-0",
    "zoom-in": "scale-95 opacity-0",
    "bounce-in": "scale-90 opacity-0",
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className} ${
        isVisible ? "translate-y-0 translate-x-0 scale-100 opacity-100" : animationClasses[animation]
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");

  const handleLogin = () => {
    setLocation("/login");
  };

  const handleRegister = () => {
    setLocation("/register");
  };

  const handleGetStarted = () => {
    if (email) {
      setLocation(`/register?email=${encodeURIComponent(email)}`);
    } else {
      setLocation("/register");
    }
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const features = [
    { icon: Zap, title: "Instant Approvals", description: "Get approved in minutes, not days. Start promoting offers within 7 minutes of applying." },
    { icon: DollarSign, title: "High Commissions", description: "Earn competitive rates with multiple commission structures: per-sale, retainers, and hybrid models." },
    { icon: Target, title: "Smart Matching", description: "Find offers tailored to your niche and audience with advanced filtering and recommendations." },
    { icon: Users, title: "Direct Communication", description: "Chat directly with brands through our built-in messaging system. No middlemen." },
    { icon: TrendingUp, title: "Real-Time Analytics", description: "Track clicks, conversions, and earnings with comprehensive analytics dashboards." },
    { icon: Shield, title: "Verified Brands", description: "Work with confidence. All companies are manually verified to ensure legitimacy." },
  ];

  const steps = [
    {
      number: 1,
      title: "Browse Offers",
      description: "Explore thousands of affiliate opportunities from verified brands in your niche."
    },
    {
      number: 2,
      title: "Apply & Get Approved",
      description: "Submit a quick application and get approved automatically within 7 minutes."
    },
    {
      number: 3,
      title: "Promote & Earn",
      description: "Share your unique tracking link and earn commissions on every conversion."
    }
  ];

  const testimonials = [
    {
      name: "Kyla Martinez",
      role: "Lifestyle & Fashion Creator",
      image: "/kyla.png",
      testimonial: "AffiliateXchange has completely transformed how I monetize my content. The approval process is instant and the commissions are fantastic!"
    },
    {
      name: "Ryan Thompson",
      role: "Tech Reviewer",
      image: "/ryan.png",
      testimonial: "The platform makes it incredibly easy to find brands that align with my audience. I've tripled my affiliate income in just 3 months!"
    },
    {
      name: "Diane Chen",
      role: "Beauty & Wellness Influencer",
      image: "/diane.png",
      testimonial: "Finally, a platform that values creators! The direct communication with brands and real-time analytics have been game-changers for my business."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Systeme.io style */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <img src="/logo.png" alt="AffiliateXchange Logo" className="h-6 w-6 sm:h-8 sm:w-8 rounded-md object-cover" />
              <span className="text-base sm:text-xl font-bold text-gray-900">AffiliateXchange</span>
            </div>

            {/* Navigation - Center (hidden on mobile) */}
            <nav className="hidden lg:flex items-center gap-8">
              <button
                onClick={() => scrollToSection('features')}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Why AffiliateXchange?
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('testimonials')}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Testimonials
              </button>
            </nav>

            {/* Auth Buttons - Right */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                onClick={handleLogin}
                data-testid="button-login"
                className="hidden sm:inline-flex text-gray-700 hover:text-gray-900 font-medium"
              >
                Sign in
              </Button>
              <Button
                onClick={handleRegister}
                className="bg-primary hover:bg-primary/90 text-white font-medium px-3 sm:px-5 text-sm sm:text-base h-9 sm:h-10"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Systeme.io style */}
      <section className="pt-8 sm:pt-16 pb-6 sm:pb-8 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Main Headline */}
          <AnimatedSection animation="fade-up">
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-3 sm:mb-6">
              The easiest all-in-one{" "}
              <span className="relative inline-block">
                <span className="relative z-10">affiliate marketing</span>
                <span
                  className="absolute bottom-0 sm:bottom-1 left-0 w-full h-2 sm:h-3 bg-primary/40 -z-0"
                  style={{ transform: "skewX(-3deg)" }}
                />
              </span>{" "}
              platform
            </h1>
          </AnimatedSection>

          {/* Subheadline */}
          <AnimatedSection animation="fade-up" delay={100}>
            <p className="text-base sm:text-xl text-gray-600 mb-6 sm:mb-10 max-w-2xl mx-auto">
              Get your free account now
            </p>
          </AnimatedSection>

          {/* Email Signup Form */}
          <AnimatedSection animation="zoom-in" delay={200}>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-lg mx-auto mb-4 sm:mb-6 px-2 sm:px-0">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-10 sm:h-12 text-sm sm:text-base border-gray-300 rounded-lg focus:border-primary focus:ring-primary"
              />
              <Button
                onClick={handleGetStarted}
                data-testid="button-get-started"
                className="h-10 sm:h-12 px-6 sm:px-8 bg-primary hover:bg-primary/90 text-white font-semibold text-sm sm:text-base rounded-lg"
              >
                Get Started
              </Button>
            </div>
          </AnimatedSection>

          {/* Trust Badges */}
          <AnimatedSection animation="fade-up" delay={300}>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-gray-500 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <ThumbsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Free forever</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>No credit card required</span>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Product Mockups Section - Device Frames */}
      <section className="hidden sm:block pb-12 sm:pb-20 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up" delay={100}>
            <div className="relative flex items-end justify-center gap-4 lg:gap-8">
              {/* Laptop Frame */}
              <div className="relative w-full max-w-3xl">
                {/* Laptop Screen */}
                <div className="bg-gray-800 rounded-t-xl p-2 pb-0">
                  <div className="bg-white rounded-t-lg overflow-hidden">
                    {/* Browser Bar */}
                    <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="bg-white rounded px-3 py-1 text-xs text-gray-400 border">affiliatexchange.com/dashboard</div>
                      </div>
                    </div>
                    {/* Dashboard Content */}
                    <div className="p-4 bg-gray-50">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <img src="/logo.png" alt="Logo" className="h-6 w-6 rounded" />
                          <span className="font-semibold text-gray-900 text-sm">AffiliateXchange</span>
                        </div>
                        <Button size="sm" className="h-7 text-xs">Get Started</Button>
                      </div>
                      {/* Dashboard Title */}
                      <div className="mb-4">
                        <h3 className="font-bold text-gray-900">Dashboard</h3>
                        <p className="text-xs text-gray-500">Real-time analytics</p>
                      </div>
                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white rounded-lg p-3 text-center shadow-sm border">
                          <div className="text-xl font-bold text-primary">10K+</div>
                          <div className="text-[10px] text-gray-500">Creators</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center shadow-sm border">
                          <div className="text-xl font-bold text-primary">CA$5M+</div>
                          <div className="text-[10px] text-gray-500">Earnings</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center shadow-sm border">
                          <div className="text-xl font-bold text-primary">500+</div>
                          <div className="text-[10px] text-gray-500">Brands</div>
                        </div>
                      </div>
                      {/* Affiliate Marketplace Preview */}
                      <div className="bg-white rounded-lg p-3 shadow-sm border">
                        <div className="text-xs font-semibold text-gray-900 mb-2">Affiliate Marketplace</div>
                        <div className="space-y-2">
                          {/* Product 1 */}
                          <div className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                            <img src="https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=100&h=100&fit=crop&q=80" alt="Headphones" className="w-10 h-10 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">Sony WH-1000XM5 Headphones</div>
                              <div className="text-[10px] text-gray-500">CA$449.99</div>
                            </div>
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">8%</span>
                          </div>
                          {/* Product 2 */}
                          <div className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                            <img src="https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=100&h=100&fit=crop&q=80" alt="Fitbit" className="w-10 h-10 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">Fitbit Charge 6 Tracker</div>
                              <div className="text-[10px] text-gray-500">CA$199.95</div>
                            </div>
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">12%</span>
                          </div>
                          {/* Product 3 */}
                          <div className="flex gap-2 items-center p-2 bg-gray-50 rounded">
                            <img src="https://images.unsplash.com/photo-1522338140262-f46f5913618a?w=100&h=100&fit=crop&q=80" alt="Dyson" className="w-10 h-10 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">Dyson Airwrap Styler</div>
                              <div className="text-[10px] text-gray-500">CA$699.99</div>
                            </div>
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">6%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Laptop Base */}
                <div className="bg-gray-700 h-4 rounded-b-lg"></div>
                <div className="bg-gray-600 h-2 mx-auto w-1/2 rounded-b-xl"></div>
              </div>

              {/* Phone Frame - Positioned to overlap */}
              <div className="absolute right-0 lg:right-8 bottom-0 w-40 lg:w-48 z-10">
                {/* Phone Body */}
                <div className="bg-gray-800 rounded-[2rem] p-2 shadow-2xl">
                  {/* Phone Screen */}
                  <div className="bg-white rounded-[1.5rem] overflow-hidden">
                    {/* Phone Notch */}
                    <div className="bg-gray-800 h-6 flex items-center justify-center">
                      <div className="w-16 h-4 bg-gray-800 rounded-b-xl"></div>
                    </div>
                    {/* Phone Content */}
                    <div className="p-3 bg-gray-50 min-h-[280px]">
                      {/* Phone Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <img src="/logo.png" alt="Logo" className="h-5 w-5 rounded" />
                          <span className="font-semibold text-gray-900 text-[10px]">AffiliateXchange</span>
                        </div>
                        <div className="text-[8px] text-gray-500">Sign in</div>
                      </div>
                      {/* Phone Dashboard */}
                      <div className="mb-3">
                        <div className="text-xs font-bold text-gray-900">Dashboard</div>
                        <div className="text-[8px] text-gray-500">Real-time analytics</div>
                      </div>
                      {/* Phone Stats */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white rounded p-2 text-center shadow-sm border">
                          <div className="text-sm font-bold text-primary">10K+</div>
                          <div className="text-[8px] text-gray-500">Creators</div>
                        </div>
                        <div className="bg-white rounded p-2 text-center shadow-sm border">
                          <div className="text-sm font-bold text-primary">CA$5M+</div>
                          <div className="text-[8px] text-gray-500">Earnings</div>
                        </div>
                      </div>
                      {/* Phone Products */}
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center p-1.5 bg-white rounded shadow-sm border">
                          <img src="https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=100&h=100&fit=crop&q=80" alt="Headphones" className="w-8 h-8 rounded object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-medium text-gray-900 truncate">Sony Headphones</div>
                            <div className="text-[8px] text-primary font-medium">Earn CA$36</div>
                          </div>
                        </div>
                        <div className="flex gap-2 items-center p-1.5 bg-white rounded shadow-sm border">
                          <img src="https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=100&h=100&fit=crop&q=80" alt="Fitbit" className="w-8 h-8 rounded object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-medium text-gray-900 truncate">Fitbit Tracker</div>
                            <div className="text-[8px] text-primary font-medium">Earn CA$24</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Phone Home Indicator */}
                    <div className="bg-gray-50 pb-2 pt-1">
                      <div className="w-24 h-1 bg-gray-300 rounded-full mx-auto"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Trending Products Carousel Section */}
      <section className="py-8 sm:py-16 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mb-6 sm:mb-10">
          <AnimatedSection animation="fade-up">
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
                Trending Products to Promote
              </h2>
              <p className="text-sm sm:text-base text-gray-600">Top selling items with high comission rates</p>
            </div>
          </AnimatedSection>
        </div>

        {/* Mobile Grid Layout - Visible only on small screens */}
        <div className="sm:hidden px-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: "Wireless Earbuds", price: "CA$129.96", commission: "6%", earn: "CA$29", image: "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400&h=400&fit=crop&q=80" },
              { name: "Smart Watch Charger", price: "CA$49.9", commission: "CA10", earn: "CA$9", image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&h=400&fit=crop&q=80" },
              { name: "Running Shoes", price: "CA$179.96", commission: "$49", earn: "S$26", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop&q=80" },
              { name: "Whole Coffee Beans", price: "CA$15.99", commission: "6T0", earn: "CA$3", image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop&q=80" },
              { name: "Baiance", price: "CA$15.99", commission: "$80", earn: "CA$19", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop&q=80" },
              { name: "Futer", price: "CA$15.99", commission: "G5", earn: "CA$9", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop&q=80" },
            ].map((product, i) => (
              <div key={`mobile-${i}`} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">{product.commission}</span>
                </div>
                <div className="p-2">
                  <div className="font-medium text-gray-900 text-[10px] leading-tight line-clamp-2 mb-1">{product.name}</div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-gray-900 font-semibold text-[9px]">{product.price}</span>
                    <span className="bg-primary text-white font-medium text-[8px] px-1.5 py-0.5 rounded">Earn {product.earn}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Infinite Scrolling Carousels - Hidden on mobile */}
        <div className="hidden sm:block space-y-6">
          {/* Row 1 - Scrolling Left */}
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll-infinite">
              {[...Array(2)].map((_, setIndex) => (
                <div key={setIndex} className="flex gap-6 pr-6">
                  {[
                    { name: "Wireless Earbuds", brand: "Apple", price: "CA$329.99", commission: "4%", earn: "CA$13", image: "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400&h=400&fit=crop&q=80" },
                    { name: "Smart Watch", brand: "Samsung", price: "CA$399.99", commission: "5%", earn: "CA$20", image: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&h=400&fit=crop&q=80" },
                    { name: "Running Shoes", brand: "Nike", price: "CA$189.99", commission: "10%", earn: "CA$19", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop&q=80" },
                    { name: "Coffee Maker", brand: "Nespresso", price: "CA$249.99", commission: "8%", earn: "CA$20", image: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&h=400&fit=crop&q=80" },
                    { name: "Backpack", brand: "Herschel", price: "CA$89.99", commission: "12%", earn: "CA$11", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop&q=80" },
                    { name: "Sunglasses", brand: "Ray-Ban", price: "CA$199.99", commission: "8%", earn: "CA$16", image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop&q=80" },
                    { name: "Laptop Stand", brand: "Rain Design", price: "CA$69.99", commission: "15%", earn: "CA$10", image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop&q=80" },
                    { name: "Wireless Mouse", brand: "Logitech", price: "CA$79.99", commission: "10%", earn: "CA$8", image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=400&h=400&fit=crop&q=80" },
                  ].map((product, i) => (
                    <div key={`row1-${setIndex}-${i}`} className="flex-shrink-0 w-72">
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
                        <div className="h-56 bg-gray-100 relative overflow-hidden">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">{product.commission}</span>
                        </div>
                        <div className="p-5 border-t border-gray-100">
                          <div className="text-xs text-gray-500 mb-1">{product.brand}</div>
                          <div className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 font-bold">{product.price}</span>
                            <span className="text-primary font-semibold text-sm">Earn {product.earn}/sale</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 - Scrolling Right (Reverse) */}
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll-infinite-reverse">
              {[...Array(2)].map((_, setIndex) => (
                <div key={setIndex} className="flex gap-6 pr-6">
                  {[
                    { name: "Bluetooth Speaker", brand: "JBL", price: "CA$149.99", commission: "9%", earn: "CA$13", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop&q=80" },
                    { name: "Yoga Mat", brand: "Lululemon", price: "CA$88.00", commission: "12%", earn: "CA$11", image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop&q=80" },
                    { name: "Mechanical Keyboard", brand: "Keychron", price: "CA$119.99", commission: "11%", earn: "CA$13", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop&q=80" },
                    { name: "Desk Lamp", brand: "BenQ", price: "CA$199.99", commission: "7%", earn: "CA$14", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop&q=80" },
                    { name: "Water Bottle", brand: "Hydro Flask", price: "CA$49.99", commission: "15%", earn: "CA$7", image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop&q=80" },
                    { name: "Webcam", brand: "Logitech", price: "CA$129.99", commission: "8%", earn: "CA$10", image: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=400&h=400&fit=crop&q=80" },
                    { name: "Gaming Headset", brand: "SteelSeries", price: "CA$179.99", commission: "10%", earn: "CA$18", image: "https://images.unsplash.com/photo-1599669454699-248893623440?w=400&h=400&fit=crop&q=80" },
                    { name: "Portable Charger", brand: "Anker", price: "CA$59.99", commission: "12%", earn: "CA$7", image: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop&q=80" },
                  ].map((product, i) => (
                    <div key={`row2-${setIndex}-${i}`} className="flex-shrink-0 w-72">
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
                        <div className="h-56 bg-gray-100 relative overflow-hidden">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">{product.commission}</span>
                        </div>
                        <div className="p-5 border-t border-gray-100">
                          <div className="text-xs text-gray-500 mb-1">{product.brand}</div>
                          <div className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 font-bold">{product.price}</span>
                            <span className="text-primary font-semibold text-sm">Earn {product.earn}/sale</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Row 3 - Scrolling Left */}
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll-infinite">
              {[...Array(2)].map((_, setIndex) => (
                <div key={setIndex} className="flex gap-6 pr-6">
                  {[
                    { name: "Air Purifier", brand: "Dyson", price: "CA$599.99", commission: "6%", earn: "CA$36", image: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=400&fit=crop&q=80" },
                    { name: "Electric Toothbrush", brand: "Oral-B", price: "CA$199.99", commission: "10%", earn: "CA$20", image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop&q=80" },
                    { name: "Fitness Tracker", brand: "Fitbit", price: "CA$169.99", commission: "8%", earn: "CA$14", image: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400&h=400&fit=crop&q=80" },
                    { name: "Instant Camera", brand: "Fujifilm", price: "CA$99.99", commission: "11%", earn: "CA$11", image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop&q=80" },
                    { name: "Noise Cancelling Headphones", brand: "Sony", price: "CA$449.99", commission: "5%", earn: "CA$22", image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&h=400&fit=crop&q=80" },
                    { name: "Standing Desk", brand: "FlexiSpot", price: "CA$499.99", commission: "7%", earn: "CA$35", image: "https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=400&h=400&fit=crop&q=80" },
                    { name: "Kindle E-Reader", brand: "Amazon", price: "CA$139.99", commission: "4%", earn: "CA$6", image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=400&fit=crop&q=80" },
                    { name: "Smart Thermostat", brand: "Nest", price: "CA$329.99", commission: "6%", earn: "CA$20", image: "https://images.unsplash.com/photo-1558002038-1055907df827?w=400&h=400&fit=crop&q=80" },
                  ].map((product, i) => (
                    <div key={`row3-${setIndex}-${i}`} className="flex-shrink-0 w-72">
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
                        <div className="h-56 bg-gray-100 relative overflow-hidden">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">{product.commission}</span>
                        </div>
                        <div className="p-5 border-t border-gray-100">
                          <div className="text-xs text-gray-500 mb-1">{product.brand}</div>
                          <div className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 font-bold">{product.price}</span>
                            <span className="text-primary font-semibold text-sm">Earn {product.earn}/sale</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up" className="text-center mb-8 sm:mb-16">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
              Why Choose{" "}
              <span className="relative inline-block">
                <span className="relative z-10">AffiliateXchange</span>
                <span
                  className="absolute bottom-0 sm:bottom-1 left-0 w-full h-2 sm:h-3 bg-primary/40 -z-0"
                  style={{ transform: "skewX(-3deg)" }}
                />
              </span>
              ?
            </h2>
            <p className="text-sm sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to monetize your audience and grow your income
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-12 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up" className="text-center mb-8 sm:mb-16">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
              How It Works
            </h2>
            <p className="text-sm sm:text-xl text-gray-600">Get started in three simple steps</p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {steps.map((step, index) => (
              <HowItWorksStep key={step.number} step={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-12 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up" className="text-center mb-8 sm:mb-16">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
              Trusted by Creators
            </h2>
            <p className="text-sm sm:text-xl text-gray-600">See what our community has to say</p>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8">
            {testimonials.map((creator, i) => (
              <AnimatedSection key={i} animation="zoom-in" delay={i * 100}>
                <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                    <div className="flex gap-0.5 sm:gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className="h-3 w-3 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-sm sm:text-base text-gray-600">
                      "{creator.testimonial}"
                    </p>
                    <div className="flex items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-100">
                      {creator.image ? (
                        <img
                          src={creator.image}
                          alt={creator.name}
                          className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm sm:text-base">
                          {creator.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-gray-900 text-sm sm:text-base">{creator.name}</div>
                        <div className="text-xs sm:text-sm text-gray-500">{creator.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
              Ready to Start{" "}
              <span className="relative inline-block">
                <span className="relative z-10">Earning</span>
                <span
                  className="absolute bottom-0 sm:bottom-1 left-0 w-full h-2 sm:h-3 bg-primary/40 -z-0"
                  style={{ transform: "skewX(-3deg)" }}
                />
              </span>
              ?
            </h2>
            <p className="text-sm sm:text-xl text-gray-600 mb-6 sm:mb-10 max-w-2xl mx-auto">
              Join thousands of creators already making money with AffiliateXchange
            </p>
          </AnimatedSection>

          {/* Email Signup Form */}
          <AnimatedSection animation="zoom-in" delay={100}>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 max-w-lg mx-auto mb-6 sm:mb-8 px-2 sm:px-0">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-10 sm:h-12 text-sm sm:text-base border-gray-300 rounded-lg focus:border-primary focus:ring-primary"
              />
              <Button
                onClick={handleGetStarted}
                data-testid="button-join-now"
                className="h-10 sm:h-12 px-6 sm:px-8 bg-primary hover:bg-primary/90 text-white font-semibold text-sm sm:text-base rounded-lg"
              >
                Get Started Free
              </Button>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={200}>
            <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 text-xs sm:text-sm text-gray-500">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span>Instant approvals</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span>Free to join</span>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0d1b2a] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer Content */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-12 mb-10 sm:mb-12">
            {/* Logo & Description */}
            <div className="col-span-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
                <span className="font-bold text-white text-lg">AffiliateXchange</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Connecting creators with top brands. From discovering offers to earning commissions - AffiliateXchange makes it simple.
              </p>
            </div>

            {/* Platform Links */}
            <div>
              <h4 className="text-primary font-semibold mb-4 text-sm">Platform</h4>
              <ul className="space-y-3">
                <li>
                  <button onClick={() => scrollToSection('features')} className="text-gray-400 hover:text-white transition-colors text-sm">
                    Features
                  </button>
                </li>
                <li>
                  <Link href="/register" className="text-gray-400 hover:text-white transition-colors text-sm">
                    For Creators
                  </Link>
                </li>
                <li>
                  <button onClick={() => scrollToSection('how-it-works')} className="text-gray-400 hover:text-white transition-colors text-sm">
                    How It Works
                  </button>
                </li>
                <li>
                  <Link href="/register" className="text-gray-400 hover:text-white transition-colors text-sm">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="text-primary font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-sm">
                    About Us
                  </Link>
                </li>
                <li>
                  <button onClick={() => scrollToSection('testimonials')} className="text-gray-400 hover:text-white transition-colors text-sm">
                    Testimonials
                  </button>
                </li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h4 className="text-primary font-semibold mb-4 text-sm">Legal</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="/privacy-policy" className="text-gray-400 hover:text-white transition-colors text-sm">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-service" className="text-gray-400 hover:text-white transition-colors text-sm">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/cookie-policy" className="text-gray-400 hover:text-white transition-colors text-sm">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-primary font-semibold mb-4 text-sm">Contact</h4>
              <ul className="space-y-3">
                <li>
                  <a href="mailto:support@affiliatexchange.com" className="text-gray-400 hover:text-white transition-colors text-sm">
                    support@affiliatexchange.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-700 pt-6 sm:pt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">
                © 2025 AffiliateXchange. All rights reserved.
              </p>
              {/* Social Links */}
              <div className="flex items-center gap-6">
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm">
                  LinkedIn
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Twitter
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm">
                  Facebook
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: { icon: any; title: string; description: string }; index: number }) {
  const { ref, isVisible } = useScrollAnimation(0.1);
  const Icon = feature.icon;

  return (
    <div
      ref={ref}
      className={`bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 text-primary mb-3 sm:mb-4">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-1.5 sm:mb-2">{feature.title}</h3>
      <p className="text-sm sm:text-base text-gray-600">{feature.description}</p>
    </div>
  );
}

function HowItWorksStep({ step, index }: { step: { number: number; title: string; description: string }; index: number }) {
  const { ref, isVisible } = useScrollAnimation(0.1);

  return (
    <div
      ref={ref}
      className="text-center space-y-3 sm:space-y-4"
    >
      <div
        className={`inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary text-white text-xl sm:text-2xl font-bold transition-all duration-600 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
        style={{
          transitionDelay: `${index * 200}ms`,
          transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        }}
      >
        {step.number}
      </div>
      <div
        className={`transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDelay: `${index * 200 + 100}ms` }}
      >
        <h3 className="text-base sm:text-xl font-semibold text-gray-900">{step.title}</h3>
      </div>
      <div
        className={`transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDelay: `${index * 200 + 200}ms` }}
      >
        <p className="text-sm sm:text-base text-gray-600">
          {step.description}
        </p>
      </div>
    </div>
  );
}

