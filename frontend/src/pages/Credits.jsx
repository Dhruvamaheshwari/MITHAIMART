import photoCredits from '../data/photoCredits'

// Lists every photo that ships with the website, who took it and under which licence it may be used.
// The licences (Creative Commons) require us to say this publicly.
export default function Credits() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Photo credits</h1>
      <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />
      <p className="mt-4 max-w-3xl text-brand-charcoal/80">
        The sweets photos on this site come from Wikimedia Commons and are used under free licences. Thank you to the
        photographers. Photos under CC BY-SA must be shared under the same licence if they are edited and shared again.
      </p>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {photoCredits.map((photo) => (
          <li key={photo.path} className="overflow-hidden rounded-xl border border-brand-gold/40 bg-white">
            <img src={photo.path} alt={photo.subject} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <div className="p-4 text-sm">
              <p className="font-display text-lg font-semibold">{photo.subject}</p>
              <p className="mt-1 text-brand-charcoal/70">
                Photo by <span className="font-medium text-brand-charcoal">{photo.author}</span>
              </p>
              <p className="mt-1">
                {photo.licenseUrl ? (
                  <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-brand-red underline">
                    {photo.license}
                  </a>
                ) : (
                  <span>{photo.license}</span>
                )}
                {' · '}
                <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-red underline">
                  Source
                </a>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
