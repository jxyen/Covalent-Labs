import { LoginForm } from './login-form'

export const metadata = { title: 'Admin sign in · Kairo Labs' }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Kairo Labs Admin</h1>
      <LoginForm />
    </main>
  )
}
