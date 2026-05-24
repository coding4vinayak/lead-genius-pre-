import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Button, Input, Card } from '../components/ui';

const signupSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters'),
  name: z.string().optional(),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function Signup() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: SignupForm) => api.post('/auth/signup', data).then((r) => r.data),
    onSuccess: (res) => {
      login(res.data.token, res.data.user);
      toast.success('Account created!');
      navigate('/', { replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">LeadGenius</h1>
          <p className="text-sm text-gray-500 mt-1">Create your account</p>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input label="Name" {...register('name')} error={errors.name?.message} placeholder="Your name (optional)" />
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} placeholder="you@example.com" />
          <Input label="Password" type="password" {...register('password')} error={errors.password?.message} placeholder="Min 8 characters" />
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account? <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
