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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
              <span className="text-xl font-bold text-gray-900">AffiliateXchange</span>
            </div>

            {/* Navigation - Center */}
            <nav className="hidden md:flex items-center gap-8">
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
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={handleLogin}
                data-testid="button-login"
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                Sign in
              </Button>
              <Button
                onClick={handleRegister}
                className="bg-primary hover:bg-primary/90 text-white font-medium px-5"
              >
                Start for free now
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Systeme.io style */}
      <section className="pt-16 pb-8 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            The easiest all-in-one{" "}
            <span className="relative inline-block">
              <span className="relative z-10">affiliate marketing</span>
              <span
                className="absolute bottom-1 left-0 w-full h-3 bg-primary/40 -z-0"
                style={{ transform: "skewX(-3deg)" }}
              />
            </span>{" "}
            platform
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Get your free account now!
          </p>

          {/* Email Signup Form */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-6">
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-12 text-base border-gray-300 rounded-lg focus:border-primary focus:ring-primary"
            />
            <Button
              onClick={handleGetStarted}
              data-testid="button-get-started"
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-semibold text-base rounded-lg"
            >
              Get Started
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4" />
              <span>Free forever</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>No credit card required</span>
            </div>
          </div>
        </div>
      </section>

      {/* Product Mockups Section */}
      <section className="pb-20 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Left Mockup - Dashboard Preview */}
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Dashboard</div>
                    <div className="text-sm text-gray-500">Real-time analytics</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-primary">10K+</div>
                      <div className="text-xs text-gray-500">Creators</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-primary">CA$5M+</div>
                      <div className="text-xs text-gray-500">Earned</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-primary">500+</div>
                      <div className="text-xs text-gray-500">Brands</div>
                    </div>
                  </div>
                  {/* Product Review - Amazon Style */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-gray-900">5.0 out of 5</span>
                    </div>
                    <div className="text-xs font-medium text-gray-900 mb-1">Best headphones I've ever owned!</div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">
                      "The noise cancellation is incredible. Perfect for work and travel. Battery life exceeds expectations..."
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center">
                        <span className="text-orange-600 font-medium text-xs">M</span>
                      </div>
                      <span>Michael T.</span>
                      <span className="text-green-600 font-medium">Verified Purchase</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Mockup - Affiliate Marketplace Preview */}
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-gray-700">Affiliate Marketplace</span>
                <div className="flex gap-2">
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">All Categories</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {/* Product 1 - Electronics */}
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">Sony</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">Sony WH-1000XM5 Headphones</div>
                          <div className="text-xs text-gray-500">Electronics • Audio</div>
                        </div>
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">8% Commission</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>CA$449.99</span>
                        <span className="text-primary font-medium">Earn CA$36/sale</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product 2 - Fitness */}
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">Fitbit</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">Fitbit Charge 6 Tracker</div>
                          <div className="text-xs text-gray-500">Fitness • Wearables</div>
                        </div>
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">12% Commission</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>CA$199.95</span>
                        <span className="text-primary font-medium">Earn CA$24/sale</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product 3 - Beauty */}
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">Dyson</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">Dyson Airwrap Styler</div>
                          <div className="text-xs text-gray-500">Beauty • Hair Care</div>
                        </div>
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">6% Commission</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>CA$699.99</span>
                        <span className="text-primary font-medium">Earn CA$42/sale</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Products Carousel Section */}
      <section className="py-16 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Trending Products to Promote
            </h2>
            <p className="text-gray-600">Top-selling items with high commission rates</p>
          </div>
        </div>

        {/* Infinite Scrolling Carousel */}
        <div className="relative">
          <div className="flex animate-scroll gap-6">
            {/* First set of products */}
            {[
              { name: "Wireless Earbuds Pro", brand: "Apple", price: "CA$329.99", commission: "4%", earn: "CA$13", image: "https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "E-Reader Tablet", brand: "Amazon", price: "CA$169.99", commission: "4.5%", earn: "CA$8", image: "https://images.pexels.com/photos/1029757/pexels-photo-1029757.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Smart Air Fryer", brand: "Ninja", price: "CA$249.99", commission: "8%", earn: "CA$20", image: "https://images.pexels.com/photos/6996084/pexels-photo-6996084.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Premium Yoga Mat", brand: "Lululemon", price: "CA$128.00", commission: "10%", earn: "CA$13", image: "https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Insulated Tumbler", brand: "Stanley", price: "CA$65.00", commission: "12%", earn: "CA$8", image: "https://images.pexels.com/photos/4065906/pexels-photo-4065906.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Professional Hair Dryer", brand: "Dyson", price: "CA$499.99", commission: "6%", earn: "CA$30", image: "https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Wireless Headphones", brand: "Sony", price: "CA$449.99", commission: "5%", earn: "CA$22", image: "https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Portable Speaker", brand: "JBL", price: "CA$169.99", commission: "8%", earn: "CA$14", image: "https://images.pexels.com/photos/1706694/pexels-photo-1706694.jpeg?auto=compress&cs=tinysrgb&w=400" },
            ].map((product, i) => (
              <div key={`first-${i}`} className="flex-shrink-0 w-72">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
                  <div className="h-56 bg-gray-50 relative overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
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
            {/* Duplicate set for seamless loop */}
            {[
              { name: "Wireless Earbuds Pro", brand: "Apple", price: "CA$329.99", commission: "4%", earn: "CA$13", image: "https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "E-Reader Tablet", brand: "Amazon", price: "CA$169.99", commission: "4.5%", earn: "CA$8", image: "https://images.pexels.com/photos/1029757/pexels-photo-1029757.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Smart Air Fryer", brand: "Ninja", price: "CA$249.99", commission: "8%", earn: "CA$20", image: "https://images.pexels.com/photos/6996084/pexels-photo-6996084.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Premium Yoga Mat", brand: "Lululemon", price: "CA$128.00", commission: "10%", earn: "CA$13", image: "https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Insulated Tumbler", brand: "Stanley", price: "CA$65.00", commission: "12%", earn: "CA$8", image: "https://images.pexels.com/photos/4065906/pexels-photo-4065906.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Professional Hair Dryer", brand: "Dyson", price: "CA$499.99", commission: "6%", earn: "CA$30", image: "https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Wireless Headphones", brand: "Sony", price: "CA$449.99", commission: "5%", earn: "CA$22", image: "https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=400" },
              { name: "Portable Speaker", brand: "JBL", price: "CA$169.99", commission: "8%", earn: "CA$14", image: "https://images.pexels.com/photos/1706694/pexels-photo-1706694.jpeg?auto=compress&cs=tinysrgb&w=400" },
            ].map((product, i) => (
              <div key={`second-${i}`} className="flex-shrink-0 w-72">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
                  <div className="h-56 bg-gray-50 relative overflow-hidden">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
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
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why Choose{" "}
              <span className="relative inline-block">
                <span className="relative z-10">AffiliateXchange</span>
                <span
                  className="absolute bottom-1 left-0 w-full h-3 bg-primary/40 -z-0"
                  style={{ transform: "skewX(-3deg)" }}
                />
              </span>
              ?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to monetize your audience and grow your income
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">Get started in three simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {steps.map((step, index) => (
              <HowItWorksStep key={step.number} step={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Creators
            </h2>
            <p className="text-xl text-gray-600">See what our community has to say</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((creator, i) => (
              <Card key={i} className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-600">
                    "{creator.testimonial}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    {creator.image ? (
                      <img
                        src={creator.image}
                        alt={creator.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                        {creator.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{creator.name}</div>
                      <div className="text-sm text-gray-500">{creator.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to Start{" "}
            <span className="relative inline-block">
              <span className="relative z-10">Earning</span>
              <span
                className="absolute bottom-1 left-0 w-full h-3 bg-primary/40 -z-0"
                style={{ transform: "skewX(-3deg)" }}
              />
            </span>
            ?
          </h2>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Join thousands of creators already making money with AffiliateXchange
          </p>

          {/* Email Signup Form */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-8">
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-12 text-base border-gray-300 rounded-lg focus:border-primary focus:ring-primary"
            />
            <Button
              onClick={handleGetStarted}
              data-testid="button-join-now"
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-semibold text-base rounded-lg"
            >
              Get Started Free
            </Button>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Instant approvals</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Free to join</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
              <span className="font-bold text-gray-900">AffiliateXchange</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link
                href="/privacy-policy"
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-of-service"
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                Terms of Service
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              © 2025 AffiliateXchange. All rights reserved.
            </p>
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
      className={`bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
      <p className="text-gray-600">{feature.description}</p>
    </div>
  );
}

function HowItWorksStep({ step, index }: { step: { number: number; title: string; description: string }; index: number }) {
  const { ref, isVisible } = useScrollAnimation(0.1);

  return (
    <div
      ref={ref}
      className="text-center space-y-4"
    >
      <div
        className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white text-2xl font-bold transition-all duration-600 ${
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
        <h3 className="text-xl font-semibold text-gray-900">{step.title}</h3>
      </div>
      <div
        className={`transition-all duration-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDelay: `${index * 200 + 200}ms` }}
      >
        <p className="text-gray-600">
          {step.description}
        </p>
      </div>
    </div>
  );
}

