import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Logo } from '@/components/ui/logo';
import { useAuth } from '@/lib/auth';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .refine(
      (email) => email.toLowerCase().endsWith('@theroofdocs.com'),
      { message: 'Only @theroofdocs.com email addresses are allowed' }
    ),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const { login, isLoading, user, isInitialized } = useAuth();
  const navigate = useNavigate();

  // Handle any auth errors from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authError = urlParams.get('error');

    if (authError) {
      setError('Authentication failed. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (isInitialized && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, isInitialized, navigate]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError('');
      console.log('Attempting login with:', data.email);
      await login(data.email, data.password);
      console.log('Login successful, navigating to dashboard');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-secondary-950 mb-2">Welcome Back</h1>
          <p className="text-secondary-600">Sign in to your Roof HR account</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold text-center text-secondary-950">
              Sign In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}


              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    {...form.register('email')}
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                    {...form.register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <div className="text-xs text-secondary-500 space-y-1">
            <p>© 2024 Roof HR. All rights reserved.</p>
            <div className="flex justify-center space-x-4 mt-2">
              <span className="text-primary font-medium">Integrity</span>
              <span className="text-secondary-500">•</span>
              <span className="text-primary font-medium">Quality</span>
              <span className="text-secondary-500">•</span>
              <span className="text-primary font-medium">Simplicity</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
