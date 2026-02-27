import { redirect } from 'next/navigation'

// Root page redirects to dashboard; the app layout handles auth.
export default function Home() {
  redirect('/dashboard')
}
