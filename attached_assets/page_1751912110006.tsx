
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Calendar, Shield, FileText, MapPin } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-red-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ROOF-ER</h1>
              <p className="text-sm text-gray-600">THE ROOF DOCS</p>
            </div>
          </div>
          <Link href="/auth/signin">
            <Button className="bg-red-600 hover:bg-red-700">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            HR Management System
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Streamline your roofing business operations with our comprehensive HR platform designed specifically for the roofing industry.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Employee Management
              </CardTitle>
              <CardDescription>
                Manage your team, track onboarding, and maintain employee records
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                PTO Management
              </CardTitle>
              <CardDescription>
                Handle time-off requests with seasonal restrictions for busy periods
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-yellow-600" />
                Safety Compliance
              </CardTitle>
              <CardDescription>
                Track OSHA certifications, safety training, and incident reporting
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Recruiting System
              </CardTitle>
              <CardDescription>
                Manage candidates, schedule interviews, and track hiring pipeline
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-red-600" />
                GPS Check-in
              </CardTitle>
              <CardDescription>
                Location-based time tracking for field workers at job sites
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Performance Reviews
              </CardTitle>
              <CardDescription>
                Track employee performance and align with company values
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Test Accounts */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Demo Accounts</CardTitle>
            <CardDescription>
              Use these test accounts to explore the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-red-600">Admin</h4>
                <p className="text-sm text-gray-600">admin@roof-er.com</p>
                <p className="text-sm text-gray-500">Password: admin123</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-blue-600">Manager</h4>
                <p className="text-sm text-gray-600">manager@roof-er.com</p>
                <p className="text-sm text-gray-500">Password: manager123</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-green-600">HR Director</h4>
                <p className="text-sm text-gray-600">hr@roof-er.com</p>
                <p className="text-sm text-gray-500">Password: hr123</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-purple-600">Recruiter</h4>
                <p className="text-sm text-gray-600">recruiter@roof-er.com</p>
                <p className="text-sm text-gray-500">Password: recruiter123</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-orange-600">Field Worker</h4>
                <p className="text-sm text-gray-600">worker@roof-er.com</p>
                <p className="text-sm text-gray-500">Password: worker123</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-gray-600">Contractor</h4>
                <p className="text-sm text-gray-600">contractor@roof-er.com</p>
                <p className="text-sm text-gray-500">Password: contractor123</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link href="/auth/signin">
            <Button size="lg" className="bg-red-600 hover:bg-red-700">
              Get Started
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Building2 className="h-6 w-6 text-red-400" />
            <span className="text-xl font-bold">ROOF-ER HR System</span>
          </div>
          <p className="text-gray-400">
            Built for roofing professionals who value integrity, quality, and simplicity.
          </p>
        </div>
      </footer>
    </div>
  );
}
