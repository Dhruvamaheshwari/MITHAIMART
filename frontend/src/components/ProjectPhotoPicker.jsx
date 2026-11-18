import photoCredits from '../data/photoCredits'

// A drop-down for the admin forms: choose one of the sweets photos that ship with the website.
// It just fills in the image path (for example /images/sweets/kaju-katli.jpg).
const sweetsPhotos = photoCredits.filter((photo) => photo.path.startsWith('/images/sweets/'))

export default function ProjectPhotoPicker({ id, onPick, disabled }) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-sm font-medium">Or use a photo from the project</label>
      <select
        id={id}
        value=""
        disabled={disabled}
        onChange={(event) => event.target.value && onPick(event.target.value)}
        className="mt-1 w-full rounded-lg border border-brand-gold/60 bg-white px-3 py-2 outline-none focus:border-brand-red"
      >
        <option value="">Choose a photo...</option>
        {sweetsPhotos.map((photo) => (
          <option key={photo.path} value={photo.path}>
            {photo.subject}
          </option>
        ))}
      </select>
    </div>
  )
}
