import { RefillMark, Wordmark } from './Brand';

export function PageLoading({
  label,
  embedded = false,
}: {
  label: string;
  embedded?: boolean;
}) {
  return (
    <section className={embedded ? 'pageload pageload--embed' : 'pageload'} aria-busy="true" aria-live="polite">
      <div className="pageload__box">
        <RefillMark size={36} />
        <Wordmark />
        <span className="pageload__spin" aria-hidden="true" />
        <p className="pageload__label">{label}</p>
      </div>
    </section>
  );
}
