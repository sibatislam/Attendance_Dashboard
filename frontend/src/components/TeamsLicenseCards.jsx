import { useTeamsLicense } from '../hooks/useTeamsLicense'

export default function TeamsLicenseCards() {
  const [license] = useTeamsLicense()
  
  // Show 0 if license values are not loaded yet (will update when API responds)

  const cards = [
    {
      label: 'Total Teams license',
      value: license.totalTeams,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
    },
    {
      label: 'Total assigned license',
      value: license.totalAssigned,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
    },
    {
      label: 'Free license',
      value: license.free,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`card p-4 ${c.bg} border ${c.border}`}
        >
          <p className="text-sm font-medium text-gray-600">{c.label}</p>
          <p className={`text-2xl font-bold mt-1 ${c.text}`}>
            {typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
          </p>
        </div>
      ))}
    </div>
  )
}
