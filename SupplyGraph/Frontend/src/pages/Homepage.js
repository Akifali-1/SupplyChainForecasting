// Homepage component
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Brain, TrendingUp, FileText, Settings, ArrowRight, CheckCircle, Sparkles, Zap, BarChart3 } from 'lucide-react';
import { mockFeatures } from '../utils/mockData';

const iconMap = {
  brain: Brain,
  'trending-up': TrendingUp,
  'file-text': FileText,
  settings: Settings
};

const Homepage = () => {
  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
        }
      });
    }, observerOptions);

    const featureCards = featuresRef.current?.querySelectorAll('.feature-card');
    const processCards = howItWorksRef.current?.querySelectorAll('.process-card');

    featureCards?.forEach((card) => observer.observe(card));
    processCards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen">


      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"></div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 dark:from-blue-400/10 dark:to-purple-400/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-cyan-400/20 dark:from-indigo-400/10 dark:to-cyan-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-purple-400/10 to-pink-400/10 dark:from-purple-400/5 dark:to-pink-400/5 rounded-full blur-2xl animate-spin-slow"></div>
        </div>

        <div className="relative max-w-7xl mx-auto text-center z-10">
          <div className="animate-fade-in-up">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center space-x-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-full border border-blue-200 dark:border-slate-700 shadow-lg animate-bounce-gentle">
                <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">AI-Powered Forecasting</span>
                <Zap className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent animate-gradient">
                Smart Supply Chain
              </span>
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 dark:from-indigo-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent animate-gradient-reverse">
                Demand Forecasting
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-300 mb-8 max-w-4xl mx-auto leading-relaxed font-light">
              Harness the power of <span className="font-semibold text-blue-600 dark:text-blue-400">AI and machine learning</span> to predict demand patterns,
              optimize inventory levels, and make <span className="font-semibold text-purple-600 dark:text-purple-400">data-driven decisions</span> for your supply chain.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link to="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-700 dark:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white px-10 py-4 text-lg font-semibold transition-all duration-500 hover:scale-110 hover:shadow-2xl group border-0 rounded-xl"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform duration-300" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="px-10 py-4 text-lg font-semibold border-2 border-blue-300 dark:border-slate-600 text-blue-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:border-blue-400 dark:hover:border-slate-500 transition-all duration-300 hover:scale-105 hover:shadow-lg rounded-xl"
              >
                <BarChart3 className="mr-2 h-5 w-5" />
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Predict Demand with
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
                AI Precision
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto leading-relaxed mb-12">
              Transform your supply chain with cutting-edge AI forecasting. Upload your data, fine-tune our models, and get accurate demand predictions that drive smarter business decisions.
            </p>
            {/* Buttons intentionally removed in this section */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {[
              {
                icon: Sparkles,
                number: '500+',
                label: 'Companies Trust Us',
                color: 'from-blue-500 to-cyan-500',
                bgColor: 'from-blue-50 to-white',
                darkBgColor: 'from-slate-800 to-slate-800',
                borderColor: 'border-blue-200',
                darkBorderColor: 'dark:border-slate-700',
                subtitle: 'Global Enterprise Clients'
              },
              {
                icon: BarChart3,
                number: '95%',
                label: 'Prediction Accuracy',
                color: 'from-purple-500 to-pink-500',
                bgColor: 'from-purple-50 to-white',
                darkBgColor: 'from-slate-800 to-slate-800',
                borderColor: 'border-purple-200',
                darkBorderColor: 'dark:border-slate-700',
                subtitle: 'Industry Leading Precision'
              },
              {
                icon: TrendingUp,
                number: '$2M+',
                label: 'Cost Savings Generated',
                color: 'from-green-500 to-emerald-500',
                bgColor: 'from-green-50 to-white',
                darkBgColor: 'from-slate-800 to-slate-800',
                borderColor: 'border-green-200',
                darkBorderColor: 'dark:border-slate-700',
                subtitle: 'Annual Average Savings'
              }
            ].map((stat, index) => (
              <Card
                key={index}
                className={`text-center border-0 bg-gradient-to-br ${stat.bgColor} dark:${stat.darkBgColor} hover:shadow-2xl transition-all duration-500 hover:-translate-y-4 group overflow-hidden relative border ${stat.borderColor} ${stat.darkBorderColor}`}
              >
                {/* Animated background elements */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-r ${stat.color} rounded-full blur-2xl transform translate-x-16 -translate-y-16 group-hover:scale-150 transition-transform duration-700`}></div>
                  <div className={`absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-r ${stat.color} rounded-full blur-2xl transform -translate-x-12 translate-y-12 group-hover:scale-150 transition-transform duration-700`}></div>
                </div>

                <CardContent className="p-8 relative z-10 bg-white dark:bg-slate-800 rounded-2xl">
                  {/* Icon container with enhanced animation */}
                  <div className={`w-20 h-20 bg-gradient-to-r ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-all duration-300 shadow-lg relative overflow-hidden`}>
                    {/* Shine effect on icon container */}
                    <div className="absolute inset-0 bg-white/20 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700"></div>
                    <stat.icon className="h-9 w-9 text-white relative z-10" />
                  </div>

                  {/* Number with animated counter effect */}
                  <div className="text-5xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 dark:group-hover:from-blue-400 dark:group-hover:to-purple-400 transition-all duration-500">
                    {stat.number}
                  </div>

                  {/* Subtitle */}
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    {stat.subtitle}
                  </div>

                  {/* Label */}
                  <div className="text-slate-700 dark:text-slate-300 font-medium text-lg mb-4">
                    {stat.label}
                  </div>

                  {/* Animated underline */}
                  <div className={`mt-2 h-1 bg-gradient-to-r ${stat.color} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center`}></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-64 h-64 bg-blue-300/10 dark:bg-blue-400/5 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-purple-300/10 dark:bg-purple-400/5 rounded-full blur-3xl animate-float-delayed"></div>
        </div>
        <div className="relative max-w-7xl mx-auto z-10">
          <div className="text-center mb-20 animate-fade-in-up">
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-slate-800 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent">
                Powerful Features for Modern Supply Chains
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Our platform combines machine learning, statistical modeling, and demand forecasting to give you the most comprehensive supply chain solution.
            </p>
          </div>

          <div className="space-y-32">
            {mockFeatures.map((feature, index) => {
              const IconComponent = iconMap[feature.icon];
              const isEven = index % 2 === 0;

              return (
                <div
                  key={index}
                  className="feature-card opacity-0"
                >
                  <div className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ${!isEven ? 'lg:grid-flow-col-dense' : ''
                    }`}>
                    {/* Content */}
                    <div className={`space-y-8 ${!isEven ? 'lg:col-start-2' : ''}`}>
                      <div className="inline-flex items-center space-x-3">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300 relative overflow-hidden">
                          {/* Shine effect on icon container */}
                          <div className="absolute inset-0 bg-white/20 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700"></div>
                          <IconComponent className="h-8 w-8 text-white relative z-10" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Feature</div>
                          <h3 className="text-3xl font-bold text-slate-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 dark:group-hover:from-blue-400 dark:group-hover:to-purple-400 transition-all duration-500">
                            {feature.title}
                          </h3>
                        </div>
                      </div>
                      <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                      <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
                        {feature.description}
                      </p>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-slate-700 dark:text-slate-300">Industry Leading</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-slate-700 dark:text-slate-300">99.9% Uptime</span>
                        </div>
                      </div>
                      <Button
                        size="lg"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-700 dark:to-purple-700 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white px-8 py-4 font-semibold transition-all duration-300 hover:scale-105 group border-0 rounded-xl relative overflow-hidden"
                      >
                        {/* Shine effect on button */}
                        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700 rounded-xl"></div>
                        <span className="relative z-10">Learn More</span>
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform relative z-10" />
                      </Button>
                    </div>

                    {/* Visual Card */}
                    <div className={`${!isEven ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                      <Card className="group hover:shadow-2xl transition-all duration-500 hover:-translate-y-6 border-0 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-800/80 backdrop-blur-sm overflow-hidden relative border border-blue-200 dark:border-slate-700">
                        {/* Animated background elements */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-r from-blue-400/20 to-purple-400/20 dark:from-blue-400/10 dark:to-purple-400/10 rounded-full blur-3xl transform translate-x-32 -translate-y-32 group-hover:scale-150 transition-transform duration-700"></div>
                          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-r from-purple-400/20 to-pink-400/20 dark:from-purple-400/10 dark:to-pink-400/10 rounded-full blur-3xl transform -translate-x-24 translate-y-24 group-hover:scale-150 transition-transform duration-700"></div>
                        </div>

                        <CardContent className="p-10 relative z-10">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white dark:from-blue-400/5 dark:to-purple-400/5 rounded-2xl blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
                            <div className="relative bg-white dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl p-8 border border-blue-200 dark:border-slate-700 shadow-inner">
                              {/* Feature-specific visual representation */}
                              <div className="flex flex-col items-center justify-center h-64">
                                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg relative overflow-hidden">
                                  {/* Shine effect */}
                                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700"></div>
                                  <IconComponent className="h-12 w-12 text-white relative z-10" />
                                </div>

                                <h4 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-4">
                                  {feature.title}
                                </h4>

                                <div className="flex items-center justify-center space-x-4">
                                  <div className="bg-gradient-to-br from-blue-50 to-white dark:from-slate-700 dark:to-slate-700 rounded-lg p-3 border border-blue-200 dark:border-slate-600 shadow-sm">
                                    <p className="text-xs text-slate-600 dark:text-slate-300">Efficiency</p>
                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">+42%</p>
                                  </div>

                                  <div className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-700 dark:to-slate-700 rounded-lg p-3 border border-purple-200 dark:border-slate-600 shadow-sm">
                                    <p className="text-xs text-slate-600 dark:text-slate-300">Accuracy</p>
                                    <p className="text-lg font-bold text-purple-600 dark:text-purple-400">98%</p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
                                <p className="text-slate-600 dark:text-slate-300 text-sm">
                                  {feature.description.substring(0, 100)}...
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={howItWorksRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-300/20 dark:bg-blue-400/10 rounded-full blur-2xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-purple-300/20 dark:bg-purple-400/10 rounded-full blur-2xl animate-float-delayed"></div>
        </div>

        <div className="relative max-w-7xl mx-auto z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-slate-800 to-indigo-600 dark:from-slate-200 dark:to-indigo-400 bg-clip-text text-transparent">
                How It Works
              </span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Three simple steps to start forecasting your demand with AI precision
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Your Data',
                description: 'Upload your supply chain data - single dataset or separate node, edge, and demand files.',
                color: 'from-blue-500 to-cyan-500',
                bgColor: 'from-blue-50 to-white',
                darkBgColor: 'from-slate-800 to-slate-800'
              },
              {
                step: '02',
                title: 'AI Model Training',
                description: 'Our advanced AI system processes your data and fine-tunes the forecasting model for your specific needs.',
                color: 'from-purple-500 to-pink-500',
                bgColor: 'from-purple-50 to-white',
                darkBgColor: 'from-slate-800 to-slate-800'
              },
              {
                step: '03',
                title: 'Get Predictions',
                description: 'Input store and product names to get accurate demand predictions and actionable insights.',
                color: 'from-indigo-500 to-blue-500',
                bgColor: 'from-indigo-50 to-white',
                darkBgColor: 'from-slate-800 to-slate-800'
              }
            ].map((item, index) => (
              <div key={index} className="process-card opacity-0 transform translate-y-10 transition-all duration-1000" style={{ transitionDelay: `${index * 0.2}s` }}>
                <Card className={`group hover:shadow-2xl transition-all duration-500 hover:-translate-y-6 border-0 bg-gradient-to-br ${item.bgColor} dark:${item.darkBgColor} backdrop-blur-sm h-full relative overflow-hidden border border-blue-200 dark:border-slate-700`}>
                  {/* Animated background elements */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500">
                    <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-r ${item.color} rounded-full blur-3xl transform translate-x-20 -translate-y-20 group-hover:scale-150 transition-transform duration-700`}></div>
                    <div className={`absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-r ${item.color} rounded-full blur-3xl transform -translate-x-16 translate-y-16 group-hover:scale-150 transition-transform duration-700`}></div>
                  </div>

                  <CardContent className="p-8 text-center h-full flex flex-col relative z-10 bg-white dark:bg-slate-800 rounded-2xl">
                    <div className="mb-6">
                      {/* Step number with enhanced animation */}
                      <div className={`w-20 h-20 bg-gradient-to-br ${item.color} text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg relative overflow-hidden`}>
                        {/* Shine effect on step number */}
                        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700"></div>
                        <span className="relative z-10">{item.step}</span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 dark:group-hover:from-blue-400 dark:group-hover:to-purple-400 transition-all duration-500">
                      {item.title}
                    </h3>

                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed flex-1 group-hover:text-slate-700 dark:group-hover:text-slate-400 transition-colors">
                      {item.description}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className={`w-full h-1 bg-gradient-to-r ${item.color} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`}></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full" style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)'
            }}></div>
          </div>
          <div className="absolute top-20 right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 shadow-lg mb-8 group">
              {/* Shine effect on badge */}
              <div className="absolute inset-0 bg-white/10 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700 rounded-full"></div>
              <Sparkles className="h-4 w-4 text-yellow-300 relative z-10" />
              <span className="text-sm font-medium text-white relative z-10">Ready to Launch?</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight">
              Ready to Revolutionize Your
              <span className="block bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                Forecasting?
              </span>
            </h2>
            <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed">
              Join thousands of businesses already using AI to optimize their supply chains and stay ahead of market demands.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link to="/register">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-white to-blue-50 text-slate-900 hover:from-blue-50 hover:to-white dark:from-slate-700 dark:to-slate-800 dark:text-white dark:hover:from-slate-600 dark:hover:to-slate-700 px-12 py-4 text-lg font-semibold transition-all duration-500 hover:scale-110 hover:shadow-2xl group border-0 rounded-xl relative overflow-hidden"
                >
                  {/* Shine effect on button */}
                  <div className="absolute inset-0 bg-white/30 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700 rounded-xl"></div>
                  <span className="relative z-10">Get Started Today</span>
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform duration-300 relative z-10" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 px-12 py-4 text-lg font-semibold transition-all duration-300 hover:scale-105 rounded-xl backdrop-blur-sm relative overflow-hidden group"
              >
                {/* Shine effect on outline button */}
                <div className="absolute inset-0 bg-white/10 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700 rounded-xl"></div>
                <span className="relative z-10">Schedule Demo</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
            {/* Company Info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center space-x-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center relative overflow-hidden">
                  {/* Shine effect on logo */}
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-700 rounded-xl"></div>
                  <TrendingUp className="h-6 w-6 text-white relative z-10" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">ForecastAI</span>
              </div>
              <p className="text-slate-400 leading-relaxed max-w-md">
                Empowering businesses with AI-powered demand forecasting and supply chain optimization. Transform your operations with cutting-edge machine learning technology.
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>SOC 2 Compliant</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span>99.9% Uptime</span>
                </div>
              </div>
            </div>

            {/* Product */}
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-white">Product</h4>
              <ul className="space-y-3">
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Demand Forecasting</Link></li>
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Supply Chain Analytics</Link></li>
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Inventory Optimization</Link></li>
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Real-time Insights</Link></li>
                <li><Link to="/register" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">API Integration</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-white">Company</h4>
              <ul className="space-y-3">
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">About Us</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Careers</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Press</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Blog</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Partners</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-white">Support</h4>
              <ul className="space-y-3">
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Help Center</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Documentation</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Contact Support</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">System Status</Link></li>
                <li><Link to="/" className="text-slate-400 hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Security</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="pt-8 border-t border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="flex items-center space-x-6">
                <p className="text-slate-400 text-sm">
                  © 2025 ForecastAI. All rights reserved.
                </p>
                <div className="flex items-center space-x-4 text-sm text-slate-400">
                  <Link to="/" className="hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Privacy Policy</Link>
                  <Link to="/" className="hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Terms of Service</Link>
                  <Link to="/" className="hover:text-white transition-colors hover:translate-x-1 transform transition-transform duration-300">Cookie Policy</Link>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>All systems operational</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-slate-400">Follow us:</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors cursor-pointer transform hover:scale-110 hover:-translate-y-1 transition-transform duration-300">
                      <span className="text-xs text-slate-400">tw</span>
                    </div>
                    <div className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors cursor-pointer transform hover:scale-110 hover:-translate-y-1 transition-transform duration-300">
                      <span className="text-xs text-slate-400">li</span>
                    </div>
                    <div className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors cursor-pointer transform hover:scale-110 hover:-translate-y-1 transition-transform duration-300">
                      <span className="text-xs text-slate-400">gh</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;