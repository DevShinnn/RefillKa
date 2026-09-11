import type { Profile } from '@/lib/types';
import { PageLoading } from './PageLoading';
import { Topbar } from './Topbar';

/** Signed-in chrome plus a spinner while the rest of the page data loads. */
export function AppBoot({
  profile,
  scope,
  label,
}: {
  profile: Profile;
  scope?: string;
  label: string;
}) {
  return (
    <div className="app">
      <Topbar
        role={profile.role}
        name={profile.full_name || 'Signed in'}
        meta={scope || 'Loading'}
        officerId={profile.officer_id}
        heading="Loading"
        status="connecting"
      />
      <PageLoading embedded label={label} />
    </div>
  );
}
