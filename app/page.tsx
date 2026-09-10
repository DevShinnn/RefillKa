import { redirect } from 'next/navigation';

// Middleware sends signed-in users to their home. This is only a fallback.
export default function Index() {
  redirect('/login');
}
