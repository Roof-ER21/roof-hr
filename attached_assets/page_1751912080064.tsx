
'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        // Get the updated session to check onboarding status
        const session = await getSession();
        
        if (session?.user?.onboardingStatus === 'PENDING') {
          router.push('/onboarding');
        } else {
          router.push(callbackUrl);
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return null; // Avoid hydration issues
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted px-4">
      <Card className="w-full max-w-md roof-er-shadow">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-2xl font-bold text-secondary-950">
            Welcome Back
          </CardTitle>
          <CardDescription>
            Sign in to access your Roof-ER HR portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="form-label">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 h-5 w-5" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 form-input"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="form-label">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 h-5 w-5" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 form-input"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary h-11"
            >
              {loading ? (
                <>
                  <div className="spinner mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-secondary-600">
              New to Roof-ER?{' '}
              <span className="font-medium text-primary">
                Contact your administrator
              </span>
            </p>
          </div>

          {/* Sample Accounts for Demo */}
          <div className="mt-8 pt-6 border-t">
            <p className="text-xs text-secondary-500 mb-3 text-center">Sample Accounts:</p>
            <div className="space-y-2 text-xs text-secondary-600">
              <p><strong>Admin:</strong> admin@roof-er.com / admin123</p>
              <p><strong>Manager:</strong> manager@roof-er.com / manager123</p>
              <p><strong>Worker:</strong> worker@roof-er.com / worker123</p>
              <p><strong>Contractor:</strong> contractor@roof-er.com / contractor123</p>
            </div>
          </div>

          {/* Core Values Footer */}
          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-xs font-semibold text-secondary-900 mb-2">
              Built on Our Core Values
            </p>
            <div className="flex justify-center gap-2 text-xs">
              <span className="text-primary font-medium">Integrity</span>
              <span className="text-secondary-500">•</span>
              <span className="text-primary font-medium">Quality</span>
              <span className="text-secondary-500">•</span>
              <span className="text-primary font-medium">Simplicity</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner border-primary"></div></div>}>
      <SignInForm />
    </Suspense>
  );
}
